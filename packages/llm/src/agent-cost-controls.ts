export type AgentModelTier = 'fast' | 'reasoning';

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

export function resolveAgentDailyTokenLimit(value = process.env.AGENT_DAILY_TOKEN_LIMIT) {
  return boundedInteger(value, 100_000, 10_000, 10_000_000);
}

export function resolveAgentDailyRequestLimit(value = process.env.AGENT_DAILY_REQUEST_LIMIT) {
  return boundedInteger(value, 200, 10, 10_000);
}

export function resolveWorkspaceContextCacheTtlSeconds(value = process.env.AGENT_WORKSPACE_CACHE_TTL_SECONDS) {
  return boundedInteger(value, 300, 30, 3_600);
}

export function getAgentDailyLimitStatus(
  usage: { totalTokens: number; requests: number },
  limits = { tokens: resolveAgentDailyTokenLimit(), requests: resolveAgentDailyRequestLimit() },
): 'tokens' | 'requests' | null {
  if (usage.totalTokens >= limits.tokens) return 'tokens';
  if (usage.requests >= limits.requests) return 'requests';
  return null;
}

export function selectAgentModelTier(message: string, reasoningModelAvailable: boolean): AgentModelTier {
  if (!reasoningModelAvailable) return 'fast';
  const normalized = message.toLowerCase();
  let complexity = 0;
  if (message.length >= 1_200) complexity += 1;
  if (/\b(root cause|deep analysis|architecture|trade-?offs?|multi-?step|migration plan|refactor strategy)\b/.test(normalized)) complexity += 2;
  if (/\b(compare|evaluate|diagnose|redesign|optimize)\b/.test(normalized)) complexity += 1;
  if (/\b(workflow|execution|integration|system)\b/.test(normalized) && /\b(across|multiple|several|end-to-end)\b/.test(normalized)) complexity += 1;
  return complexity >= 2 ? 'reasoning' : 'fast';
}
