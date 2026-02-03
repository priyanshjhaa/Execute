/**
 * Send Slack Step Handler
 *
 * Sends messages to Slack via Incoming Webhooks.
 * Supports:
 * - Direct webhook_url in config
 * - integrationId to fetch from user_integrations table
 * - Automatic retry with exponential backoff
 */

import type { StepHandler, Step, StepResult, ExecutionContext } from '../types.js';
import { templateResolver } from '../context.js';
import { createClient } from '@supabase/supabase-js';
import { withRetry, parseRetryConfig } from '../retry.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const getSupabase = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey);
};

interface SendSlackResult {
  ok: boolean;
  response?: string;
  error?: string;
}

export class SendSlackStepHandler implements StepHandler {
  type = 'send_slack';

  async execute(step: Step, context: ExecutionContext): Promise<StepResult> {
    const startedAt = new Date();

    const config = step.config;
    let webhookUrl = config.webhook_url;

    // If integrationId is provided, fetch webhook URL from integrations
    if (!webhookUrl && config.integrationId) {
      const supabase = getSupabase();
      if (supabase) {
        const { data } = await supabase
          .from('user_integrations')
          .select('config')
          .eq('id', config.integrationId)
          .eq('user_id', context.user.id)
          .eq('type', 'slack')
          .single();

        if (data?.config?.webhook_url) {
          webhookUrl = data.config.webhook_url;
        }
      }
    }

    if (!webhookUrl) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Slack webhook URL is required (provide webhook_url or integrationId)',
        startedAt,
        completedAt: new Date(),
      };
    }

    // Get retry config from step config
    const retryConfig = parseRetryConfig(config);

    try {
      // Resolve template variables
      const resolvedUrl = templateResolver.resolve(webhookUrl, context);
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

      // Send to Slack with retry logic
      let result: SendSlackResult & { attempts?: number; totalDelay?: number };

      if (retryConfig) {
        const retryResult = await withRetry(
          async () => this.sendToSlack(resolvedUrl, payload),
          retryConfig
        );
        result = {
          ok: retryResult.success,
          response: retryResult.data?.response,
          error: retryResult.error,
          attempts: retryResult.attempts,
          totalDelay: retryResult.totalDelay,
        };
      } else {
        const slackResult = await this.sendToSlack(resolvedUrl, payload);
        result = {
          ok: slackResult.ok,
          response: slackResult.response,
          error: slackResult.error,
        };
      }

      if (!result.ok) {
        return {
          stepId: step.id,
          status: 'failed',
          error: result.error || 'Failed to send Slack message',
          startedAt,
          completedAt: new Date(),
        };
      }

      return {
        stepId: step.id,
        status: 'completed',
        data: {
          sent: true,
          response: result.response,
          ...(result.attempts && result.attempts > 1 ? {
            attempts: result.attempts,
            totalDelay: result.totalDelay,
          } : {}),
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

  private async sendToSlack(url: string, payload: Record<string, any>): Promise<SendSlackResult> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: `Slack API error: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const responseBody = await response.text();
      return {
        ok: true,
        response: responseBody,
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err.message || 'Failed to send Slack message',
      };
    }
  }
}
