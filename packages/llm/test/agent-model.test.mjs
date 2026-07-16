import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentModelClient, AgentModelError } from '../dist/agent-model.js';

function completionResponse(content, usage = {}) {
  return {
    choices: [{ message: { content } }],
    usage: {
      prompt_tokens: usage.inputTokens ?? 12,
      completion_tokens: usage.outputTokens ?? 8,
    },
  };
}

function modelConfig(provider, model, create) {
  return {
    provider,
    model,
    client: { chat: { completions: { create } } },
  };
}

test('reports a configuration error when no provider is available', async () => {
  const client = new AgentModelClient('', '');

  await assert.rejects(
    client.complete([{ role: 'user', content: 'Hello' }]),
    (error) => error instanceof AgentModelError && error.code === 'NO_PROVIDERS',
  );
});

test('falls back to OpenRouter when Groq fails', async () => {
  const attempts = [];
  const client = new AgentModelClient('', '');
  client.models = [
    modelConfig('groq', 'fast-model', async () => {
      attempts.push('groq');
      throw new Error('provider unavailable');
    }),
    modelConfig('openrouter', 'fallback-model', async () => {
      attempts.push('openrouter');
      return completionResponse('Fallback response', { inputTokens: 21, outputTokens: 5 });
    }),
  ];

  const result = await client.complete([{ role: 'user', content: 'Hello' }]);

  assert.deepEqual(attempts, ['groq', 'openrouter']);
  assert.equal(result.content, 'Fallback response');
  assert.equal(result.provider, 'openrouter');
  assert.equal(result.model, 'fallback-model');
  assert.deepEqual(result.usage, { inputTokens: 21, outputTokens: 5 });
  assert.ok(result.latencyMs >= 0);
});

test('falls back when a provider returns an empty response', async () => {
  const client = new AgentModelClient('', '');
  client.models = [
    modelConfig('groq', 'empty-model', async () => completionResponse('   ')),
    modelConfig('openrouter', 'fallback-model', async () => completionResponse('Usable response')),
  ];

  const result = await client.complete([{ role: 'user', content: 'Hello' }]);

  assert.equal(result.content, 'Usable response');
  assert.equal(result.provider, 'openrouter');
});

test('clamps configured output tokens to the supported maximum', async () => {
  const originalValue = process.env.AGENT_MAX_OUTPUT_TOKENS;
  process.env.AGENT_MAX_OUTPUT_TOKENS = '5000';
  let request;

  try {
    const client = new AgentModelClient('', '');
    client.models = [
      modelConfig('groq', 'fast-model', async (input) => {
        request = input;
        return completionResponse('Done');
      }),
    ];

    await client.complete([{ role: 'user', content: 'Hello' }]);
    assert.equal(request.max_tokens, 1000);
  } finally {
    if (originalValue === undefined) {
      delete process.env.AGENT_MAX_OUTPUT_TOKENS;
    } else {
      process.env.AGENT_MAX_OUTPUT_TOKENS = originalValue;
    }
  }
});

test('reports all-provider failure without returning a partial response', async () => {
  const client = new AgentModelClient('', '');
  client.models = [
    modelConfig('groq', 'fast-model', async () => {
      throw new Error('first failure');
    }),
    modelConfig('openrouter', 'fallback-model', async () => {
      throw new Error('second failure');
    }),
  ];

  await assert.rejects(
    client.complete([{ role: 'user', content: 'Hello' }]),
    (error) => (
      error instanceof AgentModelError
      && error.code === 'ALL_PROVIDERS_FAILED'
      && error.message.includes('groq/fast-model')
      && error.message.includes('openrouter/fallback-model')
    ),
  );
});
