import { z } from 'zod';
import Groq from 'groq-sdk';
import OpenAI from 'openai';

// Intent types
export enum QuickCommandIntent {
  LOG_EVENT = 'log_event',
  EXECUTE_NOW = 'execute_now',
  SCHEDULE_FOLLOWUP = 'schedule_followup',
  QUERY_ONLY = 'query_only',
}

export enum EntityType {
  CLIENT = 'client',
  EXPENSE = 'expense',
  NOTE = 'note',
  TASK = 'task',
  EMAIL = 'email',
  CONTACT = 'contact',
  REMINDER = 'reminder',
}

// Schema for LLM response
export const QuickCommandResponseSchema = z.object({
  intent: z.enum(['log_event', 'execute_now', 'schedule_followup', 'query_only']),
  entity: z.enum(['client', 'expense', 'note', 'task', 'email', 'contact', 'reminder']),
  title: z.string(),
  data: z.record(z.any()).optional(),
  delay_days: z.number().optional(),
  delay_hours: z.number().optional(),
});

export type QuickCommandResponse = z.infer<typeof QuickCommandResponseSchema>;

// System prompt for quick command classification
const QUICK_COMMAND_SYSTEM_PROMPT = `You are a helpful assistant that classifies user commands into intents.

The user will type a single sentence describing what happened or what they want.

Classify into one of these intents:
1. "log_event" - User wants to record/save information (client signed, expense paid, note, etc.)
2. "execute_now" - User wants to do something immediately (send email, add contact, etc.)
3. "schedule_followup" - User wants to save info AND be reminded later
4. "query_only" - User is asking for information (expense totals, lists, etc.)

Extract the entity type:
- client: New client signed, business acquired, etc.
- expense: Money spent, payment made, etc.
- note: General note, information to remember
- task: Task to be done
- email: Send an email
- contact: Add someone to contacts
- reminder: Set a reminder

Extract relevant data:
- For expenses: amount (number), currency, category, description
- For clients: company name, contact person
- For email: recipient, subject, message
- For contacts: name, email, phone, list/group

For "schedule_followup", also suggest when to follow up:
- delay_days: Number of days to wait
- delay_hours: Number of hours to wait

Return ONLY valid JSON.

Example:
Input: "We signed Acme Corp today"
Output: {"intent":"log_event","entity":"client","title":"Acme Corp signed as client","data":{"company":"Acme Corp"}}

Input: "Paid ₹25,000 for Facebook ads"
Output: {"intent":"log_event","entity":"expense","title":"Facebook ads expense","data":{"amount":25000,"currency":"INR","category":"marketing","description":"Facebook ads"}}

Input: "Send meeting reminder to team"
Output: {"intent":"execute_now","entity":"email","title":"Send meeting reminder to team","data":{"recipient":"team","subject":"Meeting reminder"}}

Input: "Client presentation sent"
Output: {"intent":"schedule_followup","entity":"reminder","title":"Follow up after client presentation","data":{"description":"Follow up on client presentation"},"delay_days":5}

Input: "What's my expense total?"
Output: {"intent":"query_only","entity":"expense","title":"Query expense total"}`;

interface ModelConfig {
  provider: 'groq' | 'openrouter';
  model: string;
  client: Groq | OpenAI;
}

export class QuickCommandParser {
  models: ModelConfig[];

  constructor(groqKey: string, openrouterKey: string) {
    this.models = [];

    // Groq models (primary)
    if (groqKey) {
      const groq = new Groq({ apiKey: groqKey });
      this.models.push(
        { provider: 'groq', model: 'llama-3.3-70b-versatile', client: groq },
        { provider: 'groq', model: 'llama-3.3-8b-8192', client: groq },
      );
    }

    // OpenRouter models (fallback)
    if (openrouterKey) {
      const openrouter = new OpenAI({
        apiKey: openrouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
      this.models.push(
        { provider: 'openrouter', model: 'google/gemma-3-4b-it', client: openrouter },
      );
    }
  }

  async parse(userInput: string): Promise<QuickCommandResponse> {
    const errors: Array<{ provider: string; model: string; error: string }> = [];

    for (const { provider, model, client } of this.models) {
      try {
        console.log(`QuickCommand: Trying ${provider}/${model}`);

        let response;
        if (provider === 'groq') {
          response = await (client as Groq).chat.completions.create({
            model,
            messages: [
              { role: 'system', content: QUICK_COMMAND_SYSTEM_PROMPT },
              { role: 'user', content: userInput },
            ],
            temperature: 0.1,
            max_tokens: 512,
            response_format: { type: 'json_object' },
          });
        } else {
          response = await (client as OpenAI).chat.completions.create({
            model,
            messages: [
              { role: 'system', content: QUICK_COMMAND_SYSTEM_PROMPT },
              { role: 'user', content: userInput },
            ],
            temperature: 0.1,
            max_tokens: 512,
            response_format: { type: 'json_object' },
          });
        }

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from model');
        }

        // Clean and validate
        const cleaned = this.cleanJSONResponse(content);
        const parsed = JSON.parse(cleaned);
        const validated = QuickCommandResponseSchema.parse(parsed);

        console.log(`QuickCommand: Successfully parsed with ${provider}/${model}`);
        return validated;

      } catch (error: any) {
        console.error(`QuickCommand: Failed with ${provider}/${model}:`, error.message);
        errors.push({ provider, model, error: error.message });
        continue;
      }
    }

    // All models failed
    console.error('QuickCommand: All models failed', errors);
    throw new Error(`Failed to classify intent. Errors: ${errors.map(e => e.error).join('; ')}`);
  }

  private cleanJSONResponse(response: string): string {
    let cleaned = response.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    return cleaned;
  }
}

export function createQuickCommandParser(): QuickCommandParser {
  const groqKey = process.env.GROQ_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!groqKey && !openrouterKey) {
    throw new Error('No LLM API keys found. Set GROQ_API_KEY or OPENROUTER_API_KEY');
  }

  return new QuickCommandParser(groqKey || '', openrouterKey || '');
}
