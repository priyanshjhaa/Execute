import assert from 'node:assert/strict';
import test from 'node:test';
import { isAgentFormActionType } from '../dist/agent-form-action.js';

test('recognizes only Phase 10 form action types', () => {
  assert.equal(isAgentFormActionType('form.create'), true);
  assert.equal(isAgentFormActionType('form.update'), true);
  assert.equal(isAgentFormActionType('form.activate'), true);
  assert.equal(isAgentFormActionType('form.deactivate'), true);
  assert.equal(isAgentFormActionType('form.link_workflow'), true);
  assert.equal(isAgentFormActionType('workflow.run'), false);
});
