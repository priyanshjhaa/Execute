/**
 * Email Action Templates
 *
 * Pre-defined email structures with consistent formatting.
 * LLM maps user intent → action type + variables.
 * Execute renders the final email.
 */

export interface EmailTemplate {
  type: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
  requiredVariables: string[];
  tone: 'friendly' | 'professional' | 'formal' | 'casual';
}

/**
 * All available email action templates
 */
export const EMAIL_ACTION_TEMPLATES: Record<string, EmailTemplate> = {
  // ===== WELCOME EMAILS =====
  EMAIL_WELCOME_USER: {
    type: 'EMAIL.WELCOME_USER',
    name: 'Welcome User',
    description: 'Send a welcome email when a new user signs up',
    subject: 'Welcome to {{company_name}}! 👋',
    html: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1e293b; margin: 0; font-size: 24px;">Welcome to {{company_name}}! 👋</h1>
    </div>

    <!-- Greeting -->
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Hi {{user_name}},
    </p>

    <!-- Main content -->
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Thanks for signing up for <strong>{{company_name}}</strong>. We're excited to have you on board!
    </p>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
      You can now access all features and start automating your workflows.
    </p>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{cta_link}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Get Started</a>
    </div>

    <!-- Signature -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 14px; margin: 0;">
        Best regards,<br>
        <strong>The {{company_name}} Team</strong>
      </p>
    </div>
  </div>
</body>
</html>`,
    text: `Welcome to {{company_name}}! 👋

Hi {{user_name}},

Thanks for signing up for {{company_name}}. We're excited to have you on board!

You can now access all features and start automating your workflows.

Get started here: {{cta_link}}

Best regards,
The {{company_name}} Team`,
    requiredVariables: ['user_name', 'user_email', 'company_name'],
    tone: 'friendly',
  },

  EMAIL_SIGNUP_CONFIRMATION: {
    type: 'EMAIL.SIGNUP_CONFIRMATION',
    name: 'Signup Confirmation',
    description: 'Confirm user signup with verification details',
    subject: 'Confirm your email address',
    html: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <h1 style="color: #1e293b; margin: 0; font-size: 24px; text-align: center;">Confirm Your Email</h1>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; text-align: center; margin: 30px 0;">
      Hi {{user_name}}, please confirm your email address to complete your signup.
    </p>

    <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 30px 0;">
      <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">Email address:</p>
      <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">{{user_email}}</p>
    </div>

    <div style="text-align: center; margin: 40px 0;">
      <a href="{{verification_link}}" style="display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Confirm Email</a>
    </div>

    <p style="color: #64748b; font-size: 14px; margin: 30px 0 0 0; text-align: center;">
      This link will expire in 24 hours.
    </p>
  </div>
</body>
</html>`,
    text: `Confirm Your Email

Hi {{user_name}},

Please confirm your email address to complete your signup.

Email address: {{user_email}}

Confirm here: {{verification_link}}

This link will expire in 24 hours.`,
    requiredVariables: ['user_name', 'user_email', 'verification_link'],
    tone: 'professional',
  },

  // ===== PASSWORD & AUTH =====
  EMAIL_PASSWORD_RESET: {
    type: 'EMAIL.PASSWORD_RESET',
    name: 'Password Reset',
    description: 'Send password reset link to user',
    subject: 'Reset your password',
    html: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <h1 style="color: #1e293b; margin: 0; font-size: 24px;">Reset Your Password</h1>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 30px 0;">
      Hi {{user_name}}, we received a request to reset your password for your <strong>{{company_name}}</strong> account.
    </p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="{{reset_link}}" style="display: inline-block; background: #ef4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Reset Password</a>
    </div>

    <p style="color: #64748b; font-size: 14px; margin: 30px 0;">
      If you didn't request this, please ignore this email. Your password won't be changed.
    </p>

    <p style="color: #64748b; font-size: 14px; margin: 0;">
      This link will expire in 1 hour.
    </p>
  </div>
</body>
</html>`,
    text: `Reset Your Password

Hi {{user_name}},

We received a request to reset your password for your {{company_name}} account.

Reset your password here: {{reset_link}}

If you didn't request this, please ignore this email. Your password won't be changed.

This link will expire in 1 hour.`,
    requiredVariables: ['user_name', 'company_name', 'reset_link'],
    tone: 'professional',
  },

  // ===== NOTIFICATIONS =====
  EMAIL_INTERNAL_NOTIFICATION: {
    type: 'EMAIL.INTERNAL_NOTIFICATION',
    name: 'Internal Notification',
    description: 'Send internal team notifications',
    subject: '🔔 {{notification_title}}',
    html: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-left: 4px solid #3b82f6;">
    <h2 style="color: #1e293b; margin: 0 0 10px 0;">🔔 {{notification_title}}</h2>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 10px 0;">
      {{notification_message}}
    </p>

    {{#if details}}
    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="color: #64748b; font-size: 13px; margin: 0 0 5px 0; font-weight: 600;">Details:</p>
      <pre style="color: #334155; font-size: 13px; margin: 0; white-space: pre-wrap;">{{details}}</pre>
    </div>
    {{/if}}

    <p style="color: #94a3b8; font-size: 12px; margin: 30px 0 0 0;">
      {{timestamp}}
    </p>
  </div>
</body>
</html>`,
    text: `🔔 {{notification_title}}

{{notification_message}}

{{#if details}}
Details:
{{details}}
{{/if}}

{{timestamp}}`,
    requiredVariables: ['notification_title', 'notification_message'],
    tone: 'professional',
  },

  // ===== CLIENT/EXTERNAL =====
  EMAIL_CLIENT_UPDATE: {
    type: 'EMAIL.CLIENT_UPDATE',
    name: 'Client Update',
    description: 'Send updates to clients/customers',
    subject: '{{update_type}} from {{company_name}}',
    html: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <h1 style="color: #1e293b; margin: 0; font-size: 24px;">{{update_type}}</h1>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 30px 0;">
      Hi {{client_name}},
    </p>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      {{update_message}}
    </p>

    {{#if action_required}}
    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #f59e0b;">
      <p style="color: #92400e; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">⚠️ Action Required</p>
      <p style="color: #78350f; font-size: 14px; margin: 0;">{{action_required}}</p>
    </div>
    {{/if}}

    <div style="text-align: center; margin: 40px 0;">
      <a href="{{cta_link}}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">{{cta_text}}</a>
    </div>

    <p style="color: #64748b; font-size: 14px; margin: 40px 0 0 0;">
      Questions? Just reply to this email.
    </p>

    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
      Best regards,<br>
      {{sender_name}}<br>
      {{company_name}}
    </p>
  </div>
</body>
</html>`,
    text: `{{update_type}}

Hi {{client_name}},

{{update_message}}

{{#if action_required}}
⚠️ Action Required
{{action_required}}
{{/if}}

{{cta_text}}: {{cta_link}}

Questions? Just reply to this email.

Best regards,
{{sender_name}}
{{company_name}}`,
    requiredVariables: ['client_name', 'update_type', 'update_message'],
    tone: 'professional',
  },

  // ===== GENERIC/DEFAULT =====
  EMAIL_GENERIC_NOTIFICATION: {
    type: 'EMAIL.GENERIC_NOTIFICATION',
    name: 'Generic Notification',
    description: 'Default email for any notification type',
    subject: 'Notification from {{company_name}}',
    html: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
  <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <h2 style="color: #1e293b; margin: 0 0 20px 0;">{{title}}</h2>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      Hi {{recipient_name}},
    </p>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 20px 0;">
      {{message}}
    </p>

    {{#if cta_link}}
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{cta_link}}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">{{cta_text || 'View Details'}}</a>
    </div>
    {{/if}}

    <p style="color: #94a3b8; font-size: 12px; margin: 40px 0 0 0;">
      {{timestamp}}
    </p>
  </div>
</body>
</html>`,
    text: `{{title}}

Hi {{recipient_name}},

{{message}}

{{#if cta_link}}
{{cta_text || 'View Details'}}: {{cta_link}}
{{/if}}

{{timestamp}}`,
    requiredVariables: ['recipient_name', 'title', 'message'],
    tone: 'professional',
  },
};

/**
 * Get template by action type
 * Handles both EMAIL.WELCOME_USER (from LLM) and EMAIL_WELCOME_USER (template keys)
 */
export function getEmailTemplate(actionType: string): EmailTemplate | null {
  // Normalize: convert dots to underscores for lookup
  const normalizedKey = actionType.replace(/\./g, '_');
  return EMAIL_ACTION_TEMPLATES[normalizedKey] || null;
}

/**
 * Get all available email action types
 */
export function getEmailActionTypes(): string[] {
  return Object.keys(EMAIL_ACTION_TEMPLATES);
}

/**
 * Render template with variables
 */
export function renderEmailTemplate(
  template: EmailTemplate,
  variables: Record<string, string>
): { subject: string; html: string; text: string } {
  let subject = template.subject;
  let html = template.html;
  let text = template.text;

  // Replace all variables in all fields
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replace(new RegExp(placeholder, 'g'), value);
    html = html.replace(new RegExp(placeholder, 'g'), value);
    text = text.replace(new RegExp(placeholder, 'g'), value);

    // Also handle conditionals (simple implementation)
    html = html.replace(new RegExp(`{{#if ${key}}}([\\s\\S]*?){{/if}}`, 'gs'), value ? '$1' : '');
    text = text.replace(new RegExp(`{{#if ${key}}}([\\s\\S]*?){{/if}}`, 'gs'), value ? '$1' : '');
  }

  // Remove any remaining placeholders with fallback
  html = html.replace(/{{[^}]+}}/g, '');
  text = text.replace(/{{[^}]+}}/g, '');

  return { subject, html, text };
}

/**
 * Action type metadata for LLM
 */
export const EMAIL_ACTION_TYPES_INFO = [
  {
    type: 'EMAIL.WELCOME_USER',
    keywords: ['welcome', 'onboard', 'new user', 'sign up', 'signup', 'joined'],
    description: 'Welcome email for new users',
  },
  {
    type: 'EMAIL.SIGNUP_CONFIRMATION',
    keywords: ['confirm', 'verify', 'confirmation email', 'email verification'],
    description: 'Email confirmation to verify user email address',
  },
  {
    type: 'EMAIL.PASSWORD_RESET',
    keywords: ['password', 'reset', 'forgot password', 'change password'],
    description: 'Password reset email',
  },
  {
    type: 'EMAIL.INTERNAL_NOTIFICATION',
    keywords: ['internal', 'team notification', 'alert', 'notify team'],
    description: 'Internal team notification',
  },
  {
    type: 'EMAIL.CLIENT_UPDATE',
    keywords: ['client', 'customer', 'update', 'inform client'],
    description: 'Update email for clients/customers',
  },
  {
    type: 'EMAIL.GENERIC_NOTIFICATION',
    keywords: ['notification', 'notify', 'alert', 'inform'],
    description: 'Generic notification email (fallback)',
  },
];
