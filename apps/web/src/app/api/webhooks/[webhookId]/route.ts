import { NextRequest, NextResponse } from 'next/server';
import { db, workflows, users, executions } from '@execute/db';
import { eq, and } from 'drizzle-orm';
import { createExecutor, getAllHandlers } from '@execute/execution';

function generateId(): string {
  return crypto.randomUUID();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const { webhookId } = await params;
    const [workflow] = await db.select().from(workflows).where(eq(workflows.webhookId, webhookId)).limit(1);

    if (!workflow) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const [user] = await db.select().from(users).where(eq(users.id, workflow.userId)).limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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

    let triggerData: Record<string, any> = {};
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try { triggerData = await request.json(); } catch { triggerData = {}; }
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      for (const [key, value] of formData.entries()) {
        triggerData[key] = value.toString();
      }
    }

    const executionId = generateId();
    await db.insert(executions).values({
      id: executionId,
      workflowId: workflow.id,
      userId: user.id,
      status: 'running',
      triggerData: { type: 'webhook', source: webhookId, data: triggerData },
      startedAt: new Date(),
    });

    (async () => {
      try {
        const executor = createExecutor();
        const handlers = getAllHandlers();
        for (const handler of handlers) {
          executor.registerHandler(handler);
        }

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
          { triggerData }
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
      } catch (error: any) {
        console.error(`Webhook execution failed:`, error);
        await db.update(executions)
          .set({ status: 'failed', errorMessage: error.message })
          .where(eq(executions.id, executionId));
      }
    })();

    return NextResponse.json({
      success: true,
      executionId,
      message: 'Workflow execution started',
    }, { status: 202 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const { webhookId } = await params;
    const [workflow] = await db.select().from(workflows).where(eq(workflows.webhookId, webhookId)).limit(1);

    if (!workflow) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({
      webhookId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      isActive: workflow.status === 'active',
    });
  } catch (error: any) {
    console.error('Webhook GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
