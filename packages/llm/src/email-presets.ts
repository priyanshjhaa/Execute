/**
 * Email Preset System
 *
 * Provides first-class email templates with structured content generation.
 * Presets: 'registration' | 'weekly_meeting' | 'custom'
 */

export type EmailTemplateType = 'registration' | 'weekly_meeting' | 'custom';
export type ContextType = 'form_submission' | 'manual';

export interface EmailPresetContext {
  templateType: EmailTemplateType;
  contextType?: ContextType;
  contextSummary?: string;
  variables?: Record<string, string>;
}

export interface StructuredEmailContent {
  subject: string;
  heading: string;
  intro?: string;
  body: string;
  ctaText?: string;
  ctaLink?: string;
  signatureName?: string;
  replyHint?: string;
}

/**
 * Generate structured email content based on preset template type
 */
export function generatePresetEmail(
  preset: EmailPresetContext
): StructuredEmailContent {
  const { templateType, contextType, contextSummary, variables = {} } = preset;

  switch (templateType) {
    case 'registration':
      return generateRegistrationEmail(contextType, contextSummary, variables);
    case 'weekly_meeting':
      return generateWeeklyMeetingEmail(contextSummary, variables);
    case 'custom':
    default:
      return generateCustomEmail(contextSummary, variables);
  }
}

/**
 * Registration Email Preset
 *
 * Confirmation/welcome style for form submissions and signups
 */
function generateRegistrationEmail(
  contextType?: ContextType,
  contextSummary?: string,
  variables: Record<string, string> = {}
): StructuredEmailContent {
  const {
    name = variables.name || variables.name || '{{name}}',
    email = variables.email || variables.email || '{{email}}',
    company_name = variables.company_name || 'Execute',
    form_name = variables.form_name || 'our form',
    submission_details = variables.submission_details,
  } = variables;

  return {
    subject: `Thank you for ${form_name}${company_name ? ` from ${company_name}` : ''}`,
    heading: 'Welcome!',
    intro: `Hi ${name},`,
    body: submission_details
      ? `Thank you for submitting ${form_name}. Here's a summary of your submission:\n\n${submission_details}\n\nWe've received your information and will get back to you shortly.`
      : `Thank you for submitting ${form_name}. We've received your information and will get back to you shortly.`,
    ctaText: 'View Submission',
    ctaLink: variables.cta_link || '{{cta_link}}',
    signatureName: 'The Execute Team',
    replyHint: 'If you have any questions about your submission, feel free to reply to this email.',
  };
}

/**
 * Weekly Meeting Email Preset
 *
 * Internal office/team update style for recurring meetings
 */
function generateWeeklyMeetingEmail(
  contextSummary?: string,
  variables: Record<string, string> = {}
): StructuredEmailContent {
  const {
    meeting_title = variables.meeting_title || 'Weekly Team Meeting',
    meeting_date = variables.meeting_date || '{{meeting_date}}',
    meeting_time = variables.meeting_time || '{{meeting_time}}',
    meeting_location = variables.meeting_location || variables.location || '{{meeting_location}}',
    agenda = variables.agenda,
    action_items = variables.action_items,
    sender_name = variables.sender_name || variables.sender_name || '{{sender_name}}',
  } = variables;

  const bodyParts: string[] = [];

  if (contextSummary) {
    bodyParts.push(`This week's ${meeting_title} will cover: ${contextSummary}`);
  }

  bodyParts.push(`**When:** ${meeting_date} at ${meeting_time}`);
  bodyParts.push(`**Where:** ${meeting_location}`);

  if (agenda) {
    bodyParts.push(`\n**Agenda:**\n${agenda}`);
  }

  if (action_items) {
    bodyParts.push(`\n**Action Items:**\n${action_items}`);
  }

  return {
    subject: `${meeting_title} - ${meeting_date}`,
    heading: meeting_title,
    intro: 'Hi Team,',
    body: bodyParts.join('\n\n'),
    ctaText: 'Add to Calendar',
    ctaLink: variables.calendar_link || '{{calendar_link}}',
    signatureName: sender_name,
    replyHint: 'Please come prepared to discuss the agenda items. Let me know if you have any topics to add.',
  };
}

/**
 * Custom Email Preset
 *
 * Flexible template for custom workflows
 */
function generateCustomEmail(
  contextSummary?: string,
  variables: Record<string, string> = {}
): StructuredEmailContent {
  const {
    recipient_name = variables.recipient_name || variables.name || '{{name}}',
    sender_name = variables.sender_name || '{{sender_name}}',
    subject = variables.subject || 'Update from Execute',
    heading = variables.heading || 'Update',
    message = variables.message || variables.body || contextSummary || 'Please review the information above.',
    cta_text = variables.cta_text,
    cta_link = variables.cta_link,
  } = variables;

  return {
    subject,
    heading,
    intro: `Hi ${recipient_name},`,
    body: message,
    ...(cta_text && cta_link ? {
      ctaText: cta_text,
      ctaLink: cta_link,
    } : {}),
    signatureName: sender_name,
    replyHint: 'If you have any questions, feel free to reply to this email.',
  };
}

/**
 * Infer template type from user intent and trigger context
 */
export function inferTemplateType(
  userIntent: string,
  triggerType?: string
): EmailTemplateType {
  const intent = userIntent.toLowerCase();

  // Registration/signup/form indicators
  if (
    intent.includes('signup') ||
    intent.includes('sign up') ||
    intent.includes('register') ||
    intent.includes('registration') ||
    intent.includes('form') ||
    intent.includes('submission') ||
    intent.includes('welcome') ||
    intent.includes('confirmation') ||
    triggerType === 'form_submitted'
  ) {
    return 'registration';
  }

  // Meeting indicators
  if (
    intent.includes('meeting') ||
    intent.includes('weekly') ||
    intent.includes('team update') ||
    intent.includes('office') ||
    intent.includes('standup') ||
    intent.includes('recurring') ||
    intent.includes('schedule') ||
    intent.includes('calendar')
  ) {
    return 'weekly_meeting';
  }

  // Default to custom
  return 'custom';
}

/**
 * Enhance email step config with preset template
 */
export function enhanceEmailWithPreset(
  userIntent: string,
  currentConfig: any,
  triggerType?: string
): {
  to?: string;
  subject: string;
  heading: string;
  body: string;
  intro?: string;
  ctaText?: string;
  ctaLink?: string;
  signatureName?: string;
  replyHint?: string;
  templateType: EmailTemplateType;
  _actionType?: string;
} {
  // Infer template type from intent
  const templateType = inferTemplateType(userIntent, triggerType);

  // Determine context type
  const contextType: ContextType = triggerType === 'form_submitted' ? 'form_submission' : 'manual';

  // Generate structured content using preset
  const content = generatePresetEmail({
    templateType,
    contextType,
    contextSummary: userIntent,
    variables: currentConfig,
  });

  return {
    to: currentConfig.to,
    ...content,
    templateType,
    _actionType: `EMAIL.${templateType.toUpperCase()}`,
  };
}
