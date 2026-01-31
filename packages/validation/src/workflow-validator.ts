import {
  WorkflowValidationResult,
  StepValidationResult,
  ValidationContext,
} from './types';
import { getStepValidator } from './step-validators';
import { isEmpty } from './utils';

/**
 * Main workflow validator
 * Validates the entire workflow structure and all steps
 */
export class WorkflowValidator {
  /**
   * Validate a complete workflow
   */
  async validateWorkflow(workflow: any, context: ValidationContext): Promise<WorkflowValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const stepResults: StepValidationResult[] = [];

    // 1. Validate workflow structure
    const structureErrors = this.validateWorkflowStructure(workflow);
    errors.push(...structureErrors);

    // 2. Validate user limits
    const limitWarnings = this.validateUserLimits(workflow, context);
    warnings.push(...limitWarnings);

    // 3. Validate each step
    for (const step of workflow.steps || []) {
      const stepResult = await this.validateStep(step, context);
      stepResults.push(stepResult);

      if (!stepResult.valid) {
        errors.push(...stepResult.errors);
      }
      if (stepResult.warnings.length > 0) {
        warnings.push(...stepResult.warnings);
      }
    }

    // 4. Validate step references (e.g., triggerStepId exists)
    const refErrors = this.validateStepReferences(workflow);
    errors.push(...refErrors);

    // 5. Validate trigger configuration
    const triggerWarnings = this.validateTrigger(workflow, context);
    warnings.push(...triggerWarnings);

    // 6. Determine if workflow can execute
    const canExecute = errors.length === 0;

    return {
      valid: errors.length === 0,
      workflowId: workflow.id || undefined,
      errors,
      warnings,
      stepResults,
      canExecute,
    };
  }

  /**
   * Validate workflow structure
   */
  private validateWorkflowStructure(workflow: any): string[] {
    const errors: string[] = [];

    if (!workflow.name || workflow.name.trim() === '') {
      errors.push('Workflow must have a name');
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    if (!workflow.triggerStepId) {
      errors.push('Workflow must have a trigger step ID');
    }

    return errors;
  }

  /**
   * Validate user limits
   */
  private validateUserLimits(workflow: any, context: ValidationContext): string[] {
    const warnings: string[] = [];

    if (context.userLimits) {
      if (workflow.steps.length > context.userLimits.maxStepsPerWorkflow) {
        warnings.push(
          `Workflow exceeds maximum steps (${context.userLimits.maxStepsPerWorkflow}). ` +
          `Current: ${workflow.steps.length} steps.`
        );
      }
    }

    return warnings;
  }

  /**
   * Validate a single step
   */
  private async validateStep(step: any, context: ValidationContext): Promise<StepValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingFields: string[] = [];
    const invalidFields: Record<string, string> = {};

    // 1. Validate step structure
    if (!step.id) {
      errors.push('Step must have an ID');
    }

    if (!step.type) {
      errors.push('Step must have a type');
    }

    if (!step.name || step.name.trim() === '') {
      errors.push('Step must have a name');
    }

    // 2. Get validator for this step type
    const validator = getStepValidator(step.type);

    if (!validator) {
      warnings.push(`No validator found for step type: ${step.type}`);
      return {
        valid: true,
        stepId: step.id || 'unknown',
        stepType: step.type,
        errors,
        warnings,
        missingFields,
        invalidFields,
      };
    }

    // 3. Check required fields
    for (const field of validator.requiredFields) {
      if (isEmpty(step.config?.[field])) {
        missingFields.push(field);
        errors.push(`Step '${step.name}' is missing required field: ${field}`);
      }
    }

    // 4. Run step-type specific validation
    const validationResult = validator.validate(step.config || {}, context);

    if (!validationResult.valid) {
      errors.push(...(validationResult.errors || []));
    }

    if (validationResult.warnings) {
      warnings.push(...validationResult.warnings);
    }

    return {
      valid: errors.length === 0,
      stepId: step.id,
      stepType: step.type,
      errors,
      warnings,
      missingFields,
      invalidFields,
    };
  }

  /**
   * Validate step references
   */
  private validateStepReferences(workflow: any): string[] {
    const errors: string[] = [];

    if (workflow.triggerStepId) {
      const triggerStep = (workflow.steps || []).find((s: any) => s.id === workflow.triggerStepId);
      if (!triggerStep) {
        errors.push(`Trigger step ID '${workflow.triggerStepId}' not found in workflow steps`);
      }
    }

    return errors;
  }

  /**
   * Validate trigger configuration
   */
  private validateTrigger(workflow: any, context: ValidationContext): string[] {
    const warnings: string[] = [];
    return warnings;
  }
}

/**
 * Create a default validation context
 */
export function createDefaultContext(): ValidationContext {
  return {
    availableVariables: {
      user: {
        id: 'sample-user-id',
        email: 'user@example.com',
        name: 'Sample User',
      },
      workflow: {
        id: 'sample-workflow-id',
        name: 'Sample Workflow',
      },
      timestamp: new Date().toISOString(),
    },
    integrations: {
      slack: false,
      sendgrid: false,
      twilio: false,
      mailchimp: false,
      asana: false,
    },
    userLimits: {
      maxStepsPerWorkflow: 50,
      maxExecutionsPerDay: 1000,
    },
  };
}
