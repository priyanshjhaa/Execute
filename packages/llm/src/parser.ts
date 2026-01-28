import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  ParseInstructionInput,
  ParsedWorkflowResponse,
  ParsedWorkflowResponseSchema,
  LLMProviderConfig,
  Workflow,
  WorkflowStep,
} from './types';
import { SYSTEM_PROMPT, buildParsePrompt } from './prompts';

export class WorkflowParser {
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI;
  private provider: 'anthropic' | 'openai';

  constructor(config: LLMProviderConfig) {
    this.provider = config.provider;

    if (config.provider === 'anthropic') {
      if (!config.apiKey) {
        throw new Error('Anthropic API key is required');
      }
      this.anthropicClient = new Anthropic({
        apiKey: config.apiKey,
      });
    } else {
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      this.openaiClient = new OpenAI({
        apiKey: config.apiKey,
      });
    }
  }

  async parseInstruction(input: ParseInstructionInput): Promise<ParsedWorkflowResponse> {
    try {
      const prompt = buildParsePrompt(input.instruction);
      let response: string;

      if (this.provider === 'anthropic') {
        response = await this.parseWithAnthropic(prompt);
      } else {
        response = await this.parseWithOpenAI(prompt);
      }

      // Clean the response (remove markdown code blocks if present)
      const cleanedResponse = this.cleanJSONResponse(response);

      // Parse and validate the response
      const parsed = JSON.parse(cleanedResponse);
      const validated = ParsedWorkflowResponseSchema.parse(parsed);

      // Add UUIDs to steps if they're placeholders
      if (validated.workflow) {
        validated.workflow = this.ensureValidUUIDs(validated.workflow);
      }

      return validated;
    } catch (error: any) {
      console.error('Parse error:', error);

      return {
        success: false,
        error: error.message || 'Failed to parse instruction',
        reasoning: 'The LLM response was invalid or could not be parsed',
      };
    }
  }

  private async parseWithAnthropic(prompt: string): Promise<string> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    const message = await this.anthropicClient.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = message.content[0];
    if (textBlock.type === 'text') {
      return textBlock.text;
    }

    throw new Error('Unexpected response type from Anthropic');
  }

  private async parseWithOpenAI(prompt: string): Promise<string> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return content;
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
    workflow.steps = workflow.steps.map((step) => {
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
    workflow.steps = workflow.steps.map((step) => {
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

// Factory function to create parser with environment config
export function createParser(): WorkflowParser {
  const provider = (process.env.LLM_PROVIDER as 'anthropic' | 'openai') || 'anthropic';

  const config: LLMProviderConfig = {
    provider,
    apiKey: provider === 'anthropic'
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY,
  };

  return new WorkflowParser(config);
}
