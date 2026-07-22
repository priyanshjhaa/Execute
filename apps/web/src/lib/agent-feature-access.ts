import { eq, inArray, sql } from 'drizzle-orm';
import { db, users } from '@execute/db';
import {
  canUserAccessAgent,
  canUserAccessFailureMonitor,
  resolveAgentFeaturePolicy,
} from '@execute/llm';
import { createClient } from '@/lib/supabase/server';

export type AgentFeature = 'agent' | 'monitor';

export interface AgentAccessUser {
  id: string;
  email: string;
}

export async function getCurrentAgentAccess() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { authenticated: false as const };

  const [internalUser] = await db.select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.supabaseId, user.id))
    .limit(1);
  if (!internalUser) return { authenticated: true as const, user: null };

  const policy = resolveAgentFeaturePolicy();
  return {
    authenticated: true as const,
    user: internalUser,
    agent: canUserAccessAgent(internalUser, policy),
    monitor: canUserAccessFailureMonitor(internalUser, policy),
    releaseMode: policy.releaseMode,
  };
}

export function canAccessAgentFeature(user: AgentAccessUser, feature: AgentFeature) {
  const policy = resolveAgentFeaturePolicy();
  return feature === 'monitor'
    ? canUserAccessFailureMonitor(user, policy)
    : canUserAccessAgent(user, policy);
}

export async function getFailureMonitorAllowedUserIds(): Promise<string[] | null> {
  const policy = resolveAgentFeaturePolicy();
  if (!policy.agentEnabled || !policy.monitorEnabled || policy.releaseMode === 'disabled') return [];
  if (policy.releaseMode === 'general') return null;
  if (!policy.internalUserIds.length && !policy.internalEmails.length) return [];

  const idMatches = policy.internalUserIds.length
    ? await db.select({ id: users.id }).from(users).where(inArray(users.id, policy.internalUserIds))
    : [];
  const emailMatches = policy.internalEmails.length
    ? await db.select({ id: users.id }).from(users)
      .where(inArray(sql<string>`lower(${users.email})`, policy.internalEmails))
    : [];
  return [...new Set([...idMatches, ...emailMatches].map((item) => item.id))];
}
