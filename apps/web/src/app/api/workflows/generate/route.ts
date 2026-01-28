import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@execute/db';
import { workflows } from '@execute/db';
import { WorkflowParser, WorkflowParser as ParserClass, StepType } from '@execute/llm';
import { z } from 'zod';

// Request schema validation
const GenerateRequestSchema = z.object({
  instruction: z.string().min(10, 'Instruction must be at least 10 characters'),
});

// Helper function to get trigger type from steps
function getTriggerType(steps: any[]): 'webhook' | 'schedule' | 'event' {
  const triggerStep = steps[0];
  if (!triggerStep) return 'webhook';

  switch (triggerStep.type) {
    case StepType.WEBHOOK:
      return 'webhook';
    case StepType.SCHEDULE:
      return 'schedule';
    default:
      return 'event';
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const validatedData = GenerateRequestSchema.parse(body);

    // 3. Validate instruction clarity
    const validation = WorkflowParser.validateInstruction(validatedData.instruction);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Instruction validation failed',
          details: validation.reason,
        },
        { status: 400 }
      );
    }

    // 4. Check for API keys
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!anthropicKey && !openaiKey) {
      return NextResponse.json(
        {
          error: 'LLM service not configured',
          details: 'Please configure ANTHROPIC_API_KEY or OPENAI_API_KEY in environment variables',
        },
        { status: 500 }
      );
    }

    // 5. Create parser and generate workflow
    const provider = anthropicKey ? 'anthropic' : 'openai';
    const parser = new ParserClass({
      provider,
      apiKey: provider === 'anthropic' ? anthropicKey : openaiKey,
    });

    const result = await parser.parseInstruction({
      instruction: validatedData.instruction,
      userId: user.id,
    });

    // 6. Handle parsing failure
    if (!result.success || !result.workflow) {
      return NextResponse.json(
        {
          error: 'Failed to generate workflow',
          details: result.error,
          reasoning: result.reasoning,
        },
        { status: 422 }
      );
    }

    // 7. Save workflow to database
    const workflowData = {
      userId: user.id,
      name: result.workflow.name,
      description: result.workflow.description,
      definition: {
        steps: result.workflow.steps,
        triggerStepId: result.workflow.triggerStepId,
      },
      triggerType: getTriggerType(result.workflow.steps),
      triggerConfig: result.workflow.steps[0]?.config || {},
      status: 'draft',
      totalExecutions: 0,
      successRate: 0,
    };

    // Note: We need to sync the user first to get our internal user ID
    // For now, we'll use the Supabase user ID
    const [workflow] = await db.insert(workflows)
      .values(workflowData as any)
      .returning();

    return NextResponse.json(
      {
        success: true,
        workflowId: workflow.id,
        workflow: result.workflow,
        reasoning: result.reasoning,
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Workflow generation error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
