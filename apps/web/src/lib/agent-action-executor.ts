import { and, eq, inArray } from 'drizzle-orm';
import { agentProposedActions, db, executions, users, workflows } from '@execute/db';
import { getAgentActionExecutionDisposition, isAgentExecutionActionType } from '@execute/llm';
import { z } from 'zod';
import { executeWorkflow, hasActiveExecution } from '@/lib/workflow-execution';

const RunPayloadSchema = z.object({
  workflowId: z.string().uuid(),
  inputData: z.record(z.string(), z.unknown()).default({}),
}).passthrough();

const ExecutionPayloadSchema = z.object({
  executionId: z.string().uuid(),
}).passthrough();

class AgentActionExecutionError extends Error {}

async function getInternalUser(userId: string) {
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
  }).from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AgentActionExecutionError('User not found.');
  return user;
}

async function executeWorkflowRun(userId: string, payload: Record<string, unknown>) {
  const args = RunPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The workflow run proposal is invalid.');

  const [workflow] = await db.select().from(workflows)
    .where(and(eq(workflows.id, args.data.workflowId), eq(workflows.userId, userId)))
    .limit(1);
  if (!workflow) throw new AgentActionExecutionError('Workflow not found.');
  if (workflow.status === 'archived') {
    throw new AgentActionExecutionError('Archived workflows cannot be run.');
  }
  if (await hasActiveExecution(workflow.id, userId)) {
    throw new AgentActionExecutionError('This workflow already has an active execution.');
  }

  const internalUser = await getInternalUser(userId);
  const result = await executeWorkflow({
    workflow: workflow as any,
    internalUser,
    triggerType: 'manual',
    triggerSource: 'agent_approval',
    triggerPayload: args.data.inputData,
  });
  return {
    kind: 'workflow_run',
    ...result,
    href: `/dashboard/executions/${result.executionId}`,
  };
}

async function executeCancellation(userId: string, payload: Record<string, unknown>) {
  const args = ExecutionPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The cancellation proposal is invalid.');

  const [updated] = await db.update(executions)
    .set({ cancelRequested: true, updatedAt: new Date() })
    .where(and(
      eq(executions.id, args.data.executionId),
      eq(executions.userId, userId),
      inArray(executions.status, ['running', 'waiting']),
    ))
    .returning({ id: executions.id, status: executions.status });

  if (!updated) {
    const [execution] = await db.select({
      id: executions.id,
      status: executions.status,
      cancelRequested: executions.cancelRequested,
    }).from(executions)
      .where(and(eq(executions.id, args.data.executionId), eq(executions.userId, userId)))
      .limit(1);
    if (!execution) throw new AgentActionExecutionError('Execution not found.');
    if (!execution.cancelRequested && execution.status !== 'cancelled') {
      throw new AgentActionExecutionError(`Execution cannot be cancelled with status ${execution.status}.`);
    }
  }

  return {
    kind: 'execution_cancel',
    executionId: args.data.executionId,
    status: 'cancellation_requested',
    href: `/dashboard/executions/${args.data.executionId}`,
  };
}

async function executeRetry(userId: string, payload: Record<string, unknown>) {
  const args = ExecutionPayloadSchema.safeParse(payload);
  if (!args.success) throw new AgentActionExecutionError('The retry proposal is invalid.');

  const [originalExecution] = await db.select().from(executions)
    .where(and(eq(executions.id, args.data.executionId), eq(executions.userId, userId)))
    .limit(1);
  if (!originalExecution) throw new AgentActionExecutionError('Execution not found.');
  if (originalExecution.status !== 'failed') {
    throw new AgentActionExecutionError('Only failed executions can be retried.');
  }
  if (!originalExecution.workflowId) {
    throw new AgentActionExecutionError('The failed execution has no workflow to retry.');
  }

  const [workflow] = await db.select().from(workflows)
    .where(and(
      eq(workflows.id, originalExecution.workflowId),
      eq(workflows.userId, userId),
    ))
    .limit(1);
  if (!workflow) throw new AgentActionExecutionError('Workflow not found.');
  if (workflow.status !== 'active') {
    throw new AgentActionExecutionError('Only active workflows can be retried.');
  }
  if (await hasActiveExecution(workflow.id, userId)) {
    throw new AgentActionExecutionError('This workflow already has an active execution.');
  }

  const internalUser = await getInternalUser(userId);
  const result = await executeWorkflow({
    workflow: workflow as any,
    internalUser,
    triggerType: 'manual',
    triggerSource: 'agent_retry',
    triggerPayload: originalExecution.triggerData?.data || {},
  });
  return {
    kind: 'execution_retry',
    ...result,
    retriedFrom: originalExecution.id,
    href: `/dashboard/executions/${result.executionId}`,
  };
}

async function runAction(userId: string, actionType: string, payload: Record<string, unknown>) {
  switch (actionType) {
    case 'workflow.run':
      return executeWorkflowRun(userId, payload);
    case 'execution.cancel':
      return executeCancellation(userId, payload);
    case 'execution.retry':
      return executeRetry(userId, payload);
    default:
      throw new AgentActionExecutionError('This approved action is not executable yet.');
  }
}

export async function executeApprovedAgentAction(userId: string, actionId: string) {
  const [currentAction] = await db.select().from(agentProposedActions)
    .where(and(
      eq(agentProposedActions.id, actionId),
      eq(agentProposedActions.userId, userId),
    ))
    .limit(1);
  if (!currentAction) return { handled: false as const, action: null };
  if (!isAgentExecutionActionType(currentAction.actionType)) {
    return { handled: false as const, action: currentAction };
  }
  if (getAgentActionExecutionDisposition(currentAction.status) !== 'claim') {
    return { handled: true as const, action: currentAction };
  }

  const startedAt = new Date();
  const [claimedAction] = await db.update(agentProposedActions)
    .set({
      status: 'executing',
      executionStartedAt: startedAt,
      updatedAt: startedAt,
      errorMessage: null,
    })
    .where(and(
      eq(agentProposedActions.id, actionId),
      eq(agentProposedActions.userId, userId),
      eq(agentProposedActions.status, 'approved'),
    ))
    .returning();

  if (!claimedAction) {
    const [action] = await db.select().from(agentProposedActions)
      .where(and(
        eq(agentProposedActions.id, actionId),
        eq(agentProposedActions.userId, userId),
      ))
      .limit(1);
    return { handled: true as const, action: action || currentAction };
  }

  try {
    const result = await runAction(userId, claimedAction.actionType, claimedAction.payload);
    const completedAt = new Date();
    const [completedAction] = await db.update(agentProposedActions)
      .set({
        status: 'completed',
        result,
        executionCompletedAt: completedAt,
        updatedAt: completedAt,
      })
      .where(and(
        eq(agentProposedActions.id, actionId),
        eq(agentProposedActions.userId, userId),
        eq(agentProposedActions.status, 'executing'),
      ))
      .returning();
    return { handled: true as const, action: completedAction || claimedAction };
  } catch (error) {
    const completedAt = new Date();
    const errorMessage = error instanceof AgentActionExecutionError
      ? error.message
      : 'The approved action could not be completed.';
    const [failedAction] = await db.update(agentProposedActions)
      .set({
        status: 'failed',
        errorMessage,
        executionCompletedAt: completedAt,
        updatedAt: completedAt,
      })
      .where(and(
        eq(agentProposedActions.id, actionId),
        eq(agentProposedActions.userId, userId),
        eq(agentProposedActions.status, 'executing'),
      ))
      .returning();
    return { handled: true as const, action: failedAction || claimedAction };
  }
}
