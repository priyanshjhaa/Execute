/**
 * Send Email Step Handler
 *
 * Sends emails via Resend (resend.com).
 * Requires RESEND_API_KEY environment variable.
 * Supports both manual entry and contact-based recipients.
 * Supports automatic retry with exponential backoff.
 * Supports universal structured email content with backward compatibility.
 */

import type { StepHandler, Step, StepResult, ExecutionContext } from '../types.js';
import { templateResolver } from '../context.js';
import { resolveRecipients, resolveRecipientFromText, type RecipientConfig } from '../recipients.js';
import { withRetry, parseRetryConfig } from '../retry.js';
import { renderEmail, validateEmailContent, type EmailContent } from '../email/renderer.js';

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

  /**
   * Check if config uses new structured content format
   */
  private isStructuredContent(config: any): boolean {
    return !!(config.heading && config.body && !config.html);
  }

  /**
   * Validate template variables in required fields before sending
   */
  private validateTemplateVariables(content: EmailContent, context: ExecutionContext): { valid: boolean; error?: string } {
    // Resolve each field and check for unresolved variables
    const subject = templateResolver.resolve(content.subject, context);
    const heading = templateResolver.resolve(content.heading, context);
    const body = templateResolver.resolve(content.body, context);

    // Check for unresolved template variables in required fields
    const unresolvedVars = this.findUnresolvedVariables([subject, heading, body]);

    if (unresolvedVars.length > 0) {
      return {
        valid: false,
        error: `Required template variables could not be resolved: ${unresolvedVars.join(', ')}. Please ensure these variables are available in the workflow context.`
      };
    }

    return { valid: true };
  }

  /**
   * Find unresolved template variables in text
   */
  private findUnresolvedVariables(texts: string[]): string[] {
    const unresolved: string[] = [];
    const pattern = /\{\{([^}]+)\}\}/g;

    for (const text of texts) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const variable = match[1];
        // Only add if not already in list
        if (!unresolved.includes(variable)) {
          unresolved.push(variable);
        }
      }
    }

    return unresolved;
  }

  /**
   * Prepare email content from config (handles both structured and legacy formats)
   */
  private prepareEmailContent(config: any, context: ExecutionContext): { html?: string; text?: string; subject: string } {
    console.log('[SendEmail] ==================================================');
    console.log('[SendEmail] Preparing email content...');
    console.log('[SendEmail] Config keys:', Object.keys(config));
    console.log('[SendEmail] Has heading:', !!config.heading);
    console.log('[SendEmail] Has body:', !!config.body);
    console.log('[SendEmail] Has html:', !!config.html);
    console.log('[SendEmail] Has details:', !!config.details);
    console.log('[SendEmail] Is structured:', this.isStructuredContent(config));

    if (this.isStructuredContent(config)) {
      console.log('[SendEmail] Using NEW structured format');

      // New structured format
      const content: EmailContent = {
        subject: templateResolver.resolve(config.subject, context),
        heading: templateResolver.resolve(config.heading, context),
        body: templateResolver.resolve(config.body, context),
        intro: config.intro ? templateResolver.resolve(config.intro, context) : undefined,
        details: config.details ? templateResolver.resolve(config.details, context) : undefined,
        ctaText: config.ctaText ? templateResolver.resolve(config.ctaText, context) : undefined,
        ctaLink: config.ctaLink ? templateResolver.resolve(config.ctaLink, context) : undefined,
        signatureName: config.signatureName ? templateResolver.resolve(config.signatureName, context) : undefined,
        replyHint: config.replyHint ? templateResolver.resolve(config.replyHint, context) : undefined,
        showBranding: config.showBranding !== undefined ? config.showBranding : true,
        showFooter: config.showFooter !== undefined ? config.showFooter : true,
        showReplyHint: config.showReplyHint !== undefined ? config.showReplyHint : true,
      };

      console.log('[SendEmail] Content prepared:');
      console.log('[SendEmail] - Subject:', content.subject);
      console.log('[SendEmail] - Heading:', content.heading);
      console.log('[SendEmail] - Body length:', content.body?.length);
      console.log('[SendEmail] - Details:', content.details);
      console.log('[SendEmail] - Intro:', content.intro);

      // Validate required fields
      const validation = validateEmailContent(content);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Validate template variables
      const varValidation = this.validateTemplateVariables(content, context);
      if (!varValidation.valid) {
        throw new Error(varValidation.error);
      }

      // Render to HTML and text
      console.log('[SendEmail] Rendering email to HTML...');
      const rendered = renderEmail(content);
      console.log('[SendEmail] HTML length:', rendered.html?.length);
      console.log('[SendEmail] Text length:', rendered.text?.length);

      console.log('[SendEmail] First 500 chars of HTML:', rendered.html?.substring(0, 500));

      return {
        subject: content.subject,
        html: rendered.html,
        text: rendered.text,
      };
    } else {
      console.log('[SendEmail] Using LEGACY format');
      // Legacy format - use existing body as-is
      const subject = templateResolver.resolve(config.subject, context);
      const body = templateResolver.resolve(config.body, context);

      const result = {
        subject,
        html: body.includes('<') ? body : undefined,
        text: body.includes('<') ? undefined : body,
      };

      console.log('[SendEmail] ==================================================');
      return result;
    }
  }

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

    // Check for structured content or legacy body
    if (!config.heading && !config.body) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Email must have either heading (new format) or body (legacy format)',
        startedAt,
        completedAt: new Date(),
      };
    }

    // Get retry config from step config
    const retryConfig = parseRetryConfig(config);

    try {
      // Use RESEND_FROM_EMAIL if configured, otherwise fall back to config.from or default
      const defaultFrom = RESEND_FROM_EMAIL || 'noreply@' + (process.env.SITE_DOMAIN || 'localhost');
      const from = templateResolver.resolve(config.from || defaultFrom, context);

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

          // Prepare email content (handles both structured and legacy)
          const emailContent = this.prepareEmailContent(config, personalizedContext);

          const payload = this.buildPayload(from, email, emailContent.subject, emailContent.html, emailContent.text, config);

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
      const emailContent = this.prepareEmailContent(config, context);
      const payload = this.buildPayload(from, to, emailContent.subject, emailContent.html, emailContent.text, config);

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
          subject: emailContent.subject,
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
    html: string | undefined,
    text: string | undefined,
    config: any
  ): Record<string, any> {
    const payload: Record<string, any> = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
    };

    // Add HTML if available
    if (html) {
      payload.html = html;
    }

    // Add text if available (or if no HTML)
    if (text) {
      payload.text = text;
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
