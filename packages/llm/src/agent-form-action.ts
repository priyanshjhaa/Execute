export const AGENT_FORM_ACTION_TYPES = [
  'form.create',
  'form.update',
  'form.activate',
  'form.deactivate',
  'form.link_workflow',
] as const;

export type AgentFormActionType = typeof AGENT_FORM_ACTION_TYPES[number];

export function isAgentFormActionType(value: string): value is AgentFormActionType {
  return (AGENT_FORM_ACTION_TYPES as readonly string[]).includes(value);
}
