import { StepValidator, ValidationResult, ValidationContext } from './types';
import {
  isValidEmail,
  isValidUrl,
  isValidPhoneNumber,
  validateTemplateVariables,
  isEmpty,
} from './utils';

/**
 * Validator: Send Email
 * Validates recipient (to or recipients), subject, body
 * Supports Resend (not SendGrid)
 */
export const sendEmailValidator: StepValidator = {
  stepType: 'send_email',
  requiredFields: [],
  optionalFields: ['to', 'recipients', 'subject', 'body', 'from', 'cc', 'bcc', 'replyTo', 'personalize'],

  validate: (config: any, context: ValidationContext): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if we have either 'to' or 'recipients'
    const hasTo = !isEmpty(config.to);
    const hasRecipients = !isEmpty(config.recipients);

    if (!hasTo && !hasRecipients) {
      errors.push("Either 'to' or 'recipients' field is required");
    }

    // Validate 'to' if provided (manual email entry)
    if (hasTo && !isEmpty(config.to)) {
      if (Array.isArray(config.to)) {
        const invalidEmails = config.to.filter((email: string) => !isValidEmail(email));
        if (invalidEmails.length > 0) {
          errors.push(`Invalid email format in 'to' field: ${invalidEmails.join(', ')}`);
        }
      } else if (!isValidEmail(config.to)) {
        errors.push(`Invalid email format in 'to' field: ${config.to}`);
      }
    }

    // Validate 'recipients' if provided
    if (hasRecipients) {
      const { type, contactIds, groupId, filter } = config.recipients;
      const validTypes = ['manual', 'contacts', 'group', 'filter'];

      if (!type || !validTypes.includes(type)) {
        errors.push(`recipients.type must be one of: ${validTypes.join(', ')}`);
      }

      if (type === 'contacts' && (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0)) {
        errors.push("recipients.contactIds is required when type is 'contacts'");
      }

      if (type === 'group' && !groupId) {
        errors.push("recipients.groupId is required when type is 'group'");
      }

      if (type === 'filter' && !filter) {
        warnings.push("recipients.filter is recommended when type is 'filter'");
      }
    }

    // Validate 'subject'
    if (isEmpty(config.subject)) {
      errors.push("'subject' field is required");
    } else {
      const subjectVars = validateTemplateVariables(config.subject, context.availableVariables);
      if (!subjectVars.valid) {
        errors.push(`Missing variables in subject: ${subjectVars.missing?.join(', ')}`);
      }
    }

    // Validate 'body'
    if (isEmpty(config.body)) {
      errors.push("'body' field is required");
    } else {
      const bodyVars = validateTemplateVariables(config.body, context.availableVariables);
      if (!bodyVars.valid) {
        errors.push(`Missing variables in body: ${bodyVars.missing?.join(', ')}`);
      }
    }

    // Validate optional 'from' field if provided
    if (config.from && !isValidEmail(config.from)) {
      errors.push(`Invalid email format in 'from' field: ${config.from}`);
    }

    // Check if Resend is configured
    if (!context.integrations.resend && !process.env.RESEND_API_KEY) {
      warnings.push('Resend integration (RESEND_API_KEY) not configured. Email sending may fail.');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * Validator: Send Slack Message
 * Validates webhook URL or integrationId, and message
 */
export const sendSlackValidator: StepValidator = {
  stepType: 'send_slack',
  requiredFields: ['message'],
  optionalFields: ['webhook_url', 'integrationId', 'username', 'icon_emoji', 'icon_url', 'attachments', 'blocks'],

  validate: (config: any, context: ValidationContext): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate message
    if (isEmpty(config.message)) {
      errors.push("'message' field is required");
    } else {
      const msgVars = validateTemplateVariables(config.message, context.availableVariables);
      if (!msgVars.valid) {
        errors.push(`Missing variables in message: ${msgVars.missing?.join(', ')}`);
      }
    }

    // Check if we have webhook_url OR integrationId
    const hasWebhook = !isEmpty(config.webhook_url);
    const hasIntegration = !isEmpty(config.integrationId);

    if (!hasWebhook && !hasIntegration) {
      errors.push("Either 'webhook_url' or 'integrationId' field is required");
    }

    // Validate webhook URL if provided
    if (hasWebhook && !isValidUrl(config.webhook_url)) {
      errors.push('Invalid Slack webhook URL format');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * Validator: Send SMS
 * Validates phone number, message body
 */
export const sendSmsValidator: StepValidator = {
  stepType: 'send_sms',
  requiredFields: ['to', 'body'],
  optionalFields: ['from'],

  validate: (config: any, context: ValidationContext): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate phone number
    if (isEmpty(config.to)) {
      errors.push("'to' field is required");
    } else if (!isValidPhoneNumber(config.to)) {
      errors.push(`Invalid phone number format: ${config.to}. Use E.164 format (e.g., +1234567890)`);
    }

    // Validate message body
    if (isEmpty(config.body)) {
      errors.push("'body' field is required");
    } else {
      const bodyVars = validateTemplateVariables(config.body, context.availableVariables);
      if (!bodyVars.valid) {
        errors.push(`Missing variables in message: ${bodyVars.missing?.join(', ')}`);
      }
    }

    // Check message length (SMS limit is 160 chars for single message)
    if (config.body && config.body.length > 160) {
      warnings.push(`Message exceeds 160 characters. Current: ${config.body.length} chars. May be sent as multiple messages.`);
    }

    // Check if Twilio is configured
    if (!context.integrations.twilio) {
      warnings.push('Twilio integration not configured. SMS sending may fail.');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * Validator: HTTP Request
 * Validates URL, method, headers, body
 */
export const httpRequestValidator: StepValidator = {
  stepType: 'http_request',
  requiredFields: ['url', 'method'],
  optionalFields: ['headers', 'body', 'timeout', 'retry'],

  validate: (config: any, context: ValidationContext): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate URL
    if (isEmpty(config.url)) {
      errors.push("'url' field is required");
    } else if (!isValidUrl(config.url)) {
      errors.push(`Invalid URL format: ${config.url}`);
    } else {
      const urlVars = validateTemplateVariables(config.url, context.availableVariables);
      if (!urlVars.valid) {
        errors.push(`Missing variables in URL: ${urlVars.missing?.join(', ')}`);
      }
    }

    // Validate method
    if (isEmpty(config.method)) {
      errors.push("'method' field is required");
    } else {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      const upperMethod = config.method.toUpperCase();
      if (!validMethods.includes(upperMethod)) {
        errors.push(`Invalid HTTP method: ${config.method}. Must be one of: ${validMethods.join(', ')}`);
      }
    }

    // Validate headers if provided
    if (config.headers) {
      if (typeof config.headers !== 'object') {
        errors.push("'headers' must be an object");
      }
    }

    // Validate body for methods that support it
    const bodySupportedMethods = ['POST', 'PUT', 'PATCH'];
    if (config.body && !bodySupportedMethods.includes(config.method?.toUpperCase())) {
      warnings.push(`Body is not typically used with ${config.method?.toUpperCase()} requests`);
    }

    // Validate timeout if provided
    if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      errors.push("'timeout' must be a positive number (milliseconds)");
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * Validator: Create Task (Asana, Trello, etc.)
 */
export const createTaskValidator: StepValidator = {
  stepType: 'create_task',
  requiredFields: ['provider', 'title'],
  optionalFields: ['description', 'assignee', 'due_date', 'project', 'tags'],

  validate: (config: any, context: ValidationContext): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate provider
    const validProviders = ['asana', 'trello', 'jira', 'linear', 'clickup'];
    if (isEmpty(config.provider)) {
      errors.push("'provider' field is required");
    } else if (!validProviders.includes(config.provider.toLowerCase())) {
      errors.push(`Invalid provider: ${config.provider}. Must be one of: ${validProviders.join(', ')}`);
    }

    // Validate title
    if (isEmpty(config.title)) {
      errors.push("'title' field is required");
    } else {
      const titleVars = validateTemplateVariables(config.title, context.availableVariables);
      if (!titleVars.valid) {
        errors.push(`Missing variables in title: ${titleVars.missing?.join(', ')}`);
      }
    }

    // Validate description if provided
    if (config.description) {
      const descVars = validateTemplateVariables(config.description, context.availableVariables);
      if (!descVars.valid) {
        errors.push(`Missing variables in description: ${descVars.missing?.join(', ')}`);
      }
    }

    // Check if integration is configured
    if (config.provider === 'asana' && !context.integrations.asana) {
      warnings.push('Asana integration not configured. Task creation may fail.');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * Validator: Add to List (Mailchimp, etc.)
 */
export const addToListValidator: StepValidator = {
  stepType: 'add_to_list',
  requiredFields: ['provider', 'list_id', 'email'],
  optionalFields: ['name', 'merge_fields', 'tags', 'double_optin'],

  validate: (config: any, _context: ValidationContext): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate provider
    const validProviders = ['mailchimp', 'convertkit', 'sendgrid'];
    if (isEmpty(config.provider)) {
      errors.push("'provider' field is required");
    } else if (!validProviders.includes(config.provider.toLowerCase())) {
      errors.push(`Invalid provider: ${config.provider}. Must be one of: ${validProviders.join(', ')}`);
    }

    // Validate list_id
    if (isEmpty(config.list_id)) {
      errors.push("'list_id' field is required");
    }

    // Validate email
    if (isEmpty(config.email)) {
      errors.push("'email' field is required");
    } else if (!isValidEmail(config.email)) {
      errors.push(`Invalid email format: ${config.email}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * Validator: Delay/Wait
 */
export const delayValidator: StepValidator = {
  stepType: 'delay',
  requiredFields: ['duration', 'unit'],
  optionalFields: [],

  validate: (config: any, _context: ValidationContext): ValidationResult => {
    const errors: string[] = [];

    // Validate duration
    if (isEmpty(config.duration)) {
      errors.push("'duration' field is required");
    } else if (typeof config.duration !== 'number' || config.duration <= 0) {
      errors.push("'duration' must be a positive number");
    }

    // Validate unit
    const validUnits = ['seconds', 'minutes', 'hours', 'days'];
    if (isEmpty(config.unit)) {
      errors.push("'unit' field is required");
    } else if (!validUnits.includes(config.unit)) {
      errors.push(`Invalid unit: ${config.unit}. Must be one of: ${validUnits.join(', ')}`);
    }

    // Warn about long delays
    if (config.duration && config.unit === 'days' && config.duration > 30) {
      return {
        valid: true,
        warnings: ['Delay exceeds 30 days. Consider using a scheduled workflow instead.'],
      };
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * Registry of all step validators
 */
export const stepValidators: Record<string, StepValidator> = {
  send_email: sendEmailValidator,
  send_slack: sendSlackValidator,
  send_sms: sendSmsValidator,
  http_request: httpRequestValidator,
  create_task: createTaskValidator,
  add_to_list: addToListValidator,
  delay: delayValidator,
};

/**
 * Get validator for a step type
 */
export function getStepValidator(stepType: string): StepValidator | undefined {
  return stepValidators[stepType];
}
