/**
 * Conditional Step Handler
 *
 * Evaluates a condition and returns which branch to take.
 * Uses JavaScript expressions for conditions.
 *
 * Note: This handler doesn't execute the branch steps - it just
 * evaluates the condition and returns the branch info. The executor
 * is responsible for following the correct path.
 */

import type { StepHandler, Step, StepResult, ExecutionContext } from '../types.js';
import { templateResolver } from '../context.js';

export class ConditionalStepHandler implements StepHandler {
  type = 'conditional';

  async execute(step: Step, context: ExecutionContext): Promise<StepResult> {
    const startedAt = new Date();

    // Validate config
    const config = step.config;
    if (!config.condition) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Conditional step requires a condition',
        startedAt,
        completedAt: new Date(),
      };
    }

    try {
      // Resolve template variables in condition
      const condition = templateResolver.resolve(config.condition, context);

      // Build context for evaluation
      const evalContext = this.buildEvalContext(context);

      // Evaluate condition (safe-ish evaluation)
      const result = this.evaluateCondition(condition, evalContext);

      return {
        stepId: step.id,
        status: 'completed',
        data: {
          conditionResult: result,
          trueSteps: config.true_steps || [],
          falseSteps: config.false_steps || [],
        },
        startedAt,
        completedAt: new Date(),
      };
    } catch (err: any) {
      return {
        stepId: step.id,
        status: 'failed',
        error: `Condition evaluation failed: ${err.message}`,
        startedAt,
        completedAt: new Date(),
      };
    }
  }

  /**
   * Build context for condition evaluation
   */
  private buildEvalContext(context: ExecutionContext): Record<string, any> {
    return {
      user: context.user,
      workflow: context.workflow,
      trigger: context.triggerData || {},
      steps: this.buildStepsContext(context),
    };
  }

  /**
   * Build steps context for evaluation
   */
  private buildStepsContext(context: ExecutionContext): Record<string, any> {
    const stepsContext: Record<string, any> = {};
    for (const [stepId, result] of context.stepResults.entries()) {
      if (result.data) {
        stepsContext[stepId] = result.data;
      }
    }
    return stepsContext;
  }

  /**
   * Safely evaluate a condition
   *
   * Supports:
   * - Equality: steps.step1.data.value === "test"
   * - Comparison: trigger.data.amount > 100
   * - Logical: steps.step1.data.status === "active" && trigger.data.premium === true
   */
  private evaluateCondition(condition: string, evalContext: Record<string, any>): boolean {
    try {
      // Create a function with the context as parameters
      const contextKeys = Object.keys(evalContext);
      const contextValues = Object.values(evalContext);

      // Build function body that returns the evaluated condition
      const fn = new Function(...contextKeys, `return ${condition};`);

      // Execute with context values
      const result = fn(...contextValues);
      return Boolean(result);
    } catch (err) {
      throw new Error(`Failed to evaluate condition: ${condition}`);
    }
  }
}
