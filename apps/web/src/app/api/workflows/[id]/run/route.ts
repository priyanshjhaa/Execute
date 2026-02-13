import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, workflows, users, executions, steps } from '@execute/db';
import { eq, and, lt } from 'drizzle-orm';
import { createExecutor, getAllHandlers } from '@execute/execution';

function generateId(): string {
  return crypto.randomUUID();
}

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid workflow ID format' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [internalUser] = await db.select().from(users).where(eq(users.supabaseId, user.id));

    if (!internalUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [workflow] = await db.select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, internalUser.id)));

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Removed status check to allow running workflows in draft mode for testing

    const [runningExecution] = await db.select()
      .from(executions)
      .where(and(eq(executions.workflowId, workflow.id!), eq(executions.status, 'running')))
      .limit(1);

    if (runningExecution) {
      return NextResponse.json({ error: 'Workflow is already running' }, { status: 409 });
    }

    const executionId = generateId();
    await db.insert(executions).values({
      id: executionId,
      workflowId: workflow.id,
      userId: internalUser.id,
      status: 'running',
      cancelRequested: false,
      triggerData: { type: 'manual', source: 'api', data: {} },
      startedAt: new Date(),
    });

    const executor = createExecutor();
    const handlers = getAllHandlers();
    for (const handler of handlers) {
      executor.registerHandler(handler);
    }

    // Track step order for database logging
    let stepOrder = 0;
    const stepDbIds = new Map<string, string>(); // stepId -> db step record id

    const result = await executor.execute(
      {
        id: workflow.id,
        name: workflow.name,
        userId: internalUser.id,
        definition: workflow.definition as any,
        triggerType: workflow.triggerType,
        triggerConfig: workflow.triggerConfig as any,
        webhookId: workflow.webhookId || undefined,
        scheduleExpression: workflow.scheduleExpression || undefined,
      },
      { id: internalUser.id, email: internalUser.email, name: internalUser.name || undefined },
      executionId,
      {
        onStepStart: async (stepId) => {
          const stepDef = workflow.definition.steps.find((s: any) => s.id === stepId);
          const [stepRecord] = await db.insert(steps).values({
            executionId,
            stepOrder: stepOrder++,
            stepType: stepDef?.type || 'unknown',
            description: stepDef?.name || stepId,
            inputParams: stepDef || {},
            status: 'running',
            startedAt: new Date(),
          }).returning();
          stepDbIds.set(stepId, stepRecord.id);
        },
        onStepComplete: async (stepResult) => {
          const dbStepId = stepDbIds.get(stepResult.stepId);
          if (dbStepId) {
            await db.update(steps)
              .set({
                status: stepResult.status,
                outputResult: { data: stepResult.data, error: stepResult.error },
                completedAt: stepResult.completedAt || new Date(),
                errorMessage: stepResult.error,
              })
              .where(eq(steps.id, dbStepId));
          }
        },
        // Check database for cancellation requests
        shouldContinue: async () => {
          const [execution] = await db.select()
            .from(executions)
            .where(eq(executions.id, executionId))
            .limit(1);

          // If cancel_requested is true, stop execution
          if (execution?.cancelRequested) {
            // Update execution status to cancelled
            await db.update(executions)
              .set({
                status: 'cancelled',
                cancelRequested: false, // Reset the flag
                completedAt: new Date(),
                errorMessage: 'Execution cancelled by user',
              })
              .where(eq(executions.id, executionId));
            return false;
          }

          return true;
        },
      }
    );

    // Only update if execution wasn't cancelled (shouldContinue handles that case)
    const [currentExecution] = await db.select()
      .from(executions)
      .where(eq(executions.id, executionId))
      .limit(1);

    if (currentExecution?.status !== 'cancelled') {
      const now = new Date();

      // Check if any step returned waiting status (e.g., delay step)
      const waitingStep = result.steps.find((s) => s.status === 'waiting');
      const resumeAt = waitingStep?.data?.resumeAt
        ? new Date(waitingStep.data.resumeAt)
        : null;

      await db.update(executions)
        .set({
          status: result.status === 'waiting' ? 'waiting' : result.status,
          resumeAt,
          completedAt: result.status === 'waiting' ? undefined : now,
          errorMessage: result.error,
          totalSteps: result.steps.length,
          completedSteps: result.steps.filter((s) => s.status === 'completed').length,
        })
        .where(eq(executions.id, executionId));

      if (result.status === 'completed') {
        await db.update(workflows)
          .set({
            lastExecutedAt: now,
            totalExecutions: (workflow.totalExecutions || 0) + 1,
          })
          .where(eq(workflows.id, workflow.id));
      }
    }

    // Get final execution status for response
    const [finalExecution] = await db.select()
      .from(executions)
      .where(eq(executions.id, executionId))
      .limit(1);

    return NextResponse.json({
      executionId,
      workflowId: workflow.id,
      status: finalExecution?.status || result.status,
      error: finalExecution?.errorMessage || result.error,
      duration: result.duration,
    });
  } catch (error: any) {
    console.error('Error executing workflow:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
