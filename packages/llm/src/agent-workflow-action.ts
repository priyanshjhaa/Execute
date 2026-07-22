export const AGENT_WORKFLOW_ACTION_TYPES = [
  'workflow.create',
  'workflow.update',
] as const;

export type AgentWorkflowActionType = typeof AGENT_WORKFLOW_ACTION_TYPES[number];

export function isAgentWorkflowActionType(value: string): value is AgentWorkflowActionType {
  return (AGENT_WORKFLOW_ACTION_TYPES as readonly string[]).includes(value);
}
