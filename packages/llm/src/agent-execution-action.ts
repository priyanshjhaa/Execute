export const AGENT_EXECUTION_ACTION_TYPES = [
  'workflow.run',
  'execution.cancel',
  'execution.retry',
] as const;

export type AgentExecutionActionType = typeof AGENT_EXECUTION_ACTION_TYPES[number];

export function isAgentExecutionActionType(value: string): value is AgentExecutionActionType {
  return (AGENT_EXECUTION_ACTION_TYPES as readonly string[]).includes(value);
}

export function getAgentActionExecutionDisposition(status: string) {
  if (status === 'approved') return 'claim' as const;
  if (status === 'executing') return 'in_progress' as const;
  if (status === 'completed' || status === 'failed') return 'settled' as const;
  return 'unavailable' as const;
}
