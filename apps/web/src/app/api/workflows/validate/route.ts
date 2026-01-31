import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkflowValidator, createDefaultContext } from '@execute/validation';
import type { ValidationResult } from '@execute/validation';
import { z } from 'zod';

// Request schema validation
const ValidateRequestSchema = z.object({
  workflow: z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, 'Workflow name is required'),
    description: z.string().optional(),
    steps: z.array(z.object({
      id: z.string(),
      type: z.string(),
      name: z.string(),
      description: z.string().optional(),
      config: z.record(z.any()),
      position: z.number(),
    })).min(1, 'Workflow must have at least one step'),
    triggerStepId: z.string().uuid('Invalid trigger step ID'),
  }),
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
    const validatedData = ValidateRequestSchema.parse(body);

    // 3. Create validation context with user's available integrations
    // TODO: Fetch user's actual integration statuses from database
    const context = createDefaultContext();
    context.availableVariables = {
      user: {
        id: user.id,
        email: user.email || 'user@example.com',
        name: user.user_metadata?.name || 'User',
      },
      workflow: {
        id: validatedData.workflow.id || 'new',
        name: validatedData.workflow.name,
      },
      timestamp: new Date().toISOString(),
    };

    // 4. Validate workflow
    const validator = new WorkflowValidator();
    const result = await validator.validateWorkflow(validatedData.workflow, context);

    // 5. Return validation result
    return NextResponse.json(
      {
        success: true,
        validation: result,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Workflow validation error:', error);

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
