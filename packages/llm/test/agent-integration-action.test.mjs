import assert from 'node:assert/strict';
import test from 'node:test';
import { isAgentIntegrationActionType } from '../dist/agent-integration-action.js';

test('recognizes only integration action types', () => {
  assert.equal(isAgentIntegrationActionType('integration.disconnect'), true);
  assert.equal(isAgentIntegrationActionType('integration.connect'), false);
  assert.equal(isAgentIntegrationActionType('contact.deactivate'), false);
});
