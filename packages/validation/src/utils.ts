/**
 * Common validation utilities
 */

import type { ValidationResult } from './types';

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if value is a valid URL
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
 * Check if value is a valid UUID
 */
export function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if cron expression is valid
 */
export function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return false;
  return true; // Basic validation
}

/**
 * Check if string is empty
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Check if value is a valid phone number (basic validation)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Validate template variables in a string
 */
export function validateTemplateVariables(template: string, availableVars: Record<string, any>): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Find all {{variable}} patterns
  const varPattern = /\{\{([^}]+)\}\}/g;
  let match;
  const usedVars = new Set<string>();

  while ((match = varPattern.exec(template)) !== null) {
    const varPath = match[1];
    usedVars.add(varPath);

    // Check if variable exists
    const parts = varPath.split('.');
    let current: any = availableVars;

    for (const part of parts) {
      if (current === null || current === undefined || !(part in current)) {
        missing.push(varPath);
        break;
      }
      current = current[part];
    }
  }

  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
    errors: missing.length > 0 ? missing.map(m => `Unknown variable: {{${m}}}`) : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Merge multiple validation results
 */
export function mergeValidationResults(results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap(r => r.errors || []);
  const allWarnings = results.flatMap(r => r.warnings || []);
  const allMissing = results.flatMap(r => r.missing || []);
  const hasErrors = allErrors.length > 0;

  return {
    valid: !hasErrors,
    missing: allMissing.length > 0 ? allMissing : undefined,
    errors: allErrors.length > 0 ? allErrors : undefined,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  };
}
