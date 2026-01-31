/**
 * Send Slack Step Handler
 *
 * Sends messages to Slack via Incoming Webhooks.
 * Users provide their webhook URL in the step config.
 */

import type { StepHandler, Step, StepResult, ExecutionContext } from '../types.js';
import { templateResolver } from '../context.js';

export class SendSlackStepHandler implements StepHandler {
  type = 'send_slack';

  async execute(step: Step, context: ExecutionContext): Promise<StepResult> {
    const startedAt = new Date();

    // Validate config
    const config = step.config;
    if (!config.webhook_url) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Slack webhook URL is required',
        startedAt,
        completedAt: new Date(),
      };
    }

    if (!config.channel && !config.webhook_url.includes('hooks.slack.com')) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Slack channel or webhook URL is required',
        startedAt,
        completedAt: new Date(),
      };
    }

    try {
      // Resolve template variables
      const webhookUrl = templateResolver.resolve(config.webhook_url, context);
      const message = templateResolver.resolve(config.message || '', context);

      // Build Slack payload
      const payload: Record<string, any> = {
        text: message,
      };

      // Optional: username
      if (config.username) {
        payload.username = templateResolver.resolve(config.username, context);
      }

      // Optional: icon
      if (config.icon_emoji) {
        payload.icon_emoji = config.icon_emoji;
      } else if (config.icon_url) {
        payload.icon_url = templateResolver.resolve(config.icon_url, context);
      }

      // Optional: attachments
      if (config.attachments && Array.isArray(config.attachments)) {
        payload.attachments = templateResolver.resolveObject(config.attachments, context);
      }

      // Optional: blocks (new Slack format)
      if (config.blocks && Array.isArray(config.blocks)) {
        payload.blocks = templateResolver.resolveObject(config.blocks, context);
      }

      // Send to Slack
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          stepId: step.id,
          status: 'failed',
          error: `Slack API error: ${response.status} ${response.statusText} - ${errorText}`,
          startedAt,
          completedAt: new Date(),
        };
      }

      // Slack returns 'ok' on success
      const responseBody = await response.text();
      return {
        stepId: step.id,
        status: 'completed',
        data: {
          sent: true,
          response: responseBody,
        },
        startedAt,
        completedAt: new Date(),
      };
    } catch (err: any) {
      return {
        stepId: step.id,
        status: 'failed',
        error: err.message || 'Failed to send Slack message',
        startedAt,
        completedAt: new Date(),
      };
    }
  }
}
