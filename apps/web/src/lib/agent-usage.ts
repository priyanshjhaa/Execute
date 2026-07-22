import { and, eq, sql } from 'drizzle-orm';
import { agentDailyUsage, agentModelCalls, db } from '@execute/db';
import {
  getAgentDailyLimitStatus,
  resolveAgentDailyRequestLimit,
  resolveAgentDailyTokenLimit,
  type AgentModelCallTelemetry,
} from '@execute/llm';

export class AgentDailyUsageLimitError extends Error {
  constructor(
    message: string,
    public readonly limit: 'tokens' | 'requests',
    public readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = 'AgentDailyUsageLimitError';
  }
}

function utcUsageDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function utcReset(now = new Date()) {
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return reset;
}

function limitError(limit: 'tokens' | 'requests', now: Date) {
  const retryAfterSeconds = Math.max(1, Math.ceil((utcReset(now).getTime() - now.getTime()) / 1000));
  return new AgentDailyUsageLimitError(
    limit === 'tokens'
      ? 'Daily agent token limit reached. Try again after the UTC reset.'
      : 'Daily agent request limit reached. Try again after the UTC reset.',
    limit,
    retryAfterSeconds,
  );
}

export async function getAgentDailyUsage(userId: string, now = new Date()) {
  const [usage] = await db.select().from(agentDailyUsage).where(and(
    eq(agentDailyUsage.userId, userId),
    eq(agentDailyUsage.usageDate, utcUsageDate(now)),
  )).limit(1);
  return {
    inputTokens: usage?.inputTokens || 0,
    outputTokens: usage?.outputTokens || 0,
    totalTokens: usage?.totalTokens || 0,
    modelCalls: usage?.modelCallCount || 0,
    reasoningCalls: usage?.reasoningCallCount || 0,
    requests: usage?.requestCount || 0,
    resetsAt: utcReset(now),
  };
}

export async function reserveAgentDailyRequest(userId: string, now = new Date()) {
  const usageDate = utcUsageDate(now);
  const [reserved] = await db.insert(agentDailyUsage).values({
    userId,
    usageDate,
    requestCount: 1,
  }).onConflictDoUpdate({
    target: [agentDailyUsage.userId, agentDailyUsage.usageDate],
    set: {
      requestCount: sql`${agentDailyUsage.requestCount} + 1`,
      updatedAt: now,
    },
    setWhere: and(
      sql`${agentDailyUsage.requestCount} < ${resolveAgentDailyRequestLimit()}`,
      sql`${agentDailyUsage.totalTokens} < ${resolveAgentDailyTokenLimit()}`,
    ),
  }).returning();

  if (reserved) return reserved;
  const usage = await getAgentDailyUsage(userId, now);
  throw limitError(getAgentDailyLimitStatus(usage) || 'requests', now);
}

export async function recordAgentModelCall(input: {
  userId: string;
  runId: string;
  threadId: string | null;
  sequence: number;
  call: AgentModelCallTelemetry;
}) {
  const totalTokens = input.call.usage.inputTokens + input.call.usage.outputTokens;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(agentModelCalls).values({
      userId: input.userId,
      runId: input.runId,
      threadId: input.threadId,
      sequence: input.sequence,
      purpose: input.call.purpose,
      provider: input.call.provider,
      model: input.call.model,
      tier: input.call.tier,
      inputTokens: input.call.usage.inputTokens,
      outputTokens: input.call.usage.outputTokens,
      totalTokens,
      latencyMs: input.call.latencyMs,
    });
    await tx.insert(agentDailyUsage).values({
      userId: input.userId,
      usageDate: utcUsageDate(now),
      modelCallCount: 1,
      reasoningCallCount: input.call.tier === 'reasoning' ? 1 : 0,
      inputTokens: input.call.usage.inputTokens,
      outputTokens: input.call.usage.outputTokens,
      totalTokens,
    }).onConflictDoUpdate({
      target: [agentDailyUsage.userId, agentDailyUsage.usageDate],
      set: {
        modelCallCount: sql`${agentDailyUsage.modelCallCount} + 1`,
        reasoningCallCount: sql`${agentDailyUsage.reasoningCallCount} + ${input.call.tier === 'reasoning' ? 1 : 0}`,
        inputTokens: sql`${agentDailyUsage.inputTokens} + ${input.call.usage.inputTokens}`,
        outputTokens: sql`${agentDailyUsage.outputTokens} + ${input.call.usage.outputTokens}`,
        totalTokens: sql`${agentDailyUsage.totalTokens} + ${totalTokens}`,
        updatedAt: now,
      },
    });
  });
}
