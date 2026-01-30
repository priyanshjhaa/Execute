import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  ParseInstructionInput,
  StructuredInput,
  ParsedWorkflowResponse,
  ParsedWorkflowResponseSchema,
  Workflow,
} from './types.js';
import { SYSTEM_PROMPT, buildParsePrompt, buildSimpleParsePrompt } from './prompts.js';

interface ModelConfig {
  provider: 'groq' | 'openrouter';
  model: string;
  client: OpenAI | Groq;
}

/**
 * WorkflowParser using Groq (primary) with OpenRouter fallback
 * Groq provides very fast inference with free models
 */
export class WorkflowParser {
  models: ModelConfig[];

  constructor(groqKey: string, openrouterKey: string) {
    this.models = [];

    // Groq models (primary - very fast)
    if (groqKey) {
      const groq = new Groq({ apiKey: groqKey });
      this.models.push(
        { provider: 'groq', model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', client: groq },
        { provider: 'groq', model: 'llama-3.3-8b-8192', client: groq },
        { provider: 'groq', model: 'gemma2-9b-it', client: groq },
      );
    }

    // OpenRouter models (fallback)
    if (openrouterKey) {
      const openrouter = new OpenAI({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-Title': 'Execute Workflow Automation',
        },
      });
      this.models.push(
        { provider: 'openrouter', model: 'google/gemma-3-4b-it', client: openrouter },
        { provider: 'openrouter', model: 'google/gemma-3-12b-it', client: openrouter },
        { provider: 'openrouter', model: 'meta-llama/llama-3.2-3b-instruct:free', client: openrouter },
      );
    }
  }

  /**
   * Parse instruction with automatic model fallback
   * Supports both legacy (string) and new (structured) input formats
   */
  async parseInstruction(input: ParseInstructionInput | StructuredInput): Promise<ParsedWorkflowResponse> {
    const errors: Array<{ provider: string; model: string; error: string }> = [];

    // Determine if input is structured or legacy
    const isStructured = 'what' in input && 'when' in input;

    // Build appropriate prompt based on input type
    const userPrompt = isStructured
      ? buildParsePrompt({
          what: (input as StructuredInput).what,
          when: (input as StructuredInput).when,
          schedule: (input as StructuredInput).schedule
            ? `${(input as StructuredInput).schedule!.frequency}${(input as StructuredInput).schedule!.day ? ` on ${(input as StructuredInput).schedule!.day}` : ''} at ${(input as StructuredInput).schedule!.time}`
            : undefined,
          event: (input as StructuredInput).event,
          additionalContext: (input as StructuredInput).additionalContext,
        })
      : buildSimpleParsePrompt((input as ParseInstructionInput).instruction);

    // Try each model in priority order
    for (const { provider, model, client } of this.models) {
      try {
        console.log(`Attempting to parse with ${provider}: ${model}`);

        let response;
        if (provider === 'groq') {
          response = await (client as Groq).chat.completions.create({
            model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 2048,
            response_format: { type: 'json_object' },
          });
        } else {
          response = await (client as OpenAI).chat.completions.create({
            model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 2048,
            response_format: { type: 'json_object' },
          });
        }

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from model');
        }

        // Clean and validate the response
        const cleanedResponse = this.cleanJSONResponse(content);
        const parsed = JSON.parse(cleanedResponse);
        const validated = ParsedWorkflowResponseSchema.parse(parsed);

        // Add UUIDs to steps if they're placeholders
        if (validated.workflow) {
          validated.workflow = this.ensureValidUUIDs(validated.workflow);
        }

        console.log(`Successfully parsed with ${provider}: ${model}`);
        return {
          ...validated,
          reasoning: validated.reasoning || `Parsed using ${provider}/${model}`,
        };

      } catch (error: any) {
        console.error(`Failed to parse with ${provider}/${model}:`, error.message);
        errors.push({
          provider,
          model,
          error: error.message,
        });

        // Continue to next model
        continue;
      }
    }

    // All models failed
    console.error('All models failed:', errors);
    return {
      success: false,
      error: 'All LLM models failed',
      reasoning: `Tried ${this.models.length} model(s). Errors: ${errors.map(e => `${e.provider}/${e.model}: ${e.error}`).join('; ')}`,
    };
  }

  private cleanJSONResponse(response: string): string {
    // Remove markdown code blocks if present
    let cleaned = response.trim();

    // Remove ```json and ``` markers
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');

    return cleaned;
  }

  private ensureValidUUIDs(workflow: Workflow): Workflow {
    const idMap = new Map<string, string>();

    // Generate new UUIDs for steps
    workflow.steps = workflow.steps.map((step: any) => {
      const newId = uuidv4();
      idMap.set(step.id, newId);
      return {
        ...step,
        id: newId,
      };
    });

    // Update triggerStepId
    const newTriggerId = idMap.get(workflow.triggerStepId);
    if (newTriggerId) {
      workflow.triggerStepId = newTriggerId;
    }

    // Update step references in config
    workflow.steps = workflow.steps.map((step: any) => {
      if (step.type === 'conditional' && step.config) {
        if (Array.isArray(step.config.true_steps)) {
          step.config.true_steps = step.config.true_steps.map((oldId: string) =>
            idMap.get(oldId) || oldId
          );
        }
        if (Array.isArray(step.config.false_steps)) {
          step.config.false_steps = step.config.false_steps.map((oldId: string) =>
            idMap.get(oldId) || oldId
          );
        }
      }
      return step;
    });

    return workflow;
  }
}

/**
 * Factory function to create parser with environment config
 * Uses Groq (fast, free) as primary with OpenRouter as fallback
 */
export function createParser(): WorkflowParser {
  const groqKey = process.env.GROQ_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!groqKey && !openrouterKey) {
    throw new Error(
      'No LLM API keys found. Please set GROQ_API_KEY or OPENROUTER_API_KEY environment variable.\n' +
      'Get Groq key from: https://console.groq.com/keys\n' +
      'Get OpenRouter key from: https://openrouter.ai/keys'
    );
  }

  console.log('Initializing LLM parser...');
  if (groqKey) console.log('  - Groq: enabled (primary)');
  if (openrouterKey) console.log('  - OpenRouter: enabled (fallback)');

  const parser = new WorkflowParser(groqKey || '', openrouterKey || '');
  console.log('Parser ready with', parser.models.length, 'model options');
  parser.models.forEach((m, i) => console.log(`  ${i + 1}. ${m.provider}/${m.model}`));

  return parser;
}
