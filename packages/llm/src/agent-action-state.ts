export type AgentActionDecision = 'approve' | 'reject';
export type DecidedAgentActionStatus = 'approved' | 'rejected';

export function getAgentActionDecisionStatus(
  currentStatus: string,
  decision: AgentActionDecision,
): DecidedAgentActionStatus | null {
  if (currentStatus !== 'pending') return null;
  return decision === 'approve' ? 'approved' : 'rejected';
}
