/**
 * Workflow Executor
 *
 * Design principles:
 * - DUMB: Only knows how to run steps in order
 * - STRICT: Validates inputs, fails on errors
 * - HONEST: Reports exactly what happened
 * - NO business logic
 */

import type {
  ExecutionContext,
  ExecutionResult,
  ExecutionStatus,
  Step,
  StepHandler,
  StepResult,
  StepStatus,
  WorkflowDefinition,
  WorkflowInput,
} from './types.js';
import { createContext, templateResolver } from './context.js';

/**
 * Options for workflow execution
 */
export interface ExecutionOptions {
  /** Trigger data (webhook payload, etc.) */
  triggerData?: Record<string, any>;
  /** Callback when a step starts */
  onStepStart?: (stepId: string) => Promise<void> | void;
  /** Callback when a step completes */
  onStepComplete?: (result: StepResult) => Promise<void> | void;
  /** Check if execution should continue (for cancellation) */
  shouldContinue?: () => boolean | Promise<boolean>;
}

/**
 * Workflow Executor
 *
 * Executes workflows step by step, logging results and handling failures.
 */
export class WorkflowExecutor {
  private stepHandlers = new Map<string, StepHandler>();

  /**
   * Register a step handler
   */
  registerHandler(handler: StepHandler): void {
    this.stepHandlers.set(handler.type, handler);
  }

  /**
   * Execute a workflow
   *
   * @param workflow Workflow to execute
   * @param user User who is executing
   * @param executionId Unique execution ID
   * @param options Execution options
   * @returns Execution result
   */
  async execute(
    workflow: WorkflowInput,
    user: { id: string; email: string; name?: string },
    executionId: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startedAt = new Date();
    const context = createContext(user, workflow, executionId, options.triggerData);

    const steps: StepResult[] = [];
    let status: ExecutionStatus = 'running';
    let error: string | undefined;

    try {
      // Parse workflow definition
      const definition: WorkflowDefinition = workflow.definition;
      if (!definition.steps || definition.steps.length === 0) {
        throw new Error('Workflow has no steps');
      }

      // Sort steps by position
      const sortedSteps = [...definition.steps].sort((a, b) => a.position - b.position);

      // Execute each step
      for (const step of sortedSteps) {
        // Check if we should continue
        if (options.shouldContinue && !(await options.shouldContinue())) {
          status = 'failed';
          error = 'Execution cancelled';
          break;
        }

        // Notify step start
        if (options.onStepStart) {
          await options.onStepStart(step.id);
        }

        const result = await this.executeStep(step, context);
        steps.push(result);
        context.stepResults.set(step.id, result);

        // Notify step completion
        if (options.onStepComplete) {
          await options.onStepComplete(result);
        }

        // Fail fast: stop on first error
        if (result.status === 'failed') {
          status = 'failed';
          error = `Step "${step.name}" failed: ${result.error}`;
          break;
        }

        // Handle delay steps (mark as waiting)
        if (result.status === 'waiting') {
          status = 'waiting';
          break;
        }
      }

      // If we didn't fail, we completed successfully
      if (status === 'running') {
        status = 'completed';
      }
    } catch (err: any) {
      status = 'failed';
      error = err.message || 'Unknown error';
    }

    const completedAt = new Date();
    const duration = completedAt.getTime() - startedAt.getTime();

    return {
      executionId,
      status,
      steps,
      error,
      startedAt,
      completedAt,
      duration,
    };
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: Step,
    context: ExecutionContext
  ): Promise<StepResult> {
    const startedAt = new Date();
    let status: StepStatus = 'running';
    let data: any;
    let error: string | undefined;

    try {
      // Get handler for this step type
      const handler = this.stepHandlers.get(step.type);
      if (!handler) {
        throw new Error(`No handler registered for step type: ${step.type}`);
      }

      // Execute the step
      const result = await handler.execute(step, context);

      status = result.status;
      data = result.data;
      error = result.error;
    } catch (err: any) {
      status = 'failed';
      error = err.message || 'Unknown error';
    }

    const completedAt = new Date();
    const duration = completedAt.getTime() - startedAt.getTime();

    return {
      stepId: step.id,
      status,
      data,
      error,
      startedAt,
      completedAt,
      duration,
    };
  }

  /**
   * Get all registered step types
   */
  getRegisteredStepTypes(): string[] {
    return Array.from(this.stepHandlers.keys());
  }
}

/**
 * Create a new workflow executor with default handlers
 */
export function createExecutor(): WorkflowExecutor {
  const executor = new WorkflowExecutor();
  // Handlers will be registered separately
  return executor;
}
