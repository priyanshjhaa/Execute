export type AgentActionDecision = 'approve' | 'reject';
export type DecidedAgentActionStatus = 'approved' | 'rejected';
export const AGENT_ACTION_DEFAULT_TTL_MINUTES = 24 * 60;
export const AGENT_ACTION_MIN_TTL_MINUTES = 5;
export const AGENT_ACTION_MAX_TTL_MINUTES = 7 * 24 * 60;

export type AgentActionDecisionTransition =
  | { kind: 'apply'; status: DecidedAgentActionStatus }
  | { kind: 'already_applied'; status: DecidedAgentActionStatus }
  | { kind: 'conflict' };

function getDecisionTarget(decision: AgentActionDecision): DecidedAgentActionStatus {
  return decision === 'approve' ? 'approved' : 'rejected';
}

export function getAgentActionDecisionStatus(
  currentStatus: string,
  decision: AgentActionDecision,
): DecidedAgentActionStatus | null {
  if (currentStatus !== 'pending') return null;
  return getDecisionTarget(decision);
}

export function getAgentActionDecisionTransition(
  currentStatus: string,
  decision: AgentActionDecision,
): AgentActionDecisionTransition {
  const target = getDecisionTarget(decision);
  if (currentStatus === 'pending') return { kind: 'apply', status: target };
  if (currentStatus === target) return { kind: 'already_applied', status: target };
  return { kind: 'conflict' };
}

export function resolveAgentActionTtlMinutes(configured?: string): number {
  const parsed = Number.parseInt(configured || '', 10);
  if (!Number.isFinite(parsed)) return AGENT_ACTION_DEFAULT_TTL_MINUTES;
  return Math.min(
    Math.max(parsed, AGENT_ACTION_MIN_TTL_MINUTES),
    AGENT_ACTION_MAX_TTL_MINUTES,
  );
}
