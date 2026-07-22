export const AGENT_CONTACT_ACTION_TYPES = [
  'contact.create',
  'contact.update',
  'contact.activate',
  'contact.deactivate',
] as const;

export type AgentContactActionType = typeof AGENT_CONTACT_ACTION_TYPES[number];

export function isAgentContactActionType(value: string): value is AgentContactActionType {
  return (AGENT_CONTACT_ACTION_TYPES as readonly string[]).includes(value);
}
