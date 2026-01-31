/**
 * HTTP Request Step Handler
 *
 * Makes HTTP requests to external APIs.
 * This is the "escape hatch" - can connect to ANY service.
 */

import type { StepHandler, Step, StepResult, ExecutionContext } from '../types.js';
import { templateResolver } from '../context.js';

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

      // Make request with AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
}
