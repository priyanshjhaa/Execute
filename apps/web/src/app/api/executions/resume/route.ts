import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, executions, users, workflows, steps } from '@execute/db';
import { eq, and, lte } from 'drizzle-orm';
import { createExecutor, getAllHandlers } from '@execute/execution';

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Resume endpoint for waiting executions (e.g., after delay)
 * This can be called by a cron job or scheduler to resume executions
 * whose resumeAt timestamp has passed.
 *
 * Query params:
 * - executionId: specific execution to resume (optional)
 * - secret: cron secret for authentication (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');
    const secret = searchParams.get('secret');

    // Simple secret check to prevent unauthorized resumes
    if (secret !== process.env.RESUME_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If specific execution ID provided, resume only that one
    if (executionId) {
      if (!isValidUUID(executionId)) {
        return NextResponse.json(
          { error: 'Invalid execution ID format' },
          { status: 400 }
        );
      }

      const [execution] = await db.select()
        .from(executions)
        .where(eq(executions.id, executionId))
        .limit(1);

      if (!execution) {
        return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
      }

      if (execution.status !== 'waiting') {
        return NextResponse.json(
          { error: 'Execution is not in waiting state', status: execution.status },
          { status: 400 }
        );
      }

      // Resume the specific execution
      const result = await resumeExecution(execution.id);
      return NextResponse.json(result);
    }

    // Otherwise, find all waiting executions ready to resume
    const now = new Date();
    const waitingExecutions = await db.select()
      .from(executions)
      .where(
        and(
          eq(executions.status, 'waiting'),
          lte(executions.resumeAt, now)
        )
      )
      .limit(10); // Batch size limit

    const results = [];
    for (const execution of waitingExecutions) {
      const result = await resumeExecution(execution.id);
      results.push(result);
    }

    return NextResponse.json({
      resumed: results.length,
      executions: results,
    });
  } catch (error: any) {
    console.error('Error resuming execution:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Resume a specific execution by continuing from where it left off
 */
async function resumeExecution(executionId: string) {
  // Get execution with workflow details
  const [execution] = await db.select()
    .from(executions)
    .where(eq(executions.id, executionId))
    .limit(1);

  if (!execution) {
    return { executionId, error: 'Execution not found' };
  }

  if (execution.status !== 'waiting') {
    return { executionId, error: 'Execution is not in waiting state' };
  }

  // Get workflow definition
  const [workflow] = await db.select()
    .from(workflows)
    .where(eq(workflows.id, execution.workflowId!))
    .limit(1);

  if (!workflow) {
    return { executionId, error: 'Workflow not found' };
  }

  // Get user
  const [user] = await db.select()
    .from(users)
    .where(eq(users.id, execution.userId))
    .limit(1);

  if (!user) {
    return { executionId, error: 'User not found' };
  }

  // Get completed steps to resume from the right position
  const completedSteps = await db.select()
    .from(steps)
    .where(eq(steps.executionId, executionId));

  // Find the last completed step position
  const lastCompletedStep = completedSteps
    .filter((s) => s.status === 'completed' || s.status === 'waiting')
    .sort((a, b) => b.stepOrder - a.stepOrder)[0];

  const resumeFromPosition = lastCompletedStep
    ? lastCompletedStep.stepOrder + 1
    : 0;

  // Update execution status back to running
  await db.update(executions)
    .set({
      status: 'running',
      resumeAt: null, // Clear resumeAt since we're resuming now
    })
    .where(eq(executions.id, executionId));

  // Create executor and execute remaining steps
  const executor = createExecutor();
  for (const handler of getAllHandlers()) {
    executor.registerHandler(handler);
  }

  // Track step order for database logging
  let stepOrder = resumeFromPosition;
  const stepDbIds = new Map<string, string>();

  const result = await executor.execute(
    {
      id: workflow.id,
      name: workflow.name,
      userId: user.id,
      definition: workflow.definition as any,
      triggerType: workflow.triggerType,
      triggerConfig: workflow.triggerConfig as any,
      webhookId: workflow.webhookId || undefined,
      scheduleExpression: workflow.scheduleExpression || undefined,
    },
    { id: user.id, email: user.email, name: user.name || undefined },
    executionId,
    {
      onStepStart: async (stepId) => {
        // Only create new step records for steps not yet executed
        const existingStep = completedSteps.find((s) => {
          const stepDef = (workflow.definition as any).steps.find((s: any) => s.id === stepId);
          return stepDef && s.stepOrder === stepDef.position;
        });

        if (existingStep) {
          stepDbIds.set(stepId, existingStep.id);
          return;
        }

        const stepDef = (workflow.definition as any).steps.find((s: any) => s.id === stepId);
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
      shouldContinue: async () => {
        const [currentExec] = await db.select()
          .from(executions)
          .where(eq(executions.id, executionId))
          .limit(1);

        if (currentExec?.cancelRequested) {
          await db.update(executions)
            .set({
              status: 'cancelled',
              cancelRequested: false,
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

  // Update final execution status
  const now = new Date();

  // Check if any step returned waiting status again (e.g., another delay)
  const waitingStep = result.steps.find((s) => s.status === 'waiting');
  const newResumeAt = waitingStep?.data?.resumeAt
    ? new Date(waitingStep.data.resumeAt)
    : null;

  await db.update(executions)
    .set({
      status: result.status === 'waiting' ? 'waiting' : result.status,
      resumeAt: newResumeAt,
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

  return {
    executionId,
    status: result.status,
    resumedFrom: resumeFromPosition,
    stepsCompleted: result.steps.filter((s) => s.status === 'completed').length,
  };
}
