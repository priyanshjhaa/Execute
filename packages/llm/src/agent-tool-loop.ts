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
export const AGENT_MAX_TOOL_RESULT_CHARS = 12_000;

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
  signal?: AbortSignal;
  maxRounds?: number;
  maxToolCalls?: number;
}

function serializeToolResult(result: unknown): string {
  const serialized = JSON.stringify(result);
  if (serialized.length <= AGENT_MAX_TOOL_RESULT_CHARS) return serialized;

  return JSON.stringify({
    ok: false,
    error: {
      code: 'TOOL_RESULT_TOO_LARGE',
      message: 'The tool result was too large to include in model context.',
    },
  });
}

export async function runAgentToolLoop(
  options: AgentToolLoopOptions,
): Promise<AgentModelResponse> {
  const maxRounds = options.maxRounds ?? AGENT_MAX_TOOL_ROUNDS;
  const maxToolCalls = options.maxToolCalls ?? AGENT_MAX_TOOL_CALLS;
  const messages = [...options.messages];
  let callCount = 0;
  let visibleContent = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let latencyMs = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    const response = await options.modelClient.stream(messages, {
      signal: options.signal,
      tools: options.tools,
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

    for (const toolCall of response.toolCalls) {
      if (options.signal?.aborted) throw new AgentModelAbortError();

      let result: unknown;
      try {
        result = await options.executeTool(toolCall);
      } catch {
        if (options.signal?.aborted) throw new AgentModelAbortError();
        result = {
          ok: false,
          error: {
            code: 'TOOL_EXECUTION_FAILED',
            message: 'The tool query failed.',
          },
        };
      }

      messages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        content: serializeToolResult(result),
      });
    }
  }

  throw new AgentToolLoopError('The model did not produce a final response');
}
