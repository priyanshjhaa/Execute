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

function modelConfig(provider, model, create, tier = 'fast') {
  return {
    provider,
    model,
    tier,
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
  assert.equal(result.tier, 'fast');
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

test('supports a bounded completion-token override for summaries', async () => {
  let request;
  const client = new AgentModelClient('', '');
  client.models = [
    modelConfig('groq', 'summary-model', async (input) => {
      request = input;
      return completionResponse('Summary');
    }),
  ];

  await client.complete(
    [{ role: 'user', content: 'Summarize' }],
    { maxOutputTokens: 700 },
  );

  assert.equal(request.max_tokens, 700);
});

test('aborts a non-streaming completion used for summary generation', async () => {
  const abortController = new AbortController();
  abortController.abort();
  let attempts = 0;
  const client = new AgentModelClient('', '');
  client.models = [
    modelConfig('groq', 'summary-model', async () => {
      attempts += 1;
      return completionResponse('Summary');
    }),
  ];

  await assert.rejects(
    client.complete(
      [{ role: 'user', content: 'Summarize' }],
      { signal: abortController.signal },
    ),
    (error) => error.name === 'AgentModelAbortError',
  );
  assert.equal(attempts, 0);
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

test('streams provider deltas and returns the completed response metadata', async () => {
  const deltas = [];
  const abortController = new AbortController();
  let receivedSignal;
  const client = new AgentModelClient('', '');
  client.models = [
    modelConfig('openrouter', 'stream-model', async (_input, options) => {
      receivedSignal = options.signal;
      return (async function* streamChunks() {
        yield { choices: [{ delta: { content: 'Hello ' } }], usage: null };
        yield { choices: [{ delta: { content: 'world' } }], usage: null };
        yield {
          choices: [],
          usage: { prompt_tokens: 9, completion_tokens: 2 },
        };
      }());
    }),
  ];

  const result = await client.stream(
    [{ role: 'user', content: 'Hello' }],
    {
      signal: abortController.signal,
      onDelta: (delta) => deltas.push(delta),
    },
  );

  assert.equal(receivedSignal, abortController.signal);
  assert.deepEqual(deltas, ['Hello ', 'world']);
  assert.equal(result.content, 'Hello world');
  assert.equal(result.provider, 'openrouter');
  assert.deepEqual(result.usage, { inputTokens: 9, outputTokens: 2 });
  assert.equal(result.tier, 'fast');
});

test('records call-level provider, model, usage, latency, purpose, and tier', async () => {
  const calls = [];
  const client = new AgentModelClient('', '', { onCallComplete: (call) => calls.push(call) });
  client.models = [modelConfig('groq', 'summary-model', async () => completionResponse('Summary', { inputTokens: 17, outputTokens: 4 }))];
  await client.complete([{ role: 'user', content: 'Summarize' }], { purpose: 'summary' });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].usage, { inputTokens: 17, outputTokens: 4 });
  assert.equal(calls[0].provider, 'groq');
  assert.equal(calls[0].model, 'summary-model');
  assert.equal(calls[0].purpose, 'summary');
  assert.equal(calls[0].tier, 'fast');
  assert.ok(calls[0].latencyMs >= 0);
});

test('tries the reasoning model only when the reasoning tier is requested', async () => {
  const attempts = [];
  const client = new AgentModelClient('', '');
  client.models = [modelConfig('groq', 'fast-model', async () => {
    attempts.push('fast');
    return completionResponse('Fast');
  })];
  client.reasoningModel = modelConfig('openrouter', 'reasoning-model', async () => {
    attempts.push('reasoning');
    return completionResponse('Reasoned');
  }, 'reasoning');

  const fast = await client.complete([{ role: 'user', content: 'List workflows' }]);
  const reasoned = await client.complete([{ role: 'user', content: 'Analyze architecture' }], { tier: 'reasoning' });
  assert.equal(fast.model, 'fast-model');
  assert.equal(reasoned.model, 'reasoning-model');
  assert.equal(reasoned.tier, 'reasoning');
  assert.deepEqual(attempts, ['fast', 'reasoning']);
});

test('collects streamed tool-call fragments without requiring visible content', async () => {
  let request;
  const tools = [{
    type: 'function',
    function: {
      name: 'get_execution',
      description: 'Get an execution',
      parameters: { type: 'object' },
    },
  }];
  const client = new AgentModelClient('', '');
  client.models = [
    modelConfig('groq', 'tool-model', async (input) => {
      request = input;
      return (async function* streamChunks() {
        yield {
          choices: [{ delta: { tool_calls: [{
            index: 0,
            id: 'call_123',
            function: { name: 'get_', arguments: '{"execution' },
          }] } }],
        };
        yield {
          choices: [{ delta: { tool_calls: [{
            index: 0,
            function: { name: 'execution', arguments: 'Id":"00000000-0000-0000-0000-000000000001"}' },
          }] } }],
        };
      }());
    }),
  ];

  const result = await client.stream(
    [{ role: 'user', content: 'Inspect it' }],
    { tools, onDelta: () => assert.fail('tool calls must not emit text deltas') },
  );

  assert.deepEqual(request.tools, tools);
  assert.equal(result.content, '');
  assert.deepEqual(result.toolCalls, [{
    id: 'call_123',
    name: 'get_execution',
    arguments: '{"executionId":"00000000-0000-0000-0000-000000000001"}',
  }]);
});

test('falls back during streaming only before the first delta', async () => {
  const attempts = [];
  const deltas = [];
  const client = new AgentModelClient('', '');
  client.models = [
    modelConfig('groq', 'unavailable-model', async () => {
      attempts.push('groq');
      throw new Error('connection failed');
    }),
    modelConfig('openrouter', 'stream-model', async () => {
      attempts.push('openrouter');
      return (async function* streamChunks() {
        yield { choices: [{ delta: { content: 'Fallback' } }], usage: null };
      }());
    }),
  ];

  const result = await client.stream(
    [{ role: 'user', content: 'Hello' }],
    { onDelta: (delta) => deltas.push(delta) },
  );

  assert.deepEqual(attempts, ['groq', 'openrouter']);
  assert.deepEqual(deltas, ['Fallback']);
  assert.equal(result.content, 'Fallback');
});

test('does not splice a fallback response after streaming has started', async () => {
  let fallbackAttempts = 0;
  const client = new AgentModelClient('', '');
  client.models = [
    modelConfig('groq', 'partial-model', async () => (
      async function* streamChunks() {
        yield { choices: [{ delta: { content: 'Partial' } }] };
        throw new Error('stream interrupted');
      }()
    )),
    modelConfig('openrouter', 'fallback-model', async () => {
      fallbackAttempts += 1;
      return (async function* streamChunks() {
        yield { choices: [{ delta: { content: 'Different answer' } }] };
      }());
    }),
  ];

  await assert.rejects(
    client.stream(
      [{ role: 'user', content: 'Hello' }],
      { onDelta: () => undefined },
    ),
    (error) => error instanceof AgentModelError && error.code === 'ALL_PROVIDERS_FAILED',
  );
  assert.equal(fallbackAttempts, 0);
});

test('aborts an active model stream', async () => {
  const abortController = new AbortController();
  const deltas = [];
  const client = new AgentModelClient('', '');
  client.models = [
    modelConfig('groq', 'stream-model', async () => (
      async function* streamChunks() {
        yield { choices: [{ delta: { content: 'First' } }] };
        yield { choices: [{ delta: { content: 'Second' } }] };
      }()
    )),
  ];

  await assert.rejects(
    client.stream(
      [{ role: 'user', content: 'Hello' }],
      {
        signal: abortController.signal,
        onDelta: (delta) => {
          deltas.push(delta);
          abortController.abort();
        },
      },
    ),
    (error) => error.name === 'AgentModelAbortError',
  );
  assert.deepEqual(deltas, ['First']);
});
