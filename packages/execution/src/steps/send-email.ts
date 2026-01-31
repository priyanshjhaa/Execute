/**
 * Send Email Step Handler
 *
 * Sends emails via Resend (resend.com).
 * Requires RESEND_API_KEY environment variable.
 */

import type { StepHandler, Step, StepResult, ExecutionContext } from '../types.js';
import { templateResolver } from '../context.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_API_URL = 'https://api.resend.com/emails';

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

    // Validate config
    const config = step.config;
    if (!config.to) {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'Email recipient (to) is required',
        startedAt,
        completedAt: new Date(),
      };
    }

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

    try {
      // Resolve template variables
      const to = templateResolver.resolve(config.to, context);
      const subject = templateResolver.resolve(config.subject, context);
      const body = templateResolver.resolve(config.body, context);
      const from = templateResolver.resolve(
        config.from || 'noreply@' + (process.env.SITE_DOMAIN || 'localhost'),
        context
      );

      // Build Resend API payload
      const payload: Record<string, any> = {
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
      };

      // Determine content type (HTML or text)
      if (body.includes('<') && body.includes('>')) {
        // Looks like HTML
        payload.html = body;
      } else {
        payload.text = body;
      }

      // Optional: reply_to
      if (config.replyTo) {
        payload.reply_to = templateResolver.resolve(config.replyTo, context);
      }

      // Optional: cc
      if (config.cc) {
        payload.cc = templateResolver.resolve(config.cc, context);
      }

      // Optional: bcc
      if (config.bcc) {
        payload.bcc = templateResolver.resolve(config.bcc, context);
      }

      // Send via Resend API
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
          stepId: step.id,
          status: 'failed',
          error: `Resend API error: ${responseData.message || response.statusText}`,
          startedAt,
          completedAt: new Date(),
        };
      }

      return {
        stepId: step.id,
        status: 'completed',
        data: {
          messageId: responseData.id,
          to: payload.to,
          subject: payload.subject,
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
}
