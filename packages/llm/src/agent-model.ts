import Groq from 'groq-sdk';
import OpenAI from 'openai';

export type AgentChatRole = 'system' | 'user' | 'assistant';

export interface AgentChatMessage {
  role: AgentChatRole;
  content: string;
}

export interface AgentModelUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AgentModelResponse {
  content: string;
  provider: 'groq' | 'openrouter';
  model: string;
  usage: AgentModelUsage;
  latencyMs: number;
}

interface AgentModelConfig {
  provider: 'groq' | 'openrouter';
  model: string;
  client: Groq | OpenAI;
}

export class AgentModelError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_PROVIDERS' | 'ALL_PROVIDERS_FAILED',
  ) {
    super(message);
    this.name = 'AgentModelError';
  }
}

function getMaxOutputTokens(): number {
  const configured = Number.parseInt(process.env.AGENT_MAX_OUTPUT_TOKENS || '500', 10);
  if (!Number.isFinite(configured)) return 500;
  return Math.min(Math.max(configured, 64), 1000);
}

export class AgentModelClient {
  private readonly models: AgentModelConfig[];

  constructor(groqKey: string, openrouterKey: string) {
    this.models = [];

    if (groqKey) {
      this.models.push({
        provider: 'groq',
        model: process.env.AGENT_FAST_MODEL || process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        client: new Groq({ apiKey: groqKey }),
      });
    }

    if (openrouterKey) {
      this.models.push({
        provider: 'openrouter',
        model: process.env.AGENT_OPENROUTER_MODEL || 'google/gemma-3-4b-it',
        client: new OpenAI({
          apiKey: openrouterKey,
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
            'X-Title': 'Execute Agent',
          },
        }),
      });
    }
  }

  async complete(messages: AgentChatMessage[]): Promise<AgentModelResponse> {
    if (this.models.length === 0) {
      throw new AgentModelError(
        'No agent model provider is configured',
        'NO_PROVIDERS',
      );
    }

    const errors: string[] = [];

    for (const config of this.models) {
      const startedAt = Date.now();

      try {
        const response = config.provider === 'groq'
          ? await (config.client as Groq).chat.completions.create({
              model: config.model,
              messages,
              temperature: 0.2,
              max_tokens: getMaxOutputTokens(),
            })
          : await (config.client as OpenAI).chat.completions.create({
              model: config.model,
              messages,
              temperature: 0.2,
              max_tokens: getMaxOutputTokens(),
            });

        const content = response.choices[0]?.message?.content?.trim();
        if (!content) {
          throw new Error('Model returned an empty response');
        }

        return {
          content,
          provider: config.provider,
          model: config.model,
          usage: {
            inputTokens: response.usage?.prompt_tokens || 0,
            outputTokens: response.usage?.completion_tokens || 0,
          },
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown provider error';
        errors.push(`${config.provider}/${config.model}: ${message}`);
      }
    }

    throw new AgentModelError(
      `All configured agent model providers failed: ${errors.join('; ')}`,
      'ALL_PROVIDERS_FAILED',
    );
  }
}

export function createAgentModelClient(): AgentModelClient {
  return new AgentModelClient(
    process.env.GROQ_API_KEY || '',
    process.env.OPENROUTER_API_KEY || '',
  );
}
