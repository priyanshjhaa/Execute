/**
 * Template Variable Resolver
 *
 * Replaces {{variable}} placeholders with actual values
 *
 * Supported variables:
 * - {{user.id}}, {{user.email}}, {{user.name}}
 * - {{workflow.id}}, {{workflow.name}}
 * - {{trigger.data.*}} - data from trigger payload
 * - {{steps.<stepId>.data.*}} - results from previous steps
 */

import type { ExecutionContext } from './types.js';

export class TemplateResolver {
  /**
   * Resolve template variables in a string
   */
  resolve(template: string, context: ExecutionContext): string {
    if (!template || typeof template !== 'string') {
      return template;
    }

    let result = template;

    // User variables
    result = result.replace(/\{\{user\.id\}\}/g, context.user.id);
    result = result.replace(/\{\{user\.email\}\}/g, context.user.email);
    result = result.replace(/\{\{user\.name\}\}/g, context.user.name || '');

    // Workflow variables
    result = result.replace(/\{\{workflow\.id\}\}/g, context.workflow.id);
    result = result.replace(/\{\{workflow\.name\}\}/g, context.workflow.name);

    // Trigger data variables (simple dot notation)
    if (context.triggerData) {
      result = this.resolveObjectVars(result, 'trigger.data', context.triggerData);
    }

    // Step result variables
    for (const [stepId, stepResult] of context.stepResults.entries()) {
      if (stepResult.data) {
        result = this.resolveObjectVars(result, `steps.${stepId}.data`, stepResult.data);
      }
    }

    return result;
  }

  /**
   * Resolve object dot notation variables
   * e.g., {{trigger.data.user.email}} -> actual value
   */
  private resolveObjectVars(template: string, prefix: string, obj: any): string {
    const pattern = new RegExp(`\\{\\{${prefix.replace('.', '\\\\.')}\\.([^}]+)\\}\\}`, 'g');
    return template.replace(pattern, (match, path) => {
      const value = this.getNestedValue(obj, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current?.[key];
    }, obj);
  }

  /**
   * Resolve template variables in an object (recursively)
   */
  resolveObject(obj: any, context: ExecutionContext): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveObject(item, context));
    }

    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolve(value, context);
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveObject(value, context);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }
}

/**
 * Create an execution context
 */
export function createContext(
  user: { id: string; email: string; name?: string },
  workflow: { id: string; name: string },
  executionId: string,
  triggerData?: Record<string, any>
): ExecutionContext {
  return {
    user,
    workflow,
    executionId,
    triggerData,
    stepResults: new Map(),
  };
}

export const templateResolver = new TemplateResolver();
