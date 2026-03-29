import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, workflows, users } from '@execute/db';
import { createParser, enhanceEmailStepStructured, generateDynamicEmail, type EmailPreferences } from '@execute/llm';
import { findPremiumLockedSteps } from '@execute/validation';
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
  // NEW: Email preferences
  emailPreferences: z.object({
    tone: z.enum(['formal', 'casual', 'friendly', 'urgent']).optional(),
    structure: z.enum(['detailed', 'brief', 'minimal']).optional(),
    style: z.enum(['professional', 'conversational', 'direct']).optional(),
    customInstructions: z.string().optional(),
    overrides: z.object({
      subject: z.string().optional(),
      heading: z.string().optional(),
      body: z.string().optional(),
    }).optional(),
  }).optional(),
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

    const premiumLockedStepErrors = findPremiumLockedSteps(result.workflow.steps || []);
    if (premiumLockedStepErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Workflow contains premium actions that are not yet available',
          details: premiumLockedStepErrors.join(' '),
        },
        { status: 422 }
      );
    }

    // 4.5. Enhance email steps with dynamic email generation
    const originalIntent = isStructuredInput ? validatedData.what : validatedData.instruction;
    const emailPreferences = validatedData.emailPreferences as EmailPreferences | undefined;

    // Get trigger type early for email generation
    if (!result.workflow) {
      throw new Error('Workflow is undefined');
    }
    const triggerStep = result.workflow.steps.find(step => step.id === result.workflow!.triggerStepId);
    const triggerType = triggerStep?.type || 'webhook';

    for (const step of result.workflow.steps) {
      if (step.type === 'send_email' && step.config) {
        try {
          console.log('[WorkflowGen] ==================================================');
          console.log('[WorkflowGen] Using dynamic email generation...');
          console.log('[WorkflowGen] Original intent:', originalIntent);
          console.log('[WorkflowGen] Email preferences:', emailPreferences);
          console.log('[WorkflowGen] Original config:', JSON.stringify(step.config, null, 2));

          // Use new dynamic email generator
          const enhanced = await generateDynamicEmail({
            userIntent: originalIntent,
            triggerType,
            preferences: emailPreferences,
            stepConfig: step.config,
            recipientInfo: {
              name: step.config.to,
            },
          });

          console.log('[WorkflowGen] Enhanced config:', JSON.stringify(enhanced, null, 2));
          console.log('[WorkflowGen] Generated heading:', enhanced.heading);
          console.log('[WorkflowGen] Template used:', enhanced.metadata?.templateUsed);

          // Merge enhanced email with existing config
          step.config = {
            ...step.config,
            subject: enhanced.subject,
            heading: enhanced.heading,
            body: enhanced.body,
            intro: enhanced.intro,
            details: enhanced.details,
            ctaText: enhanced.ctaText,
            ctaLink: enhanced.ctaLink,
            replyHint: enhanced.replyHint,
            signatureName: enhanced.signatureName,
            showBranding: enhanced.showBranding,
            showFooter: enhanced.showFooter,
            showReplyHint: enhanced.showReplyHint,
            // Store metadata for debugging
            _emailMetadata: enhanced.metadata,
          };

          console.log('[WorkflowGen] ==================================================');
        } catch (error: any) {
          console.error('[WorkflowGen] Failed to enhance email step:', error.message);
          console.error('[WorkflowGen] Error stack:', error.stack);
          // Fallback to legacy enhancement if dynamic generation fails
          try {
            console.log('[WorkflowGen] Falling back to legacy email enhancement...');
            const legacyEnhanced = await enhanceEmailStepStructured(originalIntent, step.config);
            step.config = legacyEnhanced;
          } catch (fallbackError: any) {
            console.error('[WorkflowGen] Legacy fallback also failed:', fallbackError.message);
            // Continue with original config
          }
        }
      }
    }

    // 5. Save workflow to database
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

    // Generate webhookId for webhook-based workflows
    const webhookId = triggerType === 'webhook' ? crypto.randomUUID() : null;

    const workflowData = {
      userId: internalUser.id,
      name: result.workflow.name,
      description: result.workflow.description,
      definition: {
        steps: result.workflow.steps,
        triggerStepId: result.workflow!.triggerStepId,
      },
      triggerType: triggerType,
      triggerConfig: triggerStep?.config || {},
      status: 'draft',
      totalExecutions: 0,
      successRate: 0,
      webhookId: webhookId,
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
