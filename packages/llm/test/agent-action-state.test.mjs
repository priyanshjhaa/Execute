import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentActionDecisionStatus } from '../dist/agent-action-state.js';

test('maps pending action decisions to terminal decision states', () => {
  assert.equal(getAgentActionDecisionStatus('pending', 'approve'), 'approved');
  assert.equal(getAgentActionDecisionStatus('pending', 'reject'), 'rejected');
});

test('does not allow an action that is no longer pending to be decided again', () => {
  for (const status of ['approved', 'rejected', 'expired', 'executing', 'completed', 'failed']) {
    assert.equal(getAgentActionDecisionStatus(status, 'approve'), null);
    assert.equal(getAgentActionDecisionStatus(status, 'reject'), null);
  }
});
