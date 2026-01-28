import { z } from 'zod';

// Step types supported by the system
export enum StepType {
  // Triggers
  WEBHOOK = 'webhook',
  SCHEDULE = 'schedule',
  EMAIL_RECEIVED = 'email_received',
  FORM_SUBMITTED = 'form_submitted',
  USER_CREATED = 'user_created',
  PURCHASE_COMPLETED = 'purchase_completed',

  // Actions
  SEND_EMAIL = 'send_email',
  SEND_SLACK = 'send_slack',
  SEND_SMS = 'send_sms',
  HTTP_REQUEST = 'http_request',
  CREATE_TASK = 'create_task',
  ADD_TO_LIST = 'add_to_list',
  DELAY = 'delay',
  CONDITIONAL = 'conditional',
}

// Base step schema
export const WorkflowStepSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(StepType),
  name: z.string().min(1, 'Step name is required'),
  description: z.string().optional(),
  config: z.record(z.any()),
  position: z.number().int().nonnegative(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

// Complete workflow schema
export const WorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema).min(1, 'Workflow must have at least one step'),
  triggerStepId: z.string().uuid(),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

// LLM response schema
export const ParsedWorkflowResponseSchema = z.object({
  success: z.boolean(),
  workflow: WorkflowSchema.optional(),
  error: z.string().optional(),
  reasoning: z.string().optional(),
});

export type ParsedWorkflowResponse = z.infer<typeof ParsedWorkflowResponseSchema>;

// Input instruction
export interface ParseInstructionInput {
  instruction: string;
  userId: string;
}

// Provider configuration
export interface LLMProviderConfig {
  provider: 'anthropic' | 'openai';
  apiKey?: string;
  model?: string;
}
