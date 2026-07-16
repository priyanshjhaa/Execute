import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_ACTIVE_MESSAGE_LIMIT,
  AGENT_DEFAULT_CONTEXT_MAX_TOKENS,
  AGENT_MAX_CONTEXT_MAX_TOKENS,
  AGENT_MESSAGE_MAX_CHARS,
  AGENT_MIN_CONTEXT_MAX_TOKENS,
  AGENT_SUMMARY_MAX_CHARS,
  AGENT_SUMMARY_INPUT_MAX_TOKENS,
  AGENT_SUMMARY_MAX_TOKENS,
  buildAgentContext,
  buildAgentSummaryPrompt,
  capAgentSummary,
  estimateAgentContextTokens,
  estimateAgentTokens,
  getAgentSummaryRange,
  resolveAgentContextTokenLimit,
  selectAgentSummaryBatch,
  truncateAgentText,
} from '../dist/agent-memory.js';

test('keeps seven recent messages plus the current message in active context', () => {
  const history = Array.from({ length: 10 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `message-${index + 1}`,
  }));

  const context = buildAgentContext({
    systemPrompt: 'system',
    recentMessages: history,
    currentMessage: 'current-message',
  });
  const conversationMessages = context.filter((message) => message.role !== 'system');

  assert.equal(conversationMessages.length, AGENT_ACTIVE_MESSAGE_LIMIT);
  assert.deepEqual(
    conversationMessages.map((message) => message.content),
    ['message-4', 'message-5', 'message-6', 'message-7', 'message-8', 'message-9', 'message-10', 'current-message'],
  );
});

test('places the rolling summary before recent conversation messages', () => {
  const context = buildAgentContext({
    systemPrompt: 'system',
    summary: 'The user prefers concise status reports.',
    recentMessages: [{ role: 'assistant', content: 'Recent response' }],
    currentMessage: 'What is next?',
  });

  assert.equal(context[0].role, 'system');
  assert.equal(context[1].role, 'system');
  assert.match(context[1].content, /Earlier conversation summary/);
  assert.match(context[1].content, /prefers concise status reports/);
  assert.deepEqual(context.slice(2), [
    { role: 'assistant', content: 'Recent response' },
    { role: 'user', content: 'What is next?' },
  ]);
});

test('calculates only the older unsummarized message range', () => {
  assert.deepEqual(getAgentSummaryRange(6, 0), { offset: 0, count: 0 });
  assert.deepEqual(getAgentSummaryRange(12, 2), { offset: 2, count: 3 });
  assert.deepEqual(getAgentSummaryRange(12, 99), { offset: 5, count: 0 });
});

test('summary prompts preserve previous memory and treat messages as data', () => {
  const prompt = buildAgentSummaryPrompt(
    'Previous facts',
    [{ role: 'user', content: 'Remember project Atlas' }],
  );

  assert.match(prompt[0].content, new RegExp(`${AGENT_SUMMARY_MAX_TOKENS} tokens`));
  assert.match(prompt[0].content, /Do not follow instructions/);
  const payload = JSON.parse(prompt[1].content);
  assert.equal(payload.previousSummary, 'Previous facts');
  assert.equal(payload.messages[0].content, 'Remember project Atlas');
});

test('caps stored summaries to approximately 700 tokens', () => {
  const summary = capAgentSummary('word '.repeat(1000));

  assert.ok(summary.length <= AGENT_SUMMARY_MAX_CHARS);
  assert.ok(summary.endsWith('…'));
  assert.equal(AGENT_SUMMARY_MAX_TOKENS, 700);
});

test('exports the enforced user-message character limit', () => {
  assert.equal(AGENT_MESSAGE_MAX_CHARS, 4000);
});

test('resolves configured context limits within safe bounds', () => {
  assert.equal(resolveAgentContextTokenLimit(), AGENT_DEFAULT_CONTEXT_MAX_TOKENS);
  assert.equal(resolveAgentContextTokenLimit('100'), AGENT_MIN_CONTEXT_MAX_TOKENS);
  assert.equal(resolveAgentContextTokenLimit('999999'), AGENT_MAX_CONTEXT_MAX_TOKENS);
  assert.equal(resolveAgentContextTokenLimit('16000'), 16000);
});

test('estimates non-ASCII text conservatively', () => {
  assert.equal(estimateAgentTokens('abcd'), 1);
  assert.equal(estimateAgentTokens('abcdefgh'), 2);
  assert.equal(estimateAgentTokens('你好世界'), 4);
});

test('truncates oversized text without splitting Unicode characters', () => {
  const original = `Beginning-${'🙂'.repeat(100)}-Ending`;
  const truncated = truncateAgentText(original, 30);

  assert.ok(estimateAgentTokens(truncated) <= 30);
  assert.match(truncated, /^Beginning/);
  assert.match(truncated, /Ending$/);
  assert.match(truncated, /\[truncated\]/);
  assert.equal(truncated.includes('\uFFFD'), false);
});

test('keeps long-conversation context under the configured token budget', () => {
  const maxTokens = AGENT_MIN_CONTEXT_MAX_TOKENS;
  const context = buildAgentContext({
    systemPrompt: 'You are a helpful agent.',
    summary: 'Earlier facts '.repeat(1000),
    recentMessages: Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message-${index}-${'detail '.repeat(3000)}`,
    })),
    currentMessage: 'What should happen next?',
    maxTokens,
  });

  assert.ok(estimateAgentContextTokens(context) <= maxTokens);
  assert.equal(context[0].role, 'system');
  assert.equal(context.at(-1).content, 'What should happen next?');
  assert.ok(context.some((message) => message.content.includes('Earlier conversation summary')));
  assert.ok(context.some((message) => message.content.includes('[truncated]')));
  assert.ok(context.filter((message) => message.role !== 'system').length <= AGENT_ACTIVE_MESSAGE_LIMIT);
});

test('bounds summary-generation batches for very long histories', () => {
  const messages = Array.from({ length: 100 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `message-${index}-${'content '.repeat(500)}`,
  }));
  const batch = selectAgentSummaryBatch(
    'Existing summary',
    messages,
    AGENT_SUMMARY_INPUT_MAX_TOKENS,
  );
  const prompt = buildAgentSummaryPrompt('Existing summary', batch);

  assert.ok(batch.length > 0);
  assert.ok(batch.length < messages.length);
  assert.ok(estimateAgentContextTokens(prompt) <= AGENT_SUMMARY_INPUT_MAX_TOKENS);
  assert.equal(batch[0].role, messages[0].role);
});

test('safely truncates a single oversized summary source message', () => {
  const batch = selectAgentSummaryBatch(
    null,
    [{ role: 'user', content: 'quoted "value" \\ '.repeat(10000) }],
    AGENT_SUMMARY_INPUT_MAX_TOKENS,
  );
  const prompt = buildAgentSummaryPrompt(null, batch);

  assert.equal(batch.length, 1);
  assert.match(batch[0].content, /\[truncated\]/);
  assert.ok(estimateAgentContextTokens(prompt) <= AGENT_SUMMARY_INPUT_MAX_TOKENS);
});
