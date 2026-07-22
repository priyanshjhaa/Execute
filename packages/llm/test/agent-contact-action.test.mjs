import assert from 'node:assert/strict';
import test from 'node:test';
import { isAgentContactActionType } from '../dist/agent-contact-action.js';

test('recognizes only Phase 11 contact action types', () => {
  assert.equal(isAgentContactActionType('contact.create'), true);
  assert.equal(isAgentContactActionType('contact.update'), true);
  assert.equal(isAgentContactActionType('contact.activate'), true);
  assert.equal(isAgentContactActionType('contact.deactivate'), true);
  assert.equal(isAgentContactActionType('form.create'), false);
});
