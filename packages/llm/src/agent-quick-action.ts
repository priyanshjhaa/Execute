export const AGENT_QUICK_ACTION_TYPES = [
  'event.log',
  'email.send',
] as const;

export type AgentQuickActionType = typeof AGENT_QUICK_ACTION_TYPES[number];

export function isAgentQuickActionType(value: string): value is AgentQuickActionType {
  return (AGENT_QUICK_ACTION_TYPES as readonly string[]).includes(value);
}
