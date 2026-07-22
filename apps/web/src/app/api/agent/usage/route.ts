import { NextResponse } from 'next/server';
import { and, count, eq, gte, lt, sql } from 'drizzle-orm';
import { agentModelCalls, db, users } from '@execute/db';
import { resolveAgentDailyRequestLimit, resolveAgentDailyTokenLimit } from '@execute/llm';
import { getAgentDailyUsage } from '@/lib/agent-usage';
import { createClient } from '@/lib/supabase/server';
import { canAccessAgentFeature } from '@/lib/agent-feature-access';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [internalUser] = await db.select({ id: users.id, email: users.email }).from(users)
    .where(eq(users.supabaseId, user.id)).limit(1);
  if (!internalUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!canAccessAgentFeature(internalUser, 'agent')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const [usage, breakdown] = await Promise.all([
    getAgentDailyUsage(internalUser.id, now),
    db.select({
      provider: agentModelCalls.provider,
      model: agentModelCalls.model,
      tier: agentModelCalls.tier,
      purpose: agentModelCalls.purpose,
      calls: count(),
      inputTokens: sql<number>`coalesce(sum(${agentModelCalls.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${agentModelCalls.outputTokens}), 0)`,
      averageLatencyMs: sql<number>`coalesce(round(avg(${agentModelCalls.latencyMs})), 0)`,
    }).from(agentModelCalls).where(and(
      eq(agentModelCalls.userId, internalUser.id),
      gte(agentModelCalls.createdAt, dayStart),
      lt(agentModelCalls.createdAt, dayEnd),
    )).groupBy(
      agentModelCalls.provider,
      agentModelCalls.model,
      agentModelCalls.tier,
      agentModelCalls.purpose,
    ),
  ]);
  const limits = {
    tokens: resolveAgentDailyTokenLimit(),
    requests: resolveAgentDailyRequestLimit(),
  };
  return NextResponse.json({
    date: now.toISOString().slice(0, 10),
    usage,
    limits,
    remaining: {
      tokens: Math.max(0, limits.tokens - usage.totalTokens),
      requests: Math.max(0, limits.requests - usage.requests),
    },
    breakdown: breakdown.map((row) => ({
      ...row,
      calls: Number(row.calls),
      inputTokens: Number(row.inputTokens),
      outputTokens: Number(row.outputTokens),
      averageLatencyMs: Number(row.averageLatencyMs),
    })),
  });
}
