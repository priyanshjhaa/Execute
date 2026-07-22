import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkflowParser } from '../dist/parser.js';

function parsedWorkflowResponse() {
  return {
    choices: [{
      message: {
        content: JSON.stringify({
          success: true,
          workflow: {
            name: 'Webhook notification',
            description: 'Notify the team after a webhook arrives.',
            steps: [{
              id: '11111111-1111-4111-8111-111111111111',
              type: 'webhook',
              name: 'Receive webhook',
              config: {},
              position: 0,
            }],
            triggerStepId: '11111111-1111-4111-8111-111111111111',
          },
        }),
      },
    }],
  };
}

test('reuses the workflow parser with an abort signal and normalizes step IDs', async () => {
  const parser = new WorkflowParser('', '');
  const controller = new AbortController();
  let requestOptions;
  parser.models = [{
    provider: 'groq',
    model: 'workflow-model',
    client: {
      chat: {
        completions: {
          async create(_request, options) {
            requestOptions = options;
            return parsedWorkflowResponse();
          },
        },
      },
    },
  }];

  const result = await parser.parseInstruction(
    { instruction: 'Create a webhook notification workflow', userId: 'user-1' },
    { signal: controller.signal },
  );

  assert.equal(requestOptions.signal, controller.signal);
  assert.equal(result.success, true);
  assert.notEqual(result.workflow.steps[0].id, '11111111-1111-4111-8111-111111111111');
  assert.equal(result.workflow.triggerStepId, result.workflow.steps[0].id);
});

test('stops workflow parsing immediately when the turn is cancelled', async () => {
  const parser = new WorkflowParser('', '');
  const controller = new AbortController();
  controller.abort();
  let attempts = 0;
  parser.models = [{
    provider: 'groq',
    model: 'workflow-model',
    client: {
      chat: {
        completions: {
          async create() {
            attempts += 1;
            return parsedWorkflowResponse();
          },
        },
      },
    },
  }];

  await assert.rejects(
    parser.parseInstruction(
      { instruction: 'Create a webhook notification workflow', userId: 'user-1' },
      { signal: controller.signal },
    ),
    /cancelled/,
  );
  assert.equal(attempts, 0);
});
