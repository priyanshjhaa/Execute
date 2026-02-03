/**
 * Retry Utility
 *
 * Provides exponential backoff retry logic for external API calls.
 */

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to delay (default: true) */
  jitter?: boolean;
  /** Status codes that should trigger retry (default: 408, 429, 500+) */
  retryableStatuses?: number[];
  /** Error codes/messages that should trigger retry */
  retryableErrors?: string[];
}

export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: string;
  /** Number of attempts made */
  attempts: number;
  /** Total delay time in milliseconds */
  totalDelay: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'network',
    'timeout',
    'fetch failed',
  ],
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  config: Required<RetryConfig>
): number {
  // Exponential backoff: baseDelay * (backoffMultiplier ^ attempt)
  let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);

  // Cap at max delay
  delay = Math.min(delay, config.maxDelay);

  // Add jitter (randomization) to avoid thundering herd
  if (config.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.floor(delay);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(
  error: Error | { message?: string },
  config: Required<RetryConfig>
): boolean {
  const errorMessage = error.message?.toLowerCase() || '';

  // Check if error message contains any retryable patterns
  return config.retryableErrors.some((pattern) =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Check if a fetch response status is retryable
 */
function isRetryableStatus(
  status: number,
  config: Required<RetryConfig>
): boolean {
  return config.retryableStatuses.includes(status);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an operation with retry logic
 *
 * @param operation Function to execute (returns a promise)
 * @param config Retry configuration
 * @returns Retry result with success status and data/error
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const maxAttempts = finalConfig.maxRetries + 1; // Initial attempt + retries
  let lastError: Error | undefined;
  let totalDelay = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await operation();

      // If we have a Response object (fetch), check status
      if (
        data instanceof Response &&
        !data.ok &&
        isRetryableStatus(data.status, finalConfig) &&
        attempt < maxAttempts - 1
      ) {
        // Status is retryable and we have retries left
        const delay = calculateDelay(attempt, finalConfig);
        totalDelay += delay;
        await sleep(delay);
        continue;
      }

      // Success or non-retryable error
      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalDelay,
      };
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (
        isRetryableError(error, finalConfig) &&
        attempt < maxAttempts - 1
      ) {
        const delay = calculateDelay(attempt, finalConfig);
        totalDelay += delay;
        await sleep(delay);
        continue;
      }

      // Non-retryable error or no retries left
      break;
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError?.message || 'Operation failed after retries',
    attempts: maxAttempts,
    totalDelay,
  };
}

/**
 * Execute a fetch operation with retry logic
 *
 * @param url URL to fetch
 * @param init Fetch options
 * @param config Retry configuration
 * @returns Retry result with Response object
 */
export async function fetchWithRetry(
  url: string | URL,
  init?: RequestInit,
  config: RetryConfig = {}
): Promise<RetryResult<Response>> {
  return withRetry(async () => fetch(url, init), config);
}

/**
 * Parse step config retry settings
 *
 * Extracts retry configuration from step config.
 * Returns undefined if retry is not enabled.
 */
export function parseRetryConfig(
  stepConfig: { retry?: boolean | number | RetryConfig }
): RetryConfig | undefined {
  const retry = stepConfig.retry;

  if (!retry) {
    return undefined;
  }

  if (typeof retry === 'boolean') {
    return {}; // Use defaults
  }

  if (typeof retry === 'number') {
    return { maxRetries: retry };
  }

  return retry;
}
