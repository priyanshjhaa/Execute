import { and, asc, eq, gt, lte } from 'drizzle-orm';
import {
  agentMessages,
  agentProposedActions,
  agentRuns,
  agentThreads,
  db,
} from '@execute/db';
import {
  AgentActionDecision,
  getAgentActionDecisionTransition,
  getAgentActionDecisionStatus,
  resolveAgentActionTtlMinutes,
} from '@execute/llm';
import { z } from 'zod';

const AGENT_ACTION_PAYLOAD_MAX_CHARS = 32_000;

const ProposedActionInputSchema = z.object({
  userId: z.string().uuid(),
  threadId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  assistantMessageId: z.string().uuid().optional(),
  actionType: z.string().trim().min(1).max(100)
    .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4_000).optional(),
  payload: z.record(z.string(), z.unknown()),
  expiresAt: z.date().optional(),
}).strict();

export type ProposedAgentActionInput = z.input<typeof ProposedActionInputSchema>;

export class AgentActionPersistenceError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_ACTION' | 'SCOPE_NOT_FOUND' | 'PAYLOAD_TOO_LARGE',
  ) {
    super(message);
    this.name = 'AgentActionPersistenceError';
  }
}

function parseProposedActionInput(input: ProposedAgentActionInput) {
  const parsed = ProposedActionInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AgentActionPersistenceError('Proposed action is invalid.', 'INVALID_ACTION');
  }

  let serializedPayload: string;
  try {
    serializedPayload = JSON.stringify(parsed.data.payload);
  } catch {
    throw new AgentActionPersistenceError('Action payload must be JSON serializable.', 'INVALID_ACTION');
  }
  if (serializedPayload.length > AGENT_ACTION_PAYLOAD_MAX_CHARS) {
    throw new AgentActionPersistenceError('Action payload is too large.', 'PAYLOAD_TOO_LARGE');
  }

  return parsed.data;
}

export async function createAgentProposedAction(input: ProposedAgentActionInput) {
  const action = parseProposedActionInput(input);
  const expiresAt = action.expiresAt || new Date(
    Date.now() + resolveAgentActionTtlMinutes(process.env.AGENT_ACTION_TTL_MINUTES) * 60_000,
  );

  const [ownedThread] = await db.select({ id: agentThreads.id })
    .from(agentThreads)
    .where(and(
      eq(agentThreads.id, action.threadId),
      eq(agentThreads.userId, action.userId),
    ))
    .limit(1);
  if (!ownedThread) {
    throw new AgentActionPersistenceError('Agent thread was not found.', 'SCOPE_NOT_FOUND');
  }

  if (action.runId) {
    const [ownedRun] = await db.select({
      id: agentRuns.id,
      threadId: agentRuns.threadId,
    })
      .from(agentRuns)
      .where(and(
        eq(agentRuns.id, action.runId),
        eq(agentRuns.userId, action.userId),
      ))
      .limit(1);
    if (!ownedRun) {
      throw new AgentActionPersistenceError('Agent run was not found.', 'SCOPE_NOT_FOUND');
    }
    if (ownedRun.threadId && ownedRun.threadId !== action.threadId) {
      throw new AgentActionPersistenceError('Agent run belongs to another thread.', 'SCOPE_NOT_FOUND');
    }
  }

  if (action.assistantMessageId) {
    const [ownedMessage] = await db.select({
      id: agentMessages.id,
      role: agentMessages.role,
    })
      .from(agentMessages)
      .where(and(
        eq(agentMessages.id, action.assistantMessageId),
        eq(agentMessages.threadId, action.threadId),
        eq(agentMessages.userId, action.userId),
      ))
      .limit(1);
    if (!ownedMessage) {
      throw new AgentActionPersistenceError('Agent message was not found.', 'SCOPE_NOT_FOUND');
    }
    if (ownedMessage.role !== 'assistant') {
      throw new AgentActionPersistenceError('Proposed actions must reference an assistant message.', 'INVALID_ACTION');
    }
  }

  const [createdAction] = await db.insert(agentProposedActions).values({
    userId: action.userId,
    threadId: action.threadId,
    runId: action.runId,
    assistantMessageId: action.assistantMessageId,
    actionType: action.actionType,
    title: action.title,
    description: action.description,
    payload: action.payload,
    expiresAt,
  }).returning();

  if (!createdAction) {
    throw new AgentActionPersistenceError('Failed to persist proposed action.', 'INVALID_ACTION');
  }
  return createdAction;
}

export type AgentActionDecisionResult =
  | { kind: 'updated'; action: typeof agentProposedActions.$inferSelect }
  | { kind: 'already_applied'; action: typeof agentProposedActions.$inferSelect }
  | { kind: 'not_found' }
  | { kind: 'conflict'; status: string };

async function expireAgentAction(userId: string, actionId: string, now: Date) {
  await db.update(agentProposedActions)
    .set({ status: 'expired', decidedAt: now, updatedAt: now })
    .where(and(
      eq(agentProposedActions.id, actionId),
      eq(agentProposedActions.userId, userId),
      eq(agentProposedActions.status, 'pending'),
      lte(agentProposedActions.expiresAt, now),
    ));
}

export async function expirePendingAgentActions(userId: string, threadId: string) {
  const now = new Date();
  await db.update(agentProposedActions)
    .set({ status: 'expired', decidedAt: now, updatedAt: now })
    .where(and(
      eq(agentProposedActions.userId, userId),
      eq(agentProposedActions.threadId, threadId),
      eq(agentProposedActions.status, 'pending'),
      lte(agentProposedActions.expiresAt, now),
    ));
}

export async function listAgentProposedActionsForThread(userId: string, threadId: string) {
  await expirePendingAgentActions(userId, threadId);

  return db.select({
    id: agentProposedActions.id,
    threadId: agentProposedActions.threadId,
    assistantMessageId: agentProposedActions.assistantMessageId,
    actionType: agentProposedActions.actionType,
    title: agentProposedActions.title,
    description: agentProposedActions.description,
    payload: agentProposedActions.payload,
    status: agentProposedActions.status,
    expiresAt: agentProposedActions.expiresAt,
    decidedAt: agentProposedActions.decidedAt,
    executionStartedAt: agentProposedActions.executionStartedAt,
    executionCompletedAt: agentProposedActions.executionCompletedAt,
    result: agentProposedActions.result,
    errorMessage: agentProposedActions.errorMessage,
    createdAt: agentProposedActions.createdAt,
    updatedAt: agentProposedActions.updatedAt,
  }).from(agentProposedActions)
    .where(and(
      eq(agentProposedActions.userId, userId),
      eq(agentProposedActions.threadId, threadId),
    ))
    .orderBy(asc(agentProposedActions.createdAt));
}

export async function decideAgentProposedAction(input: {
  actionId: string;
  userId: string;
  decision: AgentActionDecision;
}): Promise<AgentActionDecisionResult> {
  const nextStatus = getAgentActionDecisionStatus('pending', input.decision);
  if (!nextStatus) throw new Error('Unsupported agent action decision');

  const decidedAt = new Date();
  await expireAgentAction(input.userId, input.actionId, decidedAt);

  const [updatedAction] = await db.update(agentProposedActions)
    .set({
      status: nextStatus,
      decidedAt,
      approvedAt: nextStatus === 'approved' ? decidedAt : null,
      rejectedAt: nextStatus === 'rejected' ? decidedAt : null,
      updatedAt: decidedAt,
    })
    .where(and(
      eq(agentProposedActions.id, input.actionId),
      eq(agentProposedActions.userId, input.userId),
      eq(agentProposedActions.status, 'pending'),
      gt(agentProposedActions.expiresAt, decidedAt),
    ))
    .returning();

  if (updatedAction) return { kind: 'updated', action: updatedAction };

  const [currentAction] = await db.select()
    .from(agentProposedActions)
    .where(and(
      eq(agentProposedActions.id, input.actionId),
      eq(agentProposedActions.userId, input.userId),
    ))
    .limit(1);

  if (!currentAction) return { kind: 'not_found' };
  if (
    (input.decision === 'approve' && currentAction.approvedAt)
    || (input.decision === 'reject' && currentAction.rejectedAt)
  ) {
    return { kind: 'already_applied', action: currentAction };
  }
  const transition = getAgentActionDecisionTransition(currentAction.status, input.decision);
  if (transition.kind === 'already_applied') {
    return { kind: 'already_applied', action: currentAction };
  }
  return { kind: 'conflict', status: currentAction.status };
}
