import assert from 'node:assert/strict';
import test from 'node:test';
import { isAgentQuickActionType } from '../dist/agent-quick-action.js';
import { isAgentWorkflowActionType } from '../dist/agent-workflow-action.js';

test('recognizes only executable agent workflow definition actions', () => {
  assert.equal(isAgentWorkflowActionType('workflow.create'), true);
  assert.equal(isAgentWorkflowActionType('workflow.update'), true);
  assert.equal(isAgentWorkflowActionType('workflow.run'), false);
  assert.equal(isAgentWorkflowActionType('workflow.delete'), false);
});

test('recognizes only approved quick-action mutations', () => {
  assert.equal(isAgentQuickActionType('event.log'), true);
  assert.equal(isAgentQuickActionType('email.send'), true);
  assert.equal(isAgentQuickActionType('event.query'), false);
  assert.equal(isAgentQuickActionType('email.send_without_approval'), false);
});
