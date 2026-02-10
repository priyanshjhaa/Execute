/**
 * Structured Email Content Generator
 *
 * Uses pre-defined templates instead of LLM-generated content
 * LLM classifies intent → action type
 * Execute renders the template with variables
 */

import OpenAI from 'openai';
import Groq from 'groq-sdk';
import {
  getEmailTemplate,
  renderEmailTemplate,
  classifyStructuredAction,
  type StructuredAction,
} from './action-templates/index.js';

// Get API keys from environment
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

/**
 * Call LLM with Groq/OpenRouter fallback
 */
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const models: Array<{ provider: 'groq' | 'openrouter'; model: string; client: OpenAI | Groq }> = [];

  if (GROQ_API_KEY) {
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    models.push(
      { provider: 'groq', model: 'llama-3.3-70b-versatile', client: groq },
      { provider: 'groq', model: 'llama-3.3-8b-8192', client: groq },
    );
  }

  if (OPENROUTER_API_KEY) {
    const openrouter = new OpenAI({
      apiKey: OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
    models.push(
      { provider: 'openrouter', model: 'google/gemma-3-4b-it', client: openrouter },
      { provider: 'openrouter', model: 'meta-llama/llama-3.2-3b-instruct:free', client: openrouter },
    );
  }

  if (models.length === 0) {
    throw new Error('No LLM API keys configured');
  }

  const errors: string[] = [];
  for (const { provider, model, client } of models) {
    try {
      let response: any;
      if (provider === 'groq') {
        response = await (client as Groq).chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        });
      } else {
        response = await (client as OpenAI).chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        });
      }

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response');

      console.log(`[StructuredEmail] Used ${provider}/${model}`);
      return content;
    } catch (error: any) {
      errors.push(`${provider}/${model}: ${error.message}`);
    }
  }

  throw new Error(`All LLM providers failed: ${errors.join(', ')}`);
}

/**
 * Generate email content using structured templates
 *
 * 1. LLM classifies intent → action_type
 * 2. Execute picks the template
 * 3. Execute renders with variables
 */
export async function generateStructuredEmailContent(
  userIntent: string,
  recipientInfo?: { name?: string; email?: string; company?: string }
): Promise<{
  subject: string;
  html: string;
  text: string;
  actionType: string;
  variables: Record<string, string>;
}> {
  // Step 1: Classify intent → action_type + variables
  const action: StructuredAction = await classifyStructuredAction(userIntent, callLLM);

  console.log(`[StructuredEmail] Action: ${action.action_type}`);
  console.log(`[StructuredEmail] Variables:`, JSON.stringify(action.variables, null, 2));

  // Step 2: Get the template
  const template = getEmailTemplate(action.action_type);

  if (!template) {
    throw new Error(`Unknown action type: ${action.action_type}`);
  }

  // Step 3: Merge extracted variables with recipient info
  const finalVariables = { ...action.variables };

  if (recipientInfo?.name && !finalVariables.user_name) {
    finalVariables.user_name = recipientInfo.name;
  }
  if (recipientInfo?.email && !finalVariables.user_email) {
    finalVariables.user_email = recipientInfo.email;
  }
  if (recipientInfo?.company && !finalVariables.company_name) {
    finalVariables.company_name = recipientInfo.company;
  }

  // Add defaults for common variables
  if (!finalVariables.company_name) {
    finalVariables.company_name = 'Execute';
  }
  if (!finalVariables.timestamp) {
    finalVariables.timestamp = new Date().toLocaleString();
  }

  // Step 4: Render the template
  const rendered = renderEmailTemplate(template, finalVariables);

  return {
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    actionType: action.action_type,
    variables: finalVariables,
  };
}

/**
 * Enhance email step config with structured template
 */
export async function enhanceEmailStepStructured(
  userIntent: string,
  currentConfig: { to?: string; subject?: string; body?: string },
  recipientInfo?: { name?: string; email?: string; company?: string }
): Promise<{ to?: string; subject: string; body: string; _textBody?: string; _actionType?: string }> {
  const generated = await generateStructuredEmailContent(userIntent, recipientInfo);

  return {
    to: currentConfig.to,
    subject: generated.subject,
    body: generated.html,
    _textBody: generated.text,
    _actionType: generated.actionType,
  };
}
