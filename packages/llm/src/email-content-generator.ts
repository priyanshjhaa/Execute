/**
 * Email Content Generator
 *
 * Generates professional HTML email content using LLM
 * Compatible with Resend API and common email clients
 */

import OpenAI from 'openai';
import Groq from 'groq-sdk';
import {
  EMAIL_CONTENT_SYSTEM_PROMPT,
  buildEmailContentPrompt,
  type EmailContentRequest,
  type GeneratedEmailContent,
} from './prompts/email-prompts.js';

// Get API keys from environment
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

/**
 * Call LLM with retry logic across multiple models
 */
async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const models: Array<{ provider: 'groq' | 'openrouter'; model: string; client: OpenAI | Groq }> = [];

  // Groq models (primary - very fast)
  if (GROQ_API_KEY) {
    const groq = new Groq({ apiKey: GROQ_API_KEY });
    models.push(
      { provider: 'groq', model: 'llama-3.3-70b-versatile', client: groq },
      { provider: 'groq', model: 'llama-3.3-8b-8192', client: groq },
    );
  }

  // OpenRouter models (fallback)
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

  // Try each model until one succeeds
  const errors: string[] = [];
  for (const { provider, model, client } of models) {
    try {
      console.log(`[EmailContentGen] Trying ${provider}/${model}`);

      let response: any;
      if (provider === 'groq') {
        response = await (client as Groq).chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        });
      } else {
        response = await (client as OpenAI).chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        });
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      console.log(`[EmailContentGen] Success with ${provider}/${model}`);
      return content;
    } catch (error: any) {
      const errorMsg = `${provider}/${model}: ${error.message}`;
      console.error(`[EmailContentGen] Failed: ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  throw new Error(`All LLM providers failed: ${errors.join(', ')}`);
}

/**
 * Generate professional email content based on user intent
 *
 * @param request - Email generation request with intent and optional parameters
 * @returns Generated email content with subject, HTML, and plain text versions
 */
export async function generateEmailContent(
  request: EmailContentRequest
): Promise<GeneratedEmailContent> {
  const systemPrompt = EMAIL_CONTENT_SYSTEM_PROMPT;
  const userPrompt = buildEmailContentPrompt(request);

  try {
    const response = await callLLM(systemPrompt, userPrompt);

    // Parse the JSON response
    const cleaned = response
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.subject || !parsed.html || !parsed.text) {
      throw new Error('Invalid email content: missing required fields');
    }

    return {
      subject: parsed.subject,
      html: parsed.html,
      text: parsed.text,
      preview: parsed.preview || parsed.text.substring(0, 100),
    };
  } catch (error: any) {
    // Fallback to basic email if generation fails
    console.error('Email content generation failed, using fallback:', error.message);

    return {
      subject: `Regarding: ${request.intent}`,
      html: generateFallbackHTML(request),
      text: `Hello,\n\n${request.intent}\n\nBest regards,\nThe Team`,
      preview: request.intent.substring(0, 100),
    };
  }
}

/**
 * Generate a basic HTML fallback
 */
function generateFallbackHTML(request: EmailContentRequest): string {
  const tone = request.tone || 'professional';
  const greeting = tone === 'casual' || tone === 'friendly' ? 'Hi' : 'Dear';

  return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background: white; padding: 30px; border-radius: 8px;">
    <h1 style="color: #333; margin-top: 0;">Update</h1>
    <p style="color: #555; line-height: 1.6;">${greeting} {{user.name}},</p>
    <p style="color: #555; line-height: 1.6;">${request.intent}</p>
    <p style="margin-top: 30px; color: #666;">Best regards,<br>The {{company.name}} Team</p>
  </div>
</body>
</html>`;
}

/**
 * Enhance existing email step with professional content
 *
 * @param intent - Original user intent description
 * @param currentConfig - Current email step config
 * @returns Enhanced config with professional HTML
 */
export async function enhanceEmailStep(
  intent: string,
  currentConfig: { to?: string; subject?: string; body?: string }
): Promise<{ to?: string; subject: string; body: string; _textBody?: string }> {
  const generated = await generateEmailContent({ intent });

  return {
    to: currentConfig.to,
    subject: generated.subject,
    body: generated.html,
    _textBody: generated.text,
  };
}
