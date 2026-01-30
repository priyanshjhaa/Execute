// Optimized: Shorter prompt for faster processing
export const SYSTEM_PROMPT = `Convert workflow instructions to JSON.

Triggers: webhook, schedule, email_received, form_submitted, user_created, purchase_completed
Actions: send_email, send_slack, send_sms, http_request, create_task, add_to_list, delay, conditional

Step format: {id, type, name, description?, config, position}
Output format: {success, workflow: {name, description?, steps[], triggerStepId}, reasoning?}

Use real UUIDs. Template vars: {{variable}}

Return ONLY valid JSON.`;

export const buildParsePrompt = (input: {
  what: string;
  when: string;
  schedule?: string;
  event?: string;
  additionalContext?: string;
}): string => {
  let prompt = `Intent: "${input.what}"\nTrigger: ${input.when}`;

  if (input.when === 'schedule' && input.schedule) {
    prompt += `\nSchedule: ${input.schedule}`;
  }

  if (input.when === 'event' && input.event) {
    prompt += `\nEvent: ${input.event}`;
  }

  if (input.additionalContext) {
    prompt += `\nContext: ${input.additionalContext}`;
  }

  prompt += `\n\nReturn workflow JSON.`;

  return prompt;
};

export const buildSimpleParsePrompt = (instruction: string): string => {
  return `"${instruction}"\n\nReturn workflow JSON.`;
};
