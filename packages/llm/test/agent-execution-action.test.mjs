import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAgentActionExecutionDisposition,
  isAgentExecutionActionType,
} from '../dist/agent-execution-action.js';

test('recognizes only Phase 9 execution action types', () => {
  assert.equal(isAgentExecutionActionType('workflow.run'), true);
  assert.equal(isAgentExecutionActionType('execution.cancel'), true);
  assert.equal(isAgentExecutionActionType('execution.retry'), true);
  assert.equal(isAgentExecutionActionType('workflow.create'), false);
});

test('allows only approved actions to be claimed for execution', () => {
  assert.equal(getAgentActionExecutionDisposition('approved'), 'claim');
  assert.equal(getAgentActionExecutionDisposition('executing'), 'in_progress');
  assert.equal(getAgentActionExecutionDisposition('completed'), 'settled');
  assert.equal(getAgentActionExecutionDisposition('failed'), 'settled');
  assert.equal(getAgentActionExecutionDisposition('pending'), 'unavailable');
  assert.equal(getAgentActionExecutionDisposition('rejected'), 'unavailable');
});
