import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, workflows, users } from '@execute/db';
import { createParser } from '@execute/llm';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

// Request schema validation for new structured input
const StructuredRequestSchema = z.object({
  what: z.string().min(5, 'Description must be at least 5 characters'),
  when: z.enum(['now', 'schedule', 'event']),
  schedule: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    day: z.string().optional(),
    time: z.string(),
  }).optional(),
  event: z.string().optional(),
  additionalContext: z.string().optional(),
}).refine(
  (data) => {
    if (data.when === 'schedule') return !!data.schedule;
    if (data.when === 'event') return !!data.event;
    return true;
  },
  {
    message: 'Schedule or event must be provided based on "when" selection',
  }
);

// Legacy request schema (for backward compatibility)
const LegacyRequestSchema = z.object({
  instruction: z.string().min(10, 'Instruction must be at least 10 characters'),
});

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

    // Detect if this is structured or legacy input
    const isStructuredInput = 'what' in body && 'when' in body;

    let validatedData: any;
    let parseInput: any;

    if (isStructuredInput) {
      // New structured input
      validatedData = StructuredRequestSchema.parse(body);
      parseInput = {
        ...validatedData,
        userId: user.id,
      };
    } else {
      // Legacy simple instruction
      validatedData = LegacyRequestSchema.parse(body);
      parseInput = {
        instruction: validatedData.instruction,
        userId: user.id,
      };
    }

    // 3. Create parser and generate workflow (uses OpenRouter)
    const parser = createParser();

    const result = await parser.parseInstruction(parseInput);

    // 4. Handle parsing failure
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

    // 5. Save workflow to database
    // Get trigger type from the first step (which is always the trigger)
    if (!result.workflow) {
      throw new Error('Workflow is undefined');
    }

    const triggerStep = result.workflow.steps.find(step => step.id === result.workflow.triggerStepId);
    const triggerType = triggerStep?.type || 'webhook';

    // Find or create internal user record
    let [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    // Create user if doesn't exist
    if (!internalUser) {
      [internalUser] = await db.insert(users)
        .values({
          supabaseId: user.id,
          email: user.email!,
          name: user.user_metadata?.name || user.email?.split('@')[0],
        })
        .returning();
    }

    const workflowData = {
      userId: internalUser.id,
      name: result.workflow.name,
      description: result.workflow.description,
      definition: {
        steps: result.workflow.steps,
        triggerStepId: result.workflow.triggerStepId,
      },
      triggerType: triggerType,
      triggerConfig: triggerStep?.config || {},
      status: 'draft',
      totalExecutions: 0,
      successRate: 0,
    };

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
