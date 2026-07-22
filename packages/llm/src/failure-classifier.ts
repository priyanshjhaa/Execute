export type FailureCategory =
  | 'authentication_or_permissions'
  | 'rate_limit_or_quota'
  | 'network_or_timeout'
  | 'invalid_input'
  | 'missing_resource_or_configuration'
  | 'unknown';

export interface FailureClassification {
  category: FailureCategory;
  severity: 'high' | 'medium';
  summary: string;
  repairKind: 'retry_execution' | 'reconnect_integration' | 'review_workflow' | 'diagnose_execution';
  repairLabel: string;
  repairDescription: string;
}

export function sanitizeFailureEvidence(message: string): string {
  return message
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(api[_-]?key|access[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/https?:\/\/[^\s]*[?&](?:token|key|secret)=[^\s&]+/gi, '[REDACTED URL]')
    .slice(0, 500);
}

export function classifyExecutionFailure(messages: string[]): FailureClassification {
  const combined = messages.join(' ').toLowerCase();
  if (/unauthori[sz]ed|forbidden|permission|credential|api key|token expired|invalid_auth/.test(combined)) {
    return {
      category: 'authentication_or_permissions', severity: 'high',
      summary: 'The provider rejected the workflow credentials or permissions.',
      repairKind: 'reconnect_integration', repairLabel: 'Review integration access',
      repairDescription: 'Inspect the connected provider and guide me through reconnecting it before retrying this execution.',
    };
  }
  if (/rate.?limit|too many requests|\b429\b|quota/.test(combined)) {
    return {
      category: 'rate_limit_or_quota', severity: 'medium',
      summary: 'The provider rate limit or quota interrupted this execution.',
      repairKind: 'retry_execution', repairLabel: 'Review retry',
      repairDescription: 'Check the failure details and prepare a retry proposal if the provider can accept requests again.',
    };
  }
  if (/timeout|timed out|network|connection|dns|socket|\b5\d\d\b/.test(combined)) {
    return {
      category: 'network_or_timeout', severity: 'medium',
      summary: 'A provider or network interruption stopped this execution.',
      repairKind: 'retry_execution', repairLabel: 'Review retry',
      repairDescription: 'Diagnose the transient failure and prepare a retry proposal if it is safe.',
    };
  }
  if (/invalid|required|validation|malformed|bad request|\b400\b/.test(combined)) {
    return {
      category: 'invalid_input', severity: 'high',
      summary: 'A workflow step received input the provider could not accept.',
      repairKind: 'review_workflow', repairLabel: 'Review workflow inputs',
      repairDescription: 'Inspect the failed step and propose a workflow change that corrects its input mapping.',
    };
  }
  if (/not found|missing|configuration|not configured|\b404\b/.test(combined)) {
    return {
      category: 'missing_resource_or_configuration', severity: 'high',
      summary: 'The workflow references a missing resource or configuration.',
      repairKind: 'review_workflow', repairLabel: 'Review configuration',
      repairDescription: 'Inspect the failed step and propose a workflow change for the missing resource or configuration.',
    };
  }
  return {
    category: 'unknown', severity: 'medium',
    summary: 'The execution failed and needs a closer diagnosis.',
    repairKind: 'diagnose_execution', repairLabel: 'Diagnose failure',
    repairDescription: 'Inspect the execution logs, explain the likely cause, and propose a safe next step.',
  };
}
