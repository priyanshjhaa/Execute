import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_ACTIVE_MESSAGE_LIMIT,
  AGENT_MESSAGE_MAX_CHARS,
  AGENT_SUMMARY_MAX_CHARS,
  AGENT_SUMMARY_MAX_TOKENS,
  buildAgentContext,
  buildAgentSummaryPrompt,
  capAgentSummary,
  getAgentSummaryRange,
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
