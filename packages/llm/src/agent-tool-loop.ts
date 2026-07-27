import {
  AgentChatMessage,
  AgentModelAbortError,
  AgentModelClient,
  AgentModelResponse,
  AgentToolCall,
  AgentToolDefinition,
} from './agent-model.js';

export const AGENT_MAX_TOOL_ROUNDS = 4;
export const AGENT_MAX_TOOL_CALLS = 8;
export const AGENT_MAX_TOOL_RESULT_CHARS = 8_000;
export const AGENT_MAX_TOTAL_TOOL_RESULT_CHARS = 24_000;

export class AgentToolLoopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentToolLoopError';
  }
}

export interface AgentToolLoopOptions {
  messages: AgentChatMessage[];
  modelClient: Pick<AgentModelClient, 'stream'>;
  tools: AgentToolDefinition[];
  executeTool: (toolCall: AgentToolCall) => Promise<unknown>;
  onDelta: (delta: string) => void | Promise<void>;
  onToolCalls?: (toolCalls: AgentToolCall[]) => void | Promise<void>;
  signal?: AbortSignal;
  maxRounds?: number;
  maxToolCalls?: number;
  maxToolResultChars?: number;
  maxTotalToolResultChars?: number;
  tier?: 'fast' | 'reasoning';
}

function serializeToolResult(result: unknown, maxChars: number): string {
  if (maxChars <= 0) return '';
  let serialized: string;
  try {
    serialized = JSON.stringify(result) ?? 'null';
  } catch {
    serialized = JSON.stringify({ ok: false, error: { code: 'TOOL_RESULT_NOT_SERIALIZABLE' } });
  }
  if (serialized.length <= maxChars) return serialized;

  const truncated = JSON.stringify({
    ok: false,
    error: {
      code: 'TOOL_RESULT_TRUNCATED',
      originalChars: serialized.length,
    },
  });
  return truncated.length <= maxChars ? truncated : JSON.stringify({ ok: false });
}

export async function runAgentToolLoop(
  options: AgentToolLoopOptions,
): Promise<AgentModelResponse> {
  const maxRounds = options.maxRounds ?? AGENT_MAX_TOOL_ROUNDS;
  const maxToolCalls = options.maxToolCalls ?? AGENT_MAX_TOOL_CALLS;
  const maxTotalToolResultChars = Math.max(128, options.maxTotalToolResultChars ?? AGENT_MAX_TOTAL_TOOL_RESULT_CHARS);
  const maxToolResultChars = Math.min(
    maxTotalToolResultChars,
    Math.max(128, options.maxToolResultChars ?? AGENT_MAX_TOOL_RESULT_CHARS),
  );
  const messages = [...options.messages];
  let callCount = 0;
  let visibleContent = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let latencyMs = 0;
  let toolResultChars = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    const response = await options.modelClient.stream(messages, {
      signal: options.signal,
      tools: options.tools,
      tier: options.tier,
      onDelta: async (delta) => {
        visibleContent += delta;
        await options.onDelta(delta);
      },
    });

    inputTokens += response.usage.inputTokens;
    outputTokens += response.usage.outputTokens;
    latencyMs += response.latencyMs;

    if (!response.toolCalls?.length) {
      return {
        ...response,
        content: visibleContent.trim(),
        usage: { inputTokens, outputTokens },
        latencyMs,
      };
    }

    callCount += response.toolCalls.length;
    if (callCount > maxToolCalls || round === maxRounds - 1) {
      throw new AgentToolLoopError('The model exceeded the read-only tool-call limit');
    }

    messages.push({
      role: 'assistant',
      content: response.content || null,
      toolCalls: response.toolCalls,
    });

    await options.onToolCalls?.(response.toolCalls);
    const toolResults = await Promise.all(response.toolCalls.map(async (toolCall) => {
      if (options.signal?.aborted) throw new AgentModelAbortError();
      try {
        return await options.executeTool(toolCall);
      } catch {
        if (options.signal?.aborted) throw new AgentModelAbortError();
        return {
          ok: false,
          error: {
            code: 'TOOL_EXECUTION_FAILED',
            message: 'The tool query failed.',
          },
        };
      }
    }));

    response.toolCalls.forEach((toolCall, index) => {
      const remainingChars = Math.max(0, maxTotalToolResultChars - toolResultChars);
      const serializedResult = serializeToolResult(
        toolResults[index],
        Math.min(maxToolResultChars, remainingChars),
      );
      toolResultChars += serializedResult.length;
      messages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        content: serializedResult,
      });
    });
  }

  throw new AgentToolLoopError('The model did not produce a final response');
}
