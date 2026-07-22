import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_ACTION_DEFAULT_TTL_MINUTES,
  AGENT_ACTION_MAX_TTL_MINUTES,
  AGENT_ACTION_MIN_TTL_MINUTES,
  getAgentActionDecisionStatus,
  getAgentActionDecisionTransition,
  resolveAgentActionTtlMinutes,
} from '../dist/agent-action-state.js';

test('maps pending action decisions to terminal decision states', () => {
  assert.equal(getAgentActionDecisionStatus('pending', 'approve'), 'approved');
  assert.equal(getAgentActionDecisionStatus('pending', 'reject'), 'rejected');
});

test('treats repeating the same decision as idempotent and rejects the opposite decision', () => {
  assert.deepEqual(
    getAgentActionDecisionTransition('approved', 'approve'),
    { kind: 'already_applied', status: 'approved' },
  );
  assert.deepEqual(
    getAgentActionDecisionTransition('rejected', 'reject'),
    { kind: 'already_applied', status: 'rejected' },
  );
  assert.deepEqual(getAgentActionDecisionTransition('approved', 'reject'), { kind: 'conflict' });
  assert.deepEqual(getAgentActionDecisionTransition('expired', 'approve'), { kind: 'conflict' });
});

test('resolves configurable action expiry within safe bounds', () => {
  assert.equal(resolveAgentActionTtlMinutes(), AGENT_ACTION_DEFAULT_TTL_MINUTES);
  assert.equal(resolveAgentActionTtlMinutes('1'), AGENT_ACTION_MIN_TTL_MINUTES);
  assert.equal(resolveAgentActionTtlMinutes('999999'), AGENT_ACTION_MAX_TTL_MINUTES);
  assert.equal(resolveAgentActionTtlMinutes('120'), 120);
});

test('does not allow an action that is no longer pending to be decided again', () => {
  for (const status of ['approved', 'rejected', 'expired', 'executing', 'completed', 'failed']) {
    assert.equal(getAgentActionDecisionStatus(status, 'approve'), null);
    assert.equal(getAgentActionDecisionStatus(status, 'reject'), null);
  }
});
