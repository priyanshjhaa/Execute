import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  ParseInstructionInput,
  StructuredInput,
  ParsedWorkflowResponse,
  ParsedWorkflowResponseSchema,
  Workflow,
} from './types.js';
import { SYSTEM_PROMPT, buildParsePrompt, buildSimpleParsePrompt } from './prompts.js';

/**
 * WorkflowParser using OpenRouter
 * Simplified single-client implementation that cycles through models
 */
export class WorkflowParser {
  private client: OpenAI;
  private models: string[];

  constructor(apiKey: string, models: string[]) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': 'Execute Workflow Automation',
      },
    });
    this.models = models;
  }

  /**
   * Parse instruction with automatic model fallback
   * Supports both legacy (string) and new (structured) input formats
   */
  async parseInstruction(input: ParseInstructionInput | StructuredInput): Promise<ParsedWorkflowResponse> {
    const errors: Array<{ model: string; error: string }> = [];

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
    for (const model of this.models) {
      try {
        console.log(`Attempting to parse with model: ${model}`);

        const response = await this.client.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        });

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

        console.log(`Successfully parsed with model: ${model}`);
        return {
          ...validated,
          reasoning: validated.reasoning || `Parsed using ${model}`,
        };

      } catch (error: any) {
        console.error(`Failed to parse with ${model}:`, error.message);
        errors.push({
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
      reasoning: `Tried ${this.models.length} model(s). Errors: ${errors.map(e => `${e.model}: ${e.error}`).join('; ')}`,
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
        // Update true_steps and false_steps references if any
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

  /**
   * Validate if instruction is clear enough to parse
   */
  static validateInstruction(instruction: string): { valid: boolean; reason?: string } {
    if (!instruction || instruction.trim().length < 10) {
      return {
        valid: false,
        reason: 'Instruction is too short. Please provide more details.',
      };
    }

    // Check for trigger words
    const triggerIndicators = [
      'when',
      'whenever',
      'on',
      'after',
      'once',
      'schedule',
      'every',
      'trigger',
    ];

    const hasTrigger = triggerIndicators.some((indicator) =>
      instruction.toLowerCase().includes(indicator)
    );

    if (!hasTrigger) {
      return {
        valid: false,
        reason: 'Please specify when this workflow should trigger (e.g., "when user signs up", "every day at 9am")',
      };
    }

    // Check for action verbs
    const actionIndicators = [
      'send',
      'create',
      'add',
      'update',
      'delete',
      'notify',
      'post',
      'call',
      'execute',
    ];

    const hasAction = actionIndicators.some((indicator) =>
      instruction.toLowerCase().includes(indicator)
    );

    if (!hasAction) {
      return {
        valid: false,
        reason: 'Please specify what action should be taken (e.g., "send email", "create task")',
      };
    }

    return { valid: true };
  }
}

/**
 * Factory function to create parser with environment config
 * Uses OpenRouter with free models
 */
export function createParser(): WorkflowParser {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OpenRouter API key not found. Please set OPENROUTER_API_KEY environment variable.\n' +
      'Get your free API key from: https://openrouter.ai/keys'
    );
  }

  // Models in priority order
  const models = [
    // Primary: Google Gemma 3 12B (fast, good quality, small cost)
    process.env.PRIMARY_MODEL || 'google/gemma-3-12b-it',

    // Fallback 1: Google Gemma 3 4B (faster, cheaper)
    'google/gemma-3-4b-it',

    // Fallback 2: Qwen 3 4B (free tier, fast)
    'qwen/qwen3-4b:free',
  ];

  console.log('Using OpenRouter API');
  console.log('Configured models (in priority order):');
  models.forEach((model, index) => {
    console.log(`  ${index + 1}. ${model}`);
  });

  return new WorkflowParser(apiKey, models);
}
