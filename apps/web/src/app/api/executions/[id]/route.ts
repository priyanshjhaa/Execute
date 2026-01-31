import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, executions, users, workflows } from '@execute/db';
import { eq, and } from 'drizzle-orm';

function generateId(): string {
  return crypto.randomUUID();
}

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid execution ID format' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [internalUser] = await db.select()
      .from(users)
      .where(eq(users.supabaseId, user.id))
      .limit(1);

    if (!internalUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [execution] = await db.select()
      .from(executions)
      .where(
        and(
          eq(executions.id, id),
          eq(executions.userId, internalUser.id)
        )
      )
      .limit(1);

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    const [workflow] = await db.select()
      .from(workflows)
      .where(eq(workflows.id, execution.workflowId!))
      .limit(1);

    return NextResponse.json({
      execution: {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        error: execution.errorMessage,
        workflow: workflow ? { id: workflow.id, name: workflow.name } : null,
        // Extract trigger info from triggerData
        triggerType: execution.triggerData?.type || 'manual',
        duration: execution.completedAt && execution.startedAt
          ? new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()
          : undefined,
      },
    });
  } catch (error: any) {
    console.error('Error fetching execution:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
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
        { error: 'Invalid execution ID format' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [internalUser] = await db.select()
      .from(users)
      .where(eq(users.supabaseId, user.id))
      .limit(1);

    if (!internalUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [originalExecution] = await db.select()
      .from(executions)
      .where(
        and(
          eq(executions.id, id),
          eq(executions.userId, internalUser.id)
        )
      )
      .limit(1);

    if (!originalExecution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    if (originalExecution.status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed executions can be retried', currentStatus: originalExecution.status },
        { status: 400 }
      );
    }

    const { createExecutor, getAllHandlers } = await import('@execute/execution');

    const [workflow] = await db.select()
      .from(workflows)
      .where(
        and(
          eq(workflows.id, originalExecution.workflowId!),
          eq(workflows.userId, internalUser.id)
        )
      )
      .limit(1);

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (workflow.status !== 'active') {
      return NextResponse.json({ error: 'Workflow is not active' }, { status: 400 });
    }

    const [runningExecution] = await db.select()
      .from(executions)
      .where(
        and(
          eq(executions.workflowId, workflow.id!),
          eq(executions.status, 'running')
        )
      )
      .limit(1);

    if (runningExecution) {
      return NextResponse.json(
        { error: 'Workflow is already running', executionId: runningExecution.id },
        { status: 409 }
      );
    }

    const newExecutionId = generateId();
    await db.insert(executions).values({
      id: newExecutionId,
      workflowId: workflow.id,
      userId: internalUser.id,
      status: 'running',
      startedAt: new Date(),
    });

    const executor = createExecutor();
    const handlers = getAllHandlers();
    for (const handler of handlers) {
      executor.registerHandler(handler);
    }

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
      newExecutionId
    );

    const now = new Date();
    await db.update(executions)
      .set({
        status: result.status,
        completedAt: now,
        errorMessage: result.error,
      })
      .where(eq(executions.id, newExecutionId));

    return NextResponse.json({
      executionId: newExecutionId,
      workflowId: workflow.id,
      status: result.status,
      error: result.error,
      retriedFrom: id,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      duration: result.duration,
    });
  } catch (error: any) {
    console.error('Error retrying execution:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
