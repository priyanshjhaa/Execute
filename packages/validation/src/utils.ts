/**
 * Common validation utilities
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate phone number (E.164 format)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

/**
 * Extract template variables from a string
 * Example: "Hi {{name}}, welcome!" → ['name']
 */
export function extractTemplateVariables(str: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(str)) !== null) {
    variables.push(match[1].trim());
  }

  return variables;
}

/**
 * Check if all template variables are available in context
 */
export function validateTemplateVariables(
  str: string,
  availableVariables: Record<string, any>
): { valid: boolean; missing: string[] } {
  const required = extractTemplateVariables(str);
  const missing = required.filter(v => {
    const keys = v.split('.');
    let current = availableVariables;

    for (const key of keys) {
      if (!current || !(key in current)) {
        return true;
      }
      current = current[key];
    }

    return false;
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Validate cron expression
 */
export function isValidCronExpression(cron: string): boolean {
  // Basic cron validation: 5 or 6 parts separated by spaces
  const parts = cron.trim().split(/\s+/);
  return parts.length === 5 || parts.length === 6;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Format error messages
 */
export function formatErrors(errors: string[]): string {
  return errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
}

/**
 * Merge multiple validation results
 */
export function mergeValidationResults(results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap(r => r.errors || []);
  const allWarnings = results.flatMap(r => r.warnings || []);
  const hasErrors = allErrors.length > 0;

  return {
    valid: !hasErrors,
    errors: hasErrors ? allErrors : undefined,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  };
}
