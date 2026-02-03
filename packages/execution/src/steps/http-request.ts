/**
 * HTTP Request Step Handler
 *
 * Makes HTTP requests to external APIs.
 * This is the "escape hatch" - can connect to ANY service.
 * Supports automatic retry with exponential backoff.
 */

import type { StepHandler, Step, StepResult, ExecutionContext } from '../types.js';
import { templateResolver } from '../context.js';
import { fetchWithRetry, parseRetryConfig } from '../retry.js';

export class HttpRequestStepHandler implements StepHandler {
  type = 'http_request';

  async execute(step: Step, context: ExecutionContext): Promise<StepResult> {
    const startedAt = new Date();

    // Validate config
    const config = step.config;
    if (!config.url || typeof config.url !== 'string') {
      return {
        stepId: step.id,
        status: 'failed',
        error: 'HTTP request requires a valid URL',
        startedAt,
        completedAt: new Date(),
      };
    }

    try {
      // Resolve template variables
      const url = templateResolver.resolve(config.url, context);
      const method = (config.method || 'POST').toUpperCase();

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
      };

      // Build body
      let body: string | undefined;
      if (config.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        if (typeof config.body === 'string') {
          body = templateResolver.resolve(config.body, context);
        } else if (typeof config.body === 'object') {
          body = JSON.stringify(templateResolver.resolveObject(config.body, context));
        }
      }

      // Set timeout
      const timeout = config.timeout ? parseInt(config.timeout, 10) * 1000 : 30000;

      // Get retry config from step config
      const retryConfig = parseRetryConfig(config);

      // Make request with retry logic
      const result = await this.makeRequest(
        url,
        method,
        headers,
        body,
        timeout,
        retryConfig
      );

      if (!result.success) {
        return {
          stepId: step.id,
          status: 'failed',
          error: result.error || 'HTTP request failed',
          data: result.attempts > 1 ? { attempts: result.attempts, totalDelay: result.totalDelay } : undefined,
          startedAt,
          completedAt: new Date(),
        };
      }

      const response = result.data as Response;

      // Get response body
      let responseBody: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      // Check for HTTP errors
      if (!response.ok) {
        return {
          stepId: step.id,
          status: 'failed',
          error: `HTTP ${response.status}: ${response.statusText}`,
          data: {
            status: response.status,
            statusText: response.statusText,
            body: responseBody,
            attempts: result.attempts,
            totalDelay: result.totalDelay,
          },
          startedAt,
          completedAt: new Date(),
        };
      }

      return {
        stepId: step.id,
        status: 'completed',
        data: {
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          attempts: result.attempts > 1 ? result.attempts : undefined,
          totalDelay: result.totalDelay > 0 ? result.totalDelay : undefined,
        },
        startedAt,
        completedAt: new Date(),
      };
    } catch (err: any) {
      return {
        stepId: step.id,
        status: 'failed',
        error: err.message || 'HTTP request failed',
        startedAt,
        completedAt: new Date(),
      };
    }
  }

  /**
   * Make HTTP request with optional retry logic
   */
  private async makeRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | undefined,
    timeout: number,
    retryConfig?: ReturnType<typeof parseRetryConfig>
  ) {
    if (retryConfig) {
      // Use retry logic
      return fetchWithRetry(
        url,
        {
          method,
          headers,
          body,
          // Create AbortSignal for timeout
          signal: AbortSignal.timeout(timeout),
        },
        retryConfig
      );
    }

    // No retry - single attempt
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeout),
      });
      return { success: true, data: response, attempts: 1, totalDelay: 0 };
    } catch (error: any) {
      return { success: false, error: error.message, attempts: 1, totalDelay: 0 };
    }
  }
}
