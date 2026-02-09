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
import { resolveRecipients, resolveRecipientFromText, type RecipientConfig } from '../recipients.js';
import { withRetry, parseRetryConfig } from '../retry.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || '';
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
      // Legacy format - manual entry, resolve template variables first
      const rawTo = config.to;
      const resolvedTo = templateResolver.resolve(rawTo, context);

      // Check if it contains unresolved template variables
      if (resolvedTo.includes('{{') || resolvedTo.includes('}}')) {
        return {
          stepId: step.id,
          status: 'failed',
          error: `Template variable in 'to' field could not be resolved. Original: "${rawTo}", Resolved: "${resolvedTo}". Please use a specific email address or contact name.`,
          startedAt,
          completedAt: new Date(),
        };
      }

      // Try to resolve the text to actual email addresses
      // This handles: direct emails, contact names, departments, tags
      try {
        const resolved = await resolveRecipientFromText(context.user.id, resolvedTo);
        to = resolved.emails;
        recipientConfig = { type: 'manual', to };
        console.log('[SendEmail] Resolved recipient from text:', resolvedTo, '->', to);
      } catch (err: any) {
        return {
          stepId: step.id,
          status: 'failed',
          error: `Failed to resolve recipient "${resolvedTo}": ${err.message}`,
          startedAt,
          completedAt: new Date(),
        };
      }
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

      // Use RESEND_FROM_EMAIL if configured, otherwise fall back to config.from or default
      const defaultFrom = RESEND_FROM_EMAIL || 'noreply@' + (process.env.SITE_DOMAIN || 'localhost');
      const from = templateResolver.resolve(config.from || defaultFrom, context);

      // Debug logging - remove this after fixing
      console.log('[SendEmail] RESEND_FROM_EMAIL env var:', RESEND_FROM_EMAIL);
      console.log('[SendEmail] config.from:', config.from);
      console.log('[SendEmail] defaultFrom:', defaultFrom);
      console.log('[SendEmail] resolved from:', from);

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
    // Log the exact payload being sent for debugging
    console.log('[SendEmail] Sending payload to Resend:', JSON.stringify(payload, null, 2));

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    console.log('[SendEmail] Resend API response status:', response.status);
    console.log('[SendEmail] Resend API response data:', JSON.stringify(responseData, null, 2));

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
