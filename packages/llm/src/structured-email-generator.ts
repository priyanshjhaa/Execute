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
  if (!finalVariables.user_name) {
    finalVariables.user_name = '{{name}}';
  }
  if (!finalVariables.user_email) {
    finalVariables.user_email = '{{email}}';
  }
  if (!finalVariables.client_name) {
    finalVariables.client_name = '{{name}}';
  }
  if (!finalVariables.recipient_name) {
    finalVariables.recipient_name = '{{name}}';
  }
  if (!finalVariables.sender_name) {
    finalVariables.sender_name = 'Execute';
  }
  if (!finalVariables.cta_link) {
    finalVariables.cta_link = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }
  if (!finalVariables.cta_text) {
    finalVariables.cta_text = 'Open Execute';
  }

  // Welcome flows should always read as a welcome email even if the classifier
  // failed to populate extra fields.
  if (action.action_type === 'EMAIL.WELCOME_USER') {
    finalVariables.company_name = finalVariables.company_name || 'Execute';
    finalVariables.cta_link = finalVariables.cta_link || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
 *
 * NEW FORMAT: Outputs structured content fields (subject, heading, body, etc.)
 * instead of full HTML. The email renderer will handle styling.
 */
export async function enhanceEmailStepStructured(
  userIntent: string,
  currentConfig: { to?: string; subject?: string; body?: string },
  recipientInfo?: { name?: string; email?: string; company?: string }
): Promise<{
  to?: string;
  subject: string;
  heading: string;
  body: string;
  intro?: string;
  ctaText?: string;
  ctaLink?: string;
  signatureName?: string;
  replyHint?: string;
  _actionType?: string;
}> {
  const generated = await generateStructuredEmailContent(userIntent, recipientInfo);

  // Extract structured content from the generated template
  // The templates already have structured data, we just need to parse it
  const actionType = generated.actionType;

  // Extract subject (already available)
  const subject = generated.subject;

  // Extract heading from HTML with better pattern
  const headingMatch = generated.html.match(/<h1[^>]*>(.*?)<\/h1>/is);
  let heading = 'Update from Execute';
  if (headingMatch) {
    const extracted = headingMatch[1].replace(/<[^>]*>/g, '').trim();
    if (extracted && extracted.length > 0) {
      heading = extracted;
    }
  }

  // Extract all paragraphs from HTML
  const paragraphMatches = [...generated.html.matchAll(/<p[^>]*>(.*?)<\/p>/gis)];
  const paragraphs: string[] = [];
  for (const match of paragraphMatches) {
    const text = match[1].replace(/<[^>]*>/g, '').trim();
    if (text && text.length > 0) {
      paragraphs.push(text);
    }
  }

  // First paragraph is intro (optional)
  const intro = paragraphs.length > 0 ? paragraphs[0] : undefined;

  // Remaining paragraphs form the body
  const body = paragraphs.slice(1).join('\n\n') || 'Please review the update above.';

  // Extract CTA if present
  const ctaMatch = generated.html.match(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/is);
  let ctaText: string | undefined;
  let ctaLink: string | undefined;

  if (ctaMatch) {
    const extractedText = ctaMatch[2].replace(/<[^>]*>/g, '').trim();
    const extractedLink = ctaMatch[1];
    if (extractedText && extractedText.length > 0 && extractedLink && extractedLink.length > 0) {
      ctaText = extractedText;
      ctaLink = extractedLink;
    }
  }

  // Extract signature if present
  const signatureMatch = generated.html.match(/Best regards,?\s*<br>\s*<strong>(.*?)<\/strong>/is);
  const signatureName = signatureMatch ? signatureMatch[1].trim() : undefined;

  // Default reply hint for common action types
  let replyHint: string | undefined;
  if (actionType === 'EMAIL.NOTIFICATION_NEW_CLIENT') {
    replyHint = 'Please review this information and follow up with the client as needed.';
  } else if (actionType === 'EMAIL.WELCOME_USER') {
    replyHint = 'If you have any questions, feel free to reach out to our support team.';
  } else if (actionType === 'EMAIL.CLIENT_UPDATE') {
    replyHint = 'Please take appropriate action based on this update.';
  }

  return {
    to: currentConfig.to,
    subject: subject as string,
    heading: heading as string,
    body: body as string,
    intro,
    ctaText,
    ctaLink,
    signatureName,
    replyHint,
    _actionType: actionType,
  };
}
