/**
 * Send Slack Step Handler
 *
 * Sends messages to Slack via:
 * 1. OAuth token (Web API) - preferred, uses chat.postMessage
 * 2. Incoming Webhooks - fallback for advanced users
 * Supports:
 * - OAuth integration with integrationId
 * - Direct webhook_url in config (legacy/advanced)
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

interface SlackIntegration {
  config: {
    access_token?: string;
    webhook_url?: string;
    default_channel_id?: string;
    default_channel_name?: string;
  };
}

export class SendSlackStepHandler implements StepHandler {
  type = 'send_slack';

  async execute(step: Step, context: ExecutionContext): Promise<StepResult> {
    const startedAt = new Date();
    const config = step.config;

    // Get retry config from step config
    const retryConfig = parseRetryConfig(config);

    try {
      // Resolve template variables for message
      const message = templateResolver.resolve(config.message || '', context);

      // Mode 1: OAuth integration (preferred)
      if (config.integrationId) {
        const result = await this.sendViaIntegration(
          config.integrationId,
          context.user.id,
          message,
          config,
          retryConfig
        );

        if (result.ok) {
          return {
            stepId: step.id,
            status: 'completed',
            data: {
              sent: true,
              method: 'oauth',
              ...(result.attempts && result.attempts > 1 ? {
                attempts: result.attempts,
                totalDelay: result.totalDelay,
              } : {}),
            },
            startedAt,
            completedAt: new Date(),
          };
        }

        return {
          stepId: step.id,
          status: 'failed',
          error: result.error || 'Failed to send Slack message',
          startedAt,
          completedAt: new Date(),
        };
      }

      // Mode 2: Direct webhook URL (legacy/advanced)
      if (config.webhook_url) {
        const result = await this.sendViaWebhook(
          config.webhook_url,
          message,
          config,
          retryConfig
        );

        if (result.ok) {
          return {
            stepId: step.id,
            status: 'completed',
            data: {
              sent: true,
              method: 'webhook',
              ...(result.attempts && result.attempts > 1 ? {
                attempts: result.attempts,
                totalDelay: result.totalDelay,
              } : {}),
            },
            startedAt,
            completedAt: new Date(),
          };
        }

        return {
          stepId: step.id,
          status: 'failed',
          error: result.error || 'Failed to send Slack message',
          startedAt,
          completedAt: new Date(),
        };
      }

      // No valid Slack configuration
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Slack integration not configured. Please connect Slack in Integrations or provide a webhook_url.',
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

  /**
   * Send message using OAuth integration (Web API)
   */
  private async sendViaIntegration(
    integrationId: string,
    userId: string,
    message: string,
    config: any,
    retryConfig?: ReturnType<typeof parseRetryConfig>
  ): Promise<SendSlackResult & { attempts?: number; totalDelay?: number }> {
    const supabase = getSupabase();
    if (!supabase) {
      return { ok: false, error: 'Database connection failed' };
    }

    // Fetch integration
    const { data } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('user_id', userId)
      .eq('type', 'slack')
      .single();

    if (!data) {
      return { ok: false, error: 'Slack integration not found or not connected' };
    }

    const integration = data as SlackIntegration;

    // Prefer OAuth token, fallback to webhook
    if (integration.config.access_token) {
      return this.sendViaWebAPI(
        integration.config.access_token,
        config.channel || integration.config.default_channel_id,
        message,
        config,
        retryConfig
      );
    }

    if (integration.config.webhook_url) {
      return this.sendViaWebhook(
        integration.config.webhook_url,
        message,
        config,
        retryConfig
      );
    }

    return { ok: false, error: 'Slack integration is incomplete. Please reconnect.' };
  }

  /**
   * Send message using Slack Web API (OAuth)
   */
  private async sendViaWebAPI(
    accessToken: string,
    channelId: string | undefined,
    message: string,
    config: any,
    retryConfig?: ReturnType<typeof parseRetryConfig>
  ): Promise<SendSlackResult & { attempts?: number; totalDelay?: number }> {
    if (!channelId) {
      return { ok: false, error: 'No channel specified. Please select a default channel in integrations or specify one in the workflow.' };
    }

    const sendFn = async () => {
      // Build payload for chat.postMessage
      const payload: Record<string, any> = {
        channel: channelId,
        text: message,
      };

      // Optional: username (only works in some contexts)
      if (config.username) {
        payload.username = config.username;
      }

      // Optional: icon
      if (config.icon_emoji) {
        payload.icon_emoji = config.icon_emoji;
      } else if (config.icon_url) {
        payload.icon_url = config.icon_url;
      }

      // Optional: blocks (new Slack format)
      if (config.blocks && Array.isArray(config.blocks)) {
        payload.blocks = config.blocks;
      }

      // Optional: attachments (legacy but still supported)
      if (config.attachments && Array.isArray(config.attachments)) {
        payload.attachments = config.attachments;
      }

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.ok) {
        return {
          ok: false,
          error: `Slack API error: ${data.error || 'Unknown error'}`,
        };
      }

      return {
        ok: true,
        response: JSON.stringify({ ts: data.ts, channel: data.channel }),
      };
    };

    if (retryConfig) {
      const result = await withRetry(sendFn, retryConfig);
      return {
        ok: result.success,
        error: result.error,
        response: result.data?.response,
        attempts: result.attempts,
        totalDelay: result.totalDelay,
      };
    }

    const result = await sendFn();
    return {
      ok: result.ok,
      error: result.error,
      response: result.response,
    };
  }

  /**
   * Send message using Incoming Webhook (legacy/advanced)
   */
  private async sendViaWebhook(
    webhookUrl: string,
    message: string,
    config: any,
    retryConfig?: ReturnType<typeof parseRetryConfig>
  ): Promise<SendSlackResult & { attempts?: number; totalDelay?: number }> {
    const sendFn = async () => {
      // Build webhook payload
      const payload: Record<string, any> = {
        text: message,
      };

      // Optional: username
      if (config.username) {
        payload.username = config.username;
      }

      // Optional: icon
      if (config.icon_emoji) {
        payload.icon_emoji = config.icon_emoji;
      } else if (config.icon_url) {
        payload.icon_url = config.icon_url;
      }

      // Optional: attachments
      if (config.attachments && Array.isArray(config.attachments)) {
        payload.attachments = config.attachments;
      }

      // Optional: blocks
      if (config.blocks && Array.isArray(config.blocks)) {
        payload.blocks = config.blocks;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: `Slack webhook error: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const responseBody = await response.text();
      return {
        ok: true,
        response: responseBody,
      };
    };

    if (retryConfig) {
      const result = await withRetry(sendFn, retryConfig);
      return {
        ok: result.success,
        error: result.error,
        response: result.data?.response,
        attempts: result.attempts,
        totalDelay: result.totalDelay,
      };
    }

    const result = await sendFn();
    return {
      ok: result.ok,
      error: result.error,
      response: result.response,
    };
  }
}
