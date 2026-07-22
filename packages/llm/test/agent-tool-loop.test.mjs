import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AgentToolLoopError,
  runAgentToolLoop,
} from '../dist/agent-tool-loop.js';

const tools = [{
  type: 'function',
  function: {
    name: 'get_execution',
    description: 'Get an execution',
    parameters: { type: 'object' },
  },
}];

test('executes tool calls and preserves streaming for the final answer', async () => {
  const requests = [];
  const executed = [];
  const deltas = [];
  const responses = [
    {
      content: '',
      toolCalls: [{ id: 'call_1', name: 'get_execution', arguments: '{"executionId":"one"}' }],
      provider: 'groq',
      model: 'tool-model',
      usage: { inputTokens: 10, outputTokens: 2 },
      latencyMs: 20,
    },
    {
      content: 'The execution failed because its token expired.',
      provider: 'groq',
      model: 'tool-model',
      usage: { inputTokens: 18, outputTokens: 9 },
      latencyMs: 30,
    },
  ];
  const modelClient = {
    async stream(messages, options) {
      requests.push({ messages, tools: options.tools });
      const response = responses.shift();
      if (!response.toolCalls) {
        await options.onDelta('The execution failed ');
        await options.onDelta('because its token expired.');
      }
      return response;
    },
  };

  const result = await runAgentToolLoop({
    messages: [{ role: 'user', content: 'Why did it fail?' }],
    modelClient,
    tools,
    onDelta: (delta) => deltas.push(delta),
    executeTool: async (toolCall) => {
      executed.push(toolCall);
      return { ok: true, execution: { status: 'failed', errorMessage: 'token expired' } };
    },
  });

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].tools, tools);
  assert.deepEqual(executed, [{ id: 'call_1', name: 'get_execution', arguments: '{"executionId":"one"}' }]);
  assert.equal(requests[1].messages[1].role, 'assistant');
  assert.deepEqual(requests[1].messages[1].toolCalls, executed);
  assert.equal(requests[1].messages[2].role, 'tool');
  assert.equal(requests[1].messages[2].toolCallId, 'call_1');
  assert.deepEqual(JSON.parse(requests[1].messages[2].content), {
    ok: true,
    execution: { status: 'failed', errorMessage: 'token expired' },
  });
  assert.deepEqual(deltas, ['The execution failed ', 'because its token expired.']);
  assert.equal(result.content, 'The execution failed because its token expired.');
  assert.deepEqual(result.usage, { inputTokens: 28, outputTokens: 11 });
  assert.equal(result.latencyMs, 50);
});

test('stops a model that repeatedly requests tools', async () => {
  const modelClient = {
    async stream() {
      return {
        content: '',
        toolCalls: [{ id: 'call', name: 'get_execution', arguments: '{}' }],
        provider: 'groq',
        model: 'tool-model',
        usage: { inputTokens: 1, outputTokens: 1 },
        latencyMs: 1,
      };
    },
  };

  await assert.rejects(
    runAgentToolLoop({
      messages: [{ role: 'user', content: 'Loop forever' }],
      modelClient,
      tools,
      onDelta: () => undefined,
      executeTool: async () => ({ ok: true }),
      maxRounds: 2,
    }),
    (error) => error instanceof AgentToolLoopError,
  );
});
