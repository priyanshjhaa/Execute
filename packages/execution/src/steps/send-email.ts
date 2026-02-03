/**
 * Send Email Step Handler
 *
 * Sends emails via Resend (resend.com).
 * Requires RESEND_API_KEY environment variable.
 * Supports both manual entry and contact-based recipients.
 * Supports automatic retry with exponential backoff.
 */

import type { StepHandler, Step, StepResult, ExecutionContext } from '../types.js';
import { templateResolver } from '../context.js';
import { resolveRecipients, type RecipientConfig } from '../recipients.js';
import { withRetry, parseRetryConfig } from '../retry.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_API_URL = 'https://api.resend.com/emails';

interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export class SendEmailStepHandler implements StepHandler {
  type = 'send_email';

  async execute(step: Step, context: ExecutionContext): Promise<StepResult> {
    const startedAt = new Date();

    // Check for API key
    if (!RESEND_API_KEY) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'RESEND_API_KEY environment variable is not configured',
        startedAt,
        completedAt: new Date(),
      };
    }

    const config = step.config;

    // Determine recipients - support both old 'to' format and new 'recipients' format
    let to: string | string[];
    let recipientConfig: RecipientConfig;

    if (config.recipients) {
      // New format with contacts
      recipientConfig = {
        type: (config.recipients as any).type || 'contacts',
        ...(config.recipients as any),
      };

      // Resolve contacts to emails
      try {
        const resolved = await resolveRecipients(context.user.id, recipientConfig);
        to = resolved.emails;

        if (to.length === 0) {
          return {
            stepId: step.id,
            status: 'failed',
            error: 'No recipients found matching the specified criteria',
            startedAt,
            completedAt: new Date(),
          };
        }
      } catch (err: any) {
        return {
          stepId: step.id,
          status: 'failed',
          error: `Failed to resolve recipients: ${err.message}`,
          startedAt,
          completedAt: new Date(),
        };
      }
    } else if (config.to) {
      // Legacy format - manual entry
      to = config.to;
      recipientConfig = { type: 'manual', to };
    } else {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Email recipient (to) or recipients config is required',
        startedAt,
        completedAt: new Date(),
      };
    }

    // Validate required fields
    if (!config.subject) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Email subject is required',
        startedAt,
        completedAt: new Date(),
      };
    }

    if (!config.body) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Email body is required',
        startedAt,
        completedAt: new Date(),
      };
    }

    // Get retry config from step config
    const retryConfig = parseRetryConfig(config);

    try {
      // Resolve template variables
      const subject = templateResolver.resolve(config.subject, context);
      const from = templateResolver.resolve(
        config.from || 'noreply@' + (process.env.SITE_DOMAIN || 'localhost'),
        context
      );

      // If we have resolved contacts, we can personalize the email for each recipient
      const isPersonalized = config.recipients && config.personalize !== false;

      if (isPersonalized && Array.isArray(to) && to.length > 1) {
        // Send individual personalized emails
        const results = [];
        const recipients = (config.recipients as any).contactIds ||
                          (await resolveRecipients(context.user.id, recipientConfig)).contacts;

        for (let i = 0; i < to.length; i++) {
          const email = to[i];
          const contact = recipients[i] || { name: email.split('@')[0] };

          // Create a personalized context with contact data
          const personalizedContext = {
            ...context,
            contact: {
              name: contact.name,
              email: contact.email,
              department: contact.department,
              jobTitle: contact.jobTitle,
              company: contact.company,
              tags: contact.tags,
            },
          };

          const body = templateResolver.resolve(config.body, personalizedContext);

          const payload = this.buildPayload(from, email, subject, body, config);

          // Use retry logic if configured
          let sendResult: SendEmailResult;
          if (retryConfig) {
            const retryResult = await withRetry(async () => this.sendEmail(payload), retryConfig);
            sendResult = {
              ok: retryResult.success,
              messageId: retryResult.data?.messageId,
              error: retryResult.error,
            };
          } else {
            sendResult = await this.sendEmail(payload);
          }

          if (!sendResult.ok) {
            return {
              stepId: step.id,
              status: 'failed',
              error: `Failed to send to ${email}: ${sendResult.error}`,
              startedAt,
              completedAt: new Date(),
              data: { failedRecipients: [email] },
            };
          }

          results.push({ email, messageId: sendResult.messageId });
        }

        return {
          stepId: step.id,
          status: 'completed',
          data: {
            sentCount: results.length,
            recipients: results,
            message: `Sent ${results.length} emails`,
          },
          startedAt,
          completedAt: new Date(),
        };
      }

      // Batch send (non-personalized or single recipient)
      const body = templateResolver.resolve(config.body, context);
      const payload = this.buildPayload(from, to, subject, body, config);

      // Use retry logic if configured
      let sendResult: SendEmailResult & { attempts?: number; totalDelay?: number };
      if (retryConfig) {
        const retryResult = await withRetry(async () => this.sendEmail(payload), retryConfig);
        sendResult = {
          ok: retryResult.success,
          messageId: retryResult.data?.messageId,
          error: retryResult.error,
          attempts: retryResult.attempts,
          totalDelay: retryResult.totalDelay,
        };
      } else {
        sendResult = await this.sendEmail(payload);
      }

      if (!sendResult.ok) {
        return {
          stepId: step.id,
          status: 'failed',
          error: `Resend API error: ${sendResult.error}`,
          startedAt,
          completedAt: new Date(),
        };
      }

      return {
        stepId: step.id,
        status: 'completed',
        data: {
          messageId: sendResult.messageId,
          to: Array.isArray(to) ? to : [to],
          subject: payload.subject,
          sentCount: Array.isArray(to) ? to.length : 1,
          ...(sendResult.attempts && sendResult.attempts > 1 ? {
            attempts: sendResult.attempts,
            totalDelay: sendResult.totalDelay,
          } : {}),
        },
        startedAt,
        completedAt: new Date(),
      };
    } catch (err: any) {
      return {
        stepId: step.id,
        status: 'failed',
        error: err.message || 'Failed to send email',
        startedAt,
        completedAt: new Date(),
      };
    }
  }

  private buildPayload(
    from: string,
    to: string | string[],
    subject: string,
    body: string,
    config: any
  ): Record<string, any> {
    const payload: Record<string, any> = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
    };

    // Determine content type (HTML or text)
    if (body.includes('<') && body.includes('>')) {
      payload.html = body;
    } else {
      payload.text = body;
    }

    // Optional: reply_to
    if (config.replyTo) {
      payload.reply_to = config.replyTo;
    }

    // Optional: cc
    if (config.cc) {
      payload.cc = config.cc;
    }

    // Optional: bcc
    if (config.bcc) {
      payload.bcc = config.bcc;
    }

    return payload;
  }

  private async sendEmail(payload: Record<string, any>): Promise<SendEmailResult> {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: `Resend API error: ${responseData.message || response.statusText}`,
      };
    }

    return {
      ok: true,
      messageId: responseData.id,
    };
  }
}
