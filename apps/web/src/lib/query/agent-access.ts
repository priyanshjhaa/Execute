export interface AgentFeatureAccess {
  agent: boolean;
  monitor: boolean;
  releaseMode?: 'disabled' | 'internal' | 'general';
}

export async function fetchAgentFeatureAccess(): Promise<AgentFeatureAccess> {
  const response = await fetch('/api/agent/access', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Agent access check failed (${response.status})`);
  }
  return response.json();
}
