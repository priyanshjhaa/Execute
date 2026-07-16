import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { agentMessages, agentRuns, agentThreads, db, users } from '@execute/db';
import {
  AgentModelAbortError,
  AgentModelError,
  createAgentModelClient,
} from '@execute/llm';
import { registerAgentRun, unregisterAgentRun } from '@/lib/agent-run-registry';
import { createClient } from '@/lib/supabase/server';

const AgentMessageRequestSchema = z.object({
  runId: z.string().uuid(),
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

function modelErrorMessage(error: unknown): string {
  if (error instanceof AgentModelError && error.code === 'NO_PROVIDERS') {
    return 'Agent model is not configured';
  }
  if (error instanceof AgentModelError) {
    return 'Agent model is temporarily unavailable';
  }
  return 'Failed to generate a response';
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

    await db.insert(agentRuns).values({
      id: input.runId,
      userId: internalUser.id,
      threadId: ownedThread?.id,
      status: 'running',
    });

    const modelClient = createAgentModelClient();
    const runController = registerAgentRun(input.runId, internalUser.id);
    const abortFromRequest = () => runController.abort();
    if (request.signal.aborted) {
      runController.abort();
    } else {
      request.signal.addEventListener('abort', abortFromRequest, { once: true });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let pollInFlight = false;

        const sendEvent = (event: Record<string, unknown>) => {
          if (runController.signal.aborted) {
            throw new AgentModelAbortError();
          }
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            runController.abort();
            throw new AgentModelAbortError();
          }
        };

        const cancellationPoll = setInterval(async () => {
          if (pollInFlight || runController.signal.aborted) return;
          pollInFlight = true;
          try {
            const [run] = await db.select({ status: agentRuns.status })
              .from(agentRuns)
              .where(and(
                eq(agentRuns.id, input.runId),
                eq(agentRuns.userId, internalUser.id),
              ))
              .limit(1);
            if (!run || run.status === 'cancelled') {
              runController.abort();
            }
          } catch (error) {
            console.error('Agent cancellation poll error:', error);
          } finally {
            pollInFlight = false;
          }
        }, 1000);

        try {
          sendEvent({ type: 'start', runId: input.runId });

          const modelResponse = await modelClient.stream([
            { role: 'system', content: AGENT_SYSTEM_PROMPT },
            { role: 'user', content: input.message },
          ], {
            signal: runController.signal,
            onDelta: (delta) => sendEvent({ type: 'delta', delta }),
          });

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

            const [completedRun] = await tx.update(agentRuns)
              .set({ status: 'completed', threadId: thread.id, completedAt })
              .where(and(
                eq(agentRuns.id, input.runId),
                eq(agentRuns.userId, internalUser.id),
                eq(agentRuns.status, 'running'),
              ))
              .returning({ id: agentRuns.id });

            if (!completedRun) {
              throw new AgentModelAbortError();
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

          sendEvent({
            type: 'done',
            thread: {
              id: persisted.thread.id,
              title: persisted.thread.title,
              created: !ownedThread,
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
          });
        } catch (error) {
          const cancelled = error instanceof AgentModelAbortError || runController.signal.aborted;
          const completedAt = new Date();

          await db.update(agentRuns)
            .set(cancelled
              ? { status: 'cancelled', cancelledAt: completedAt, completedAt }
              : { status: 'failed', completedAt })
            .where(and(
              eq(agentRuns.id, input.runId),
              eq(agentRuns.userId, internalUser.id),
              eq(agentRuns.status, 'running'),
            ));

          if (!cancelled) {
            console.error('Agent stream error:', error);
          }

          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(cancelled
              ? { type: 'cancelled' }
              : { type: 'error', error: modelErrorMessage(error) })}\n`));
          } catch {
            // The browser may already have closed its side of the stream.
          }
        } finally {
          clearInterval(cancellationPoll);
          request.signal.removeEventListener('abort', abortFromRequest);
          unregisterAgentRun(input.runId, internalUser.id);
          try {
            controller.close();
          } catch {
            // The stream may already be closed by the browser.
          }
        }
      },
      cancel() {
        runController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Agent message error:', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
