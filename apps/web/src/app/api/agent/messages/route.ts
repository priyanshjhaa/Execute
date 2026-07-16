import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { agentMessages, agentThreads, db, users } from '@execute/db';
import { AgentModelError, createAgentModelClient } from '@execute/llm';
import { createClient } from '@/lib/supabase/server';

const AgentMessageRequestSchema = z.object({
  threadId: z.string().uuid().optional(),
  message: z.string().trim().min(1, 'Message is required').max(4000, 'Message is too long'),
});

const AGENT_SYSTEM_PROMPT = `You are Execute Agent, the assistant for a workflow automation product.
Respond clearly and concisely. You can explain workflows, forms, schedules, executions, contacts, and integrations.
You do not have workspace tools in this version. Never claim that you inspected data, changed configuration, or executed an action.
If the user asks you to perform an action, explain that workspace actions will be available in a later phase.`;

function buildThreadTitle(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [internalUser] = await db.select()
      .from(users)
      .where(eq(users.supabaseId, user.id))
      .limit(1);

    if (!internalUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const requestBody = await request.json().catch(() => null);
    const input = AgentMessageRequestSchema.parse(requestBody);
    let ownedThread: typeof agentThreads.$inferSelect | undefined;

    if (input.threadId) {
      [ownedThread] = await db.select()
        .from(agentThreads)
        .where(and(
          eq(agentThreads.id, input.threadId),
          eq(agentThreads.userId, internalUser.id),
        ))
        .limit(1);

      if (!ownedThread) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
    }

    const modelClient = createAgentModelClient();
    const modelResponse = await modelClient.complete([
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      { role: 'user', content: input.message },
    ]);

    // Do not leave an empty thread or an unmatched user message when a model
    // provider fails. Once a response exists, persist the complete exchange in
    // one transaction so database failures cannot save only half of a turn.
    const completedAt = new Date();
    const persisted = await db.transaction(async (tx) => {
      let thread = ownedThread;

      if (!thread) {
        [thread] = await tx.insert(agentThreads)
          .values({
            userId: internalUser.id,
            title: buildThreadTitle(input.message),
          })
          .returning();
      }

      if (!thread) {
        throw new Error('Failed to create agent thread');
      }

      const [userMessage] = await tx.insert(agentMessages)
        .values({
          threadId: thread.id,
          userId: internalUser.id,
          role: 'user',
          content: [{ type: 'text', text: input.message }],
        })
        .returning();

      const [assistantMessage] = await tx.insert(agentMessages)
        .values({
          threadId: thread.id,
          userId: internalUser.id,
          role: 'assistant',
          content: [{ type: 'text', text: modelResponse.content }],
          provider: modelResponse.provider,
          model: modelResponse.model,
          inputTokens: modelResponse.usage.inputTokens,
          outputTokens: modelResponse.usage.outputTokens,
          latencyMs: modelResponse.latencyMs,
        })
        .returning();

      await tx.update(agentThreads)
        .set({ lastMessageAt: completedAt, updatedAt: completedAt })
        .where(eq(agentThreads.id, thread.id));

      return { thread, userMessage, assistantMessage };
    });

    const createdThread = !ownedThread;

    return NextResponse.json({
      success: true,
      thread: {
        id: persisted.thread.id,
        title: persisted.thread.title,
        created: createdThread,
      },
      messages: {
        user: persisted.userMessage,
        assistant: persisted.assistantMessage,
      },
      usage: {
        provider: modelResponse.provider,
        model: modelResponse.model,
        inputTokens: modelResponse.usage.inputTokens,
        outputTokens: modelResponse.usage.outputTokens,
        latencyMs: modelResponse.latencyMs,
      },
    }, { status: createdThread ? 201 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 });
    }

    if (error instanceof AgentModelError) {
      console.error('Agent model error:', error.message);
      return NextResponse.json({
        error: error.code === 'NO_PROVIDERS'
          ? 'Agent model is not configured'
          : 'Agent model is temporarily unavailable',
      }, { status: error.code === 'NO_PROVIDERS' ? 503 : 502 });
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Agent message error:', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
