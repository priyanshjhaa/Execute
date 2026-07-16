import { and, asc, count, desc, eq } from 'drizzle-orm';
import { agentMessages, agentThreads, db } from '@execute/db';
import {
  AGENT_RECENT_HISTORY_LIMIT,
  AGENT_SUMMARY_BATCH_MESSAGE_LIMIT,
  AGENT_SUMMARY_INPUT_MAX_TOKENS,
  AGENT_SUMMARY_MAX_TOKENS,
  AgentModelAbortError,
  type AgentModelClient,
  buildAgentContext,
  buildAgentSummaryPrompt,
  capAgentSummary,
  getAgentSummaryRange,
  resolveAgentContextTokenLimit,
  selectAgentSummaryBatch,
} from '@execute/llm';

interface PrepareAgentContextInput {
  thread: typeof agentThreads.$inferSelect | undefined;
  userId: string;
  currentMessage: string;
  systemPrompt: string;
  modelClient: AgentModelClient;
  signal?: AbortSignal;
}

function messageText(content: Array<{ type: 'text'; text: string }>): string {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export async function prepareAgentContext(input: PrepareAgentContextInput) {
  const maxContextTokens = resolveAgentContextTokenLimit(
    process.env.AGENT_MAX_CONTEXT_TOKENS,
  );

  if (!input.thread) {
    return buildAgentContext({
      systemPrompt: input.systemPrompt,
      recentMessages: [],
      currentMessage: input.currentMessage,
      maxTokens: maxContextTokens,
    });
  }

  const [recentRows, totalRows] = await Promise.all([
    db.select({
      id: agentMessages.id,
      role: agentMessages.role,
      content: agentMessages.content,
      createdAt: agentMessages.createdAt,
    })
      .from(agentMessages)
      .where(and(
        eq(agentMessages.threadId, input.thread.id),
        eq(agentMessages.userId, input.userId),
      ))
      .orderBy(desc(agentMessages.createdAt), desc(agentMessages.id))
      .limit(AGENT_RECENT_HISTORY_LIMIT),
    db.select({ value: count() })
      .from(agentMessages)
      .where(and(
        eq(agentMessages.threadId, input.thread.id),
        eq(agentMessages.userId, input.userId),
      )),
  ]);

  const totalMessages = totalRows[0]?.value || 0;
  const summaryRange = getAgentSummaryRange(
    totalMessages,
    input.thread.summaryMessageCount,
  );
  const summarizedMessageCount = summaryRange.offset;
  const messagesToSummarize = summaryRange.count;
  let summary = input.thread.summary ? capAgentSummary(input.thread.summary) : null;

  if (messagesToSummarize > 0) {
    const summaryRows = await db.select({
      role: agentMessages.role,
      content: agentMessages.content,
    })
      .from(agentMessages)
      .where(and(
        eq(agentMessages.threadId, input.thread.id),
        eq(agentMessages.userId, input.userId),
      ))
      .orderBy(asc(agentMessages.createdAt), asc(agentMessages.id))
      .offset(summarizedMessageCount)
      .limit(Math.min(messagesToSummarize, AGENT_SUMMARY_BATCH_MESSAGE_LIMIT));

    const summaryBatch = selectAgentSummaryBatch(
      summary,
      summaryRows.map((message) => ({
        role: message.role,
        content: messageText(message.content),
      })),
      AGENT_SUMMARY_INPUT_MAX_TOKENS,
    );

    try {
      if (summaryBatch.length === 0) {
        throw new Error('No conversation history fits within the summary input budget');
      }
      const summaryResponse = await input.modelClient.complete(
        buildAgentSummaryPrompt(summary, summaryBatch),
        {
          signal: input.signal,
          maxOutputTokens: AGENT_SUMMARY_MAX_TOKENS,
        },
      );
      const nextSummary = capAgentSummary(summaryResponse.content);
      const nextSummaryMessageCount = summarizedMessageCount + summaryBatch.length;
      const summaryUpdatedAt = new Date();

      const [updatedThread] = await db.update(agentThreads)
        .set({
          summary: nextSummary,
          summaryMessageCount: nextSummaryMessageCount,
          summaryUpdatedAt,
        })
        .where(and(
          eq(agentThreads.id, input.thread.id),
          eq(agentThreads.userId, input.userId),
          eq(agentThreads.summaryMessageCount, input.thread.summaryMessageCount),
        ))
        .returning({ summary: agentThreads.summary });

      if (updatedThread) {
        summary = nextSummary;
      } else {
        const [currentThread] = await db.select({ summary: agentThreads.summary })
          .from(agentThreads)
          .where(and(
            eq(agentThreads.id, input.thread.id),
            eq(agentThreads.userId, input.userId),
          ))
          .limit(1);
        summary = currentThread?.summary ? capAgentSummary(currentThread.summary) : summary;
      }
    } catch (error) {
      if (error instanceof AgentModelAbortError || input.signal?.aborted) {
        throw new AgentModelAbortError();
      }
      // Summary generation is useful context, but a transient summary failure
      // should not prevent the user from receiving a response using recent history.
      console.error('Agent summary update error:', error);
    }
  }

  const recentMessages = recentRows
    .reverse()
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: messageText(message.content),
    }));

  return buildAgentContext({
    systemPrompt: input.systemPrompt,
    summary,
    recentMessages,
    currentMessage: input.currentMessage,
    maxTokens: maxContextTokens,
  });
}
