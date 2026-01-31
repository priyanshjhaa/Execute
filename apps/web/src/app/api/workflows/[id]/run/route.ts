import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db, workflows, users, executions } from '@execute/db';
import { eq, and } from 'drizzle-orm';
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

    if (workflow.status !== 'active') {
      return NextResponse.json({ error: 'Workflow is not active' }, { status: 400 });
    }

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
      triggerData: { type: 'manual', source: 'api', data: {} },
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
      executionId
    );

    const now = new Date();
    await db.update(executions)
      .set({
        status: result.status,
        completedAt: now,
        errorMessage: result.error,
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

    return NextResponse.json({
      executionId,
      workflowId: workflow.id,
      status: result.status,
      error: result.error,
      duration: result.duration,
    });
  } catch (error: any) {
    console.error('Error executing workflow:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
