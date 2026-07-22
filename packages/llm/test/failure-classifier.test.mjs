import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyExecutionFailure, sanitizeFailureEvidence } from '../dist/failure-classifier.js';

test('classifies authentication failures as high severity reconnect work', () => {
  const result = classifyExecutionFailure(['Slack returned invalid_auth']);
  assert.equal(result.category, 'authentication_or_permissions');
  assert.equal(result.severity, 'high');
  assert.equal(result.repairKind, 'reconnect_integration');
});

test('classifies transient failures as retry candidates', () => {
  assert.equal(classifyExecutionFailure(['request timed out']).repairKind, 'retry_execution');
  assert.equal(classifyExecutionFailure(['429 rate limit']).repairKind, 'retry_execution');
});

test('falls back to diagnosis without inventing an executable repair', () => {
  const result = classifyExecutionFailure(['unexpected step failure']);
  assert.equal(result.category, 'unknown');
  assert.equal(result.repairKind, 'diagnose_execution');
});

test('redacts credentials and bounds evidence before it is persisted', () => {
  const result = sanitizeFailureEvidence(`Bearer secret-token access_token=abc123 ${'x'.repeat(600)}`);
  assert.equal(result.includes('secret-token'), false);
  assert.equal(result.includes('abc123'), false);
  assert.equal(result.length, 500);
});
