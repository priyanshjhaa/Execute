/**
 * Structured Action Prompts
 *
 * LLM outputs action_type + variables
 * Execute owns the templates and structure
 */

export const STRUCTURED_ACTION_SYSTEM_PROMPT = `You are a workflow action classifier. Your job is to:
1. Identify the ACTION TYPE from the user's intent
2. Extract the VARIABLES needed for that action

You do NOT write emails, Slack messages, or any content.
You ONLY map intent → action type + variables.

Available Email Action Types:

EMAIL.WELCOME_USER
- Keywords: welcome, onboard, new user, sign up, signup, joined
- Variables: user_name, user_email, company_name

EMAIL.SIGNUP_CONFIRMATION
- Keywords: confirm, verify, confirmation email, email verification
- Variables: user_name, user_email, verification_link

EMAIL.PASSWORD_RESET
- Keywords: password, reset, forgot password, change password
- Variables: user_name, company_name, reset_link

EMAIL.INTERNAL_NOTIFICATION
- Keywords: internal, team notification, alert, notify team
- Variables: notification_title, notification_message, details (optional)

EMAIL.CLIENT_UPDATE
- Keywords: client, customer, update, inform client
- Variables: client_name, update_type, update_message

EMAIL.GENERIC_NOTIFICATION
- Keywords: notification, notify, alert, inform (fallback)
- Variables: recipient_name, title, message

Output Format (JSON ONLY):
{
  "action_type": "EMAIL.XXX",
  "variables": {
    "variable_name": "value or {{template_var}}",
    ...
  },
  "reasoning": "Brief explanation of why this action type was chosen"
}

IMPORTANT:
- Use {{template_var}} for dynamic values (user.name, user.email, company.name, etc.)
- Use literal strings for fixed values
- If a variable has no clear value, use a descriptive {{placeholder}}`;

/**
 * Build prompt for structured action classification
 */
export function buildStructuredActionPrompt(userIntent: string): string {
  return `Classify this user intent into an action type:

"${userIntent}"

Return the action type and extracted variables as JSON.`;
}

/**
 * Variable mappings from common terms to template variables
 */
export const VARIABLE_MAPPINGS: Record<string, string> = {
  // Name variations
  'name': 'user_name',
  'username': 'user_name',
  'user': 'user_name',

  // Email variations
  'email': 'user_email',
  'email address': 'user_email',

  // Company variations
  'company': 'company_name',
  'organization': 'company_name',
  'org': 'company_name',
  'app': 'company_name',

  // Client variations
  'client': 'client_name',
  'customer': 'client_name',

  // Common CTAs
  'link': 'cta_link',
  'url': 'cta_link',
  'verify link': 'verification_link',
  'reset link': 'reset_link',
};

/**
 * Helper to convert user intent to structured action
 */
export interface StructuredAction {
  action_type: string;
  variables: Record<string, string>;
  reasoning?: string;
}

export async function classifyStructuredAction(
  userIntent: string,
  llmCall: (system: string, user: string) => Promise<string>
): Promise<StructuredAction> {
  try {
    const response = await llmCall(STRUCTURED_ACTION_SYSTEM_PROMPT, buildStructuredActionPrompt(userIntent));

    const cleaned = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (error) {
    // Fallback to generic classification
    console.error('[ActionClassifier] Failed, using fallback:', error);
    return {
      action_type: 'EMAIL.GENERIC_NOTIFICATION',
      variables: {
        recipient_name: '{{user.name}}',
        title: 'Notification',
        message: userIntent,
      },
      reasoning: 'Fallback classification due to error',
    };
  }
}
