import { and, eq } from 'drizzle-orm';
import {
  agentMessages,
  agentProposedActions,
  agentRuns,
  agentThreads,
  db,
} from '@execute/db';
import {
  AgentActionDecision,
  getAgentActionDecisionStatus,
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
    expiresAt: action.expiresAt,
  }).returning();

  if (!createdAction) {
    throw new AgentActionPersistenceError('Failed to persist proposed action.', 'INVALID_ACTION');
  }
  return createdAction;
}

export type AgentActionDecisionResult =
  | { kind: 'updated'; action: typeof agentProposedActions.$inferSelect }
  | { kind: 'not_found' }
  | { kind: 'conflict'; status: string };

export async function decideAgentProposedAction(input: {
  actionId: string;
  userId: string;
  decision: AgentActionDecision;
}): Promise<AgentActionDecisionResult> {
  const nextStatus = getAgentActionDecisionStatus('pending', input.decision);
  if (!nextStatus) throw new Error('Unsupported agent action decision');

  const decidedAt = new Date();
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
    ))
    .returning();

  if (updatedAction) return { kind: 'updated', action: updatedAction };

  const [currentAction] = await db.select({ status: agentProposedActions.status })
    .from(agentProposedActions)
    .where(and(
      eq(agentProposedActions.id, input.actionId),
      eq(agentProposedActions.userId, input.userId),
    ))
    .limit(1);

  return currentAction
    ? { kind: 'conflict', status: currentAction.status }
    : { kind: 'not_found' };
}
