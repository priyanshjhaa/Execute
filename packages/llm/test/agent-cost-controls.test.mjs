import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveAgentDailyRequestLimit,
  resolveAgentDailyTokenLimit,
  resolveWorkspaceContextCacheTtlSeconds,
  getAgentDailyLimitStatus,
  selectAgentModelTier,
} from '../dist/agent-cost-controls.js';

test('keeps ordinary requests on the fast tier', () => {
  assert.equal(selectAgentModelTier('List my active workflows', true), 'fast');
  assert.equal(selectAgentModelTier('Diagnose this execution', true), 'fast');
});

test('uses reasoning only for explicit complex work when configured', () => {
  assert.equal(selectAgentModelTier('Perform a deep analysis of the root cause across multiple workflow failures', true), 'reasoning');
  assert.equal(selectAgentModelTier('Perform a deep analysis of the root cause', false), 'fast');
});

test('bounds cost-control configuration', () => {
  assert.equal(resolveAgentDailyTokenLimit('1'), 10_000);
  assert.equal(resolveAgentDailyRequestLimit('999999'), 10_000);
  assert.equal(resolveWorkspaceContextCacheTtlSeconds('5'), 30);
});

test('enforces token and request ceilings at the configured boundary', () => {
  assert.equal(getAgentDailyLimitStatus({ totalTokens: 99, requests: 2 }, { tokens: 100, requests: 3 }), null);
  assert.equal(getAgentDailyLimitStatus({ totalTokens: 100, requests: 0 }, { tokens: 100, requests: 3 }), 'tokens');
  assert.equal(getAgentDailyLimitStatus({ totalTokens: 0, requests: 3 }, { tokens: 100, requests: 3 }), 'requests');
});
