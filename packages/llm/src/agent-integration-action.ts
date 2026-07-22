export const AGENT_INTEGRATION_ACTION_TYPES = ['integration.disconnect'] as const;

export type AgentIntegrationActionType = typeof AGENT_INTEGRATION_ACTION_TYPES[number];

export function isAgentIntegrationActionType(value: string): value is AgentIntegrationActionType {
  return (AGENT_INTEGRATION_ACTION_TYPES as readonly string[]).includes(value);
}
