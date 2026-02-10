/**
 * Email Content Generation Prompts
 *
 * Prompts for LLM to generate professional HTML email content
 * that works with Resend API and common email clients.
 */

export interface EmailContentRequest {
  intent: string;
  tone?: 'friendly' | 'professional' | 'casual' | 'formal';
  recipientName?: string;
  companyName?: string;
}

export interface GeneratedEmailContent {
  subject: string;
  html: string;
  text: string;
  preview: string;
}

/**
 * System prompt for email content generation
 */
export const EMAIL_CONTENT_SYSTEM_PROMPT = `You are an expert email copywriter. Generate professional HTML email content based on the user's intent.

CRITICAL REQUIREMENTS for Resend API and email clients:
1. Use ONLY inline CSS styles - no external stylesheets or <style> tags
2. Set max-width to 600px for mobile responsiveness
3. Use semantic HTML: <!DOCTYPE html><html>...</html>
4. Preserve ALL template variables exactly as provided (e.g., {{user.name}}, {{company.name}})
5. Include a clear call-to-action button with inline styles

Email structure:
- Engaging subject line (under 50 chars if possible)
- Professional greeting with {{user.name}} or similar
- Brief, scannable body content (2-3 paragraphs max)
- One prominent call-to-action button
- Professional signature

Output ONLY valid JSON in this exact format:
{
  "subject": "Compelling subject line",
  "preview": "Brief preview text (under 100 chars)",
  "html": "<!DOCTYPE html><html><body>...</body></html>",
  "text": "Plain text version for email clients that don't render HTML"
}

Example HTML structure:
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background: white; padding: 30px; border-radius: 8px;">
    <h1 style="color: #333; margin-top: 0;">Heading</h1>
    <p style="color: #555; line-height: 1.6;">Content here...</p>
    <a href="{{cta_link}}" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Button Text</a>
  </div>
</body>
</html>`;

/**
 * Build user prompt for email content generation
 */
export function buildEmailContentPrompt(request: EmailContentRequest): string {
  const tone = request.tone || 'professional';

  let prompt = `Generate a ${tone} email for this intent: "${request.intent}"`;

  if (request.recipientName) {
    prompt += `\nRecipient name variable: ${request.recipientName}`;
  }

  if (request.companyName) {
    prompt += `\nCompany name variable: ${request.companyName}`;
  }

  prompt += `\n\nAvailable template variables: {{user.name}}, {{user.email}}, {{company.name}}, {{workflow.name}}, {{cta_link}}, {{timestamp}}`;

  return prompt;
}

/**
 * Common email templates for quick generation
 */
export const EMAIL_TEMPLATES = {
  welcome: {
    subject: 'Welcome to {{company.name}}!',
    intent: 'Send a warm welcome email to a new user',
    tone: 'friendly' as const,
  },
  notification: {
    subject: 'New Update from {{company.name}}',
    intent: 'Send a notification email about an update',
    tone: 'professional' as const,
  },
  password_reset: {
    subject: 'Reset Your Password',
    intent: 'Send a password reset email',
    tone: 'professional' as const,
  },
  invitation: {
    subject: 'You\'re Invited! Join {{company.name}}',
    intent: 'Send an invitation email to join a team',
    tone: 'friendly' as const,
  },
  reminder: {
    subject: 'Reminder: {{workflow.name}}',
    intent: 'Send a reminder email about an upcoming event or task',
    tone: 'casual' as const,
  },
};
