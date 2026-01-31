/**
 * Step Handler Registry
 *
 * Exports all step handlers for registration
 */

export { SendEmailStepHandler } from './send-email.js';
export { SendSlackStepHandler } from './send-slack.js';
export { HttpRequestStepHandler } from './http-request.js';
export { DelayStepHandler } from './delay.js';
export { ConditionalStepHandler } from './conditional.js';

import { SendEmailStepHandler } from './send-email.js';
import { SendSlackStepHandler } from './send-slack.js';
import { HttpRequestStepHandler } from './http-request.js';
import { DelayStepHandler } from './delay.js';
import { ConditionalStepHandler } from './conditional.js';

/**
 * Get all default step handlers
 */
export function getAllHandlers() {
  return [
    new SendEmailStepHandler(),
    new SendSlackStepHandler(),
    new HttpRequestStepHandler(),
    new DelayStepHandler(),
    new ConditionalStepHandler(),
  ];
}
