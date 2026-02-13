/**
 * Execution Engine Types
 *
 * Design principles:
 * - Engine is dumb: runs steps, logs results, reports failures
 * - No business logic in the engine
 * - Fail loud: never guess or auto-correct
 */

export type ExecutionStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';

export interface ExecutionContext {
  /** User who triggered the workflow */
  user: {
    id: string;
    email: string;
    name?: string;
  };
  /** Workflow being executed */
  workflow: {
    id: string;
    name: string;
  };
  /** Data from the trigger (webhook payload, etc.) */
  triggerData?: Record<string, any>;
  /** Results from previous steps (stepId -> result) */
  stepResults: Map<string, StepResult>;
  /** Current execution ID */
  executionId: string;
}

export interface Step {
  id: string;
  type: string;
  name: string;
  description?: string;
  config: Record<string, any>;
  position: number;
}

export interface StepResult {
  /** Step that was executed */
  stepId: string;
  /** Execution status */
  status: StepStatus;
  /** Result data (if successful) */
  data?: any;
  /** Error message (if failed) */
  error?: string;
  /** When execution started */
  startedAt: Date;
  /** When execution completed */
  completedAt?: Date;
  /** Duration in milliseconds */
  duration?: number;
}

export interface ExecutionResult {
  /** Execution ID */
  executionId: string;
  /** Final status */
  status: ExecutionStatus;
  /** All step results */
  steps: StepResult[];
  /** Overall error (if failed at workflow level) */
  error?: string;
  /** When execution started */
  startedAt: Date;
  /** When execution completed */
  completedAt?: Date;
  /** Total duration in milliseconds */
  duration?: number;
}

export interface StepHandler {
  /** Step type this handler handles */
  type: string;
  /**
   * Execute the step
   * @param step Step to execute
   * @param context Execution context
   * @returns Step result
   */
  execute(step: Step, context: ExecutionContext): Promise<StepResult>;
}

export interface WorkflowDefinition {
  steps: Step[];
  triggerStepId: string;
}

export interface WorkflowInput {
  id: string;
  name: string;
  userId: string;
  definition: WorkflowDefinition;
  triggerType: string;
  triggerConfig?: Record<string, any>;
  webhookId?: string;
  scheduleExpression?: string;
}

export interface CreateExecutionInput {
  workflowId: string;
  userId: string;
  status: ExecutionStatus;
  triggerType: 'manual' | 'webhook' | 'schedule';
  triggerData?: Record<string, any>;
}

export interface CreateStepInput {
  executionId: string;
  stepId: string;
  status: StepStatus;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}
