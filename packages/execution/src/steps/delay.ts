/**
 * Delay Step Handler
 *
 * IMPORTANT: This does NOT block execution with sleep().
 * Instead, it returns a 'waiting' status with a resume timestamp.
 *
 * The scheduler is responsible for resuming executions that are waiting.
 */

import type { StepHandler, Step, StepResult, ExecutionContext } from '../types.js';

export class DelayStepHandler implements StepHandler {
  type = 'delay';

  async execute(step: Step, _context: ExecutionContext): Promise<StepResult> {
    const startedAt = new Date();

    // Validate config
    const config = step.config;
    const duration = parseInt(config.duration || '0', 10);
    const unit = config.unit || 'seconds';

    if (!duration || duration <= 0) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Delay duration must be a positive number',
        startedAt,
        completedAt: new Date(),
      };
    }

    // Calculate delay in milliseconds
    const unitMs: Record<string, number> = {
      seconds: 1000,
      minutes: 60000,
      hours: 3600000,
      days: 86400000,
    };

    const ms = duration * (unitMs[unit] || 1000);

    // Maximum delay: 30 days
    const maxMs = 30 * 24 * 60 * 60 * 1000;
    if (ms > maxMs) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Maximum delay is 30 days',
        startedAt,
        completedAt: new Date(),
      };
    }

    // Calculate when to resume
    const resumeAt = new Date(startedAt.getTime() + ms);

    // Return waiting status with resume timestamp
    return {
      stepId: step.id,
      status: 'waiting',
      data: {
        duration,
        unit,
        resumeAt: resumeAt.toISOString(),
      },
      startedAt,
      completedAt: new Date(),
    };
  }
}
