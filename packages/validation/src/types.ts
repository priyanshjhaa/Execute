/**
 * Validation result for a single field or configuration
 */
export interface ValidationResult {
  missing?: string[];
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Complete validation result for a step
 */
export interface StepValidationResult {
  valid: boolean;
  stepId: string;
  stepType: string;
  errors: string[];
  warnings: string[];
  missingFields: string[];
  invalidFields: Record<string, string>;
}

/**
 * Complete workflow validation result
 */
export interface WorkflowValidationResult {
  valid: boolean;
  workflowId?: string;
  errors: string[];
  warnings: string[];
  stepResults: StepValidationResult[];
  canExecute: boolean;
}

/**
 * Validation context (what variables are available)
 */
export interface ValidationContext {
  availableVariables: Record<string, any>;
  integrations: {
    slack?: boolean;
    resend?: boolean;
    sendgrid?: boolean;
    twilio?: boolean;
    mailchimp?: boolean;
    asana?: boolean;
  };
  userLimits?: {
    maxStepsPerWorkflow: number;
    maxExecutionsPerDay: number;
  };
}

/**
 * Validator configuration for each step type
 */
export interface StepValidator {
  stepType: string;
  validate: (config: any, context: ValidationContext) => ValidationResult;
  requiredFields: string[];
  optionalFields: string[];
  validateIntegration?: (config: any, context: ValidationContext) => Promise<ValidationResult>;
}
