/**
 * Smart Email Classification System
 *
 * Classifies emails into 3 types:
 * - REMINDER: Action required, upcoming tasks, deadlines
 * - NOTIFICATION: Informational updates, confirmations
 * - ALERT: Urgent, time-sensitive, requires immediate attention
 *
 * Uses LLM to extract user intent and map to appropriate email type
 */

export type EmailClassificationType = 'reminder' | 'notification' | 'alert';

export interface EmailIntent {
  // Classification
  type: EmailClassificationType;

  // Extracted entity information
  task?: string;
  entity?: string; // organization, company, system
  recipient_name?: string;
  action_required?: boolean;

  // Urgency indicators
  urgency?: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: string;
  time_sensitive?: boolean;

  // Original context
  original_message: string;
  reasoning?: string;
}

/**
 * Classification system prompt for LLM
 */
const CLASSIFICATION_SYSTEM_PROMPT = `You are an email classification expert. Your job is to:

1. Analyze the user's intent
2. Classify into ONE of these types:
   - REMINDER: Tasks, deadlines, action items, "don't forget", upcoming events
   - NOTIFICATION: Informational updates, confirmations, FYI, status changes
   - ALERT: Urgent issues, critical problems, immediate action needed, warnings

3. Extract key information:
   - task: What needs to be done?
   - entity: Organization, company, or system involved
   - recipient_name: Who should receive this
   - action_required: Does this need an action? (boolean)
   - urgency: low/medium/high/urgent
   - deadline: Any specific deadline mentioned
   - time_sensitive: Is timing critical? (boolean)

CLASSIFICATION RULES:

REMINDERS contain:
- "remind", "don't forget", "deadline", "due", "submit", "complete"
- Task-oriented language
- Future deadlines
- Action items

NOTIFICATIONS contain:
- "update", "confirm", "receipt", "summary", "report"
- Informational language
- No immediate action required
- Status changes

ALERTS contain:
- "urgent", "alert", "critical", "warning", "immediate", "ASAP"
- System failures, security issues
- Time-sensitive problems
- High urgency

Output JSON ONLY:
{
  "type": "reminder" | "notification" | "alert",
  "task": "specific task description",
  "entity": "organization/company name",
  "recipient_name": "recipient's name",
  "action_required": true/false,
  "urgency": "low" | "medium" | "high" | "urgent",
  "deadline": "deadline if mentioned",
  "time_sensitive": true/false,
  "reasoning": "brief explanation"
}`;

/**
 * Classification result for fallback cases
 */
function getFallbackClassification(userIntent: string): EmailIntent {
  const intent = userIntent.toLowerCase();

  // Check for ALERT keywords
  const alertKeywords = ['urgent', 'alert', 'critical', 'immediate', 'asap', 'emergency', 'warning', 'severe'];
  if (alertKeywords.some(kw => intent.includes(kw))) {
    return {
      type: 'alert',
      action_required: true,
      urgency: 'urgent',
      time_sensitive: true,
      original_message: userIntent,
      reasoning: 'Detected urgent/alert keywords',
    };
  }

  // Check for REMINDER keywords
  const reminderKeywords = [
    'remind', 'don\'t forget', 'deadline', 'due', 'submit', 'complete',
    'task', 'follow up', 'todo', 'progress report', 'review'
  ];
  if (reminderKeywords.some(kw => intent.includes(kw))) {
    return {
      type: 'reminder',
      action_required: true,
      urgency: 'medium',
      time_sensitive: false,
      original_message: userIntent,
      reasoning: 'Detected reminder/task keywords',
    };
  }

  // Default to NOTIFICATION
  return {
    type: 'notification',
    action_required: false,
    urgency: 'low',
    time_sensitive: false,
    original_message: userIntent,
    reasoning: 'Default classification - informational',
  };
}

/**
 * Extract entities using regex patterns
 */
function extractEntities(userIntent: string): Partial<EmailIntent> {
  const extracted: Partial<EmailIntent> = {};

  // Extract recipient name (patterns like "Hi [Name]", "Dear [Name]")
  const namePatterns = [
    /(?:hi|hello|dear|hey)\s+([A-Z][a-z]+)/i,
    /to\s+([A-Z][a-z]+)/i,
    /send\s+(?:to\s+)?([A-Z][a-z]+)/i,
  ];

  for (const pattern of namePatterns) {
    const match = userIntent.match(pattern);
    if (match && match[1]) {
      extracted.recipient_name = match[1];
      break;
    }
  }

  // Extract entity/organization (capitalized words in context)
  const entityPatterns = [
    /(?:from|at|to|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+University|University|Inc|LLC|Corp|Ltd))/,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+University)/,
  ];

  for (const pattern of entityPatterns) {
    const match = userIntent.match(pattern);
    if (match && match[1]) {
      extracted.entity = match[1];
      break;
    }
  }

  // Extract task/action (what needs to be done)
  const taskPatterns = [
    /(?:submit|complete|send|review|finish)\s+(.+?)(?:\s+(?:by|before|to|for)|$)/i,
    /(?:task|action|todo):\s*(.+?)(?:\.|$)/i,
  ];

  for (const pattern of taskPatterns) {
    const match = userIntent.match(pattern);
    if (match && match[1]) {
      extracted.task = match[1].trim();
      break;
    }
  }

  // Extract deadline
  const deadlinePatterns = [
    /(?:by|before|due)\s+(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|\d+\/\d+|\d+\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i,
    /(?:deadline|due date):\s*(.+?)(?:\.|$)/i,
  ];

  for (const pattern of deadlinePatterns) {
    const match = userIntent.match(pattern);
    if (match && match[1]) {
      extracted.deadline = match[1].trim();
      break;
    }
  }

  return extracted;
}

/**
 * Call LLM for classification
 */
async function callLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<any> {
  // Dynamic import to avoid build issues
  const { default: Groq } = await import('groq-sdk');
  const { default: OpenAI } = await import('openai');

  const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

  const models: Array<{ provider: 'groq' | 'openrouter'; model: string; client: any }> = [];

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
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response');

      console.log(`[EmailClassifier] Used ${provider}/${model}`);
      return JSON.parse(content);
    } catch (error: any) {
      errors.push(`${provider}/${model}: ${error.message}`);
    }
  }

  throw new Error(`All LLM providers failed: ${errors.join(', ')}`);
}

/**
 * Main classification function
 * Combines LLM classification with entity extraction
 */
export async function classifyEmailIntent(userIntent: string): Promise<EmailIntent> {
  try {
    // Call LLM for classification
    const llmResult = await callLLM(
      CLASSIFICATION_SYSTEM_PROMPT,
      `Classify this intent:\n\n"${userIntent}"`
    );

    // Extract entities using regex
    const extractedEntities = extractEntities(userIntent);

    // Merge LLM result with extracted entities
    const result: EmailIntent = {
      type: llmResult.type || 'notification',
      task: llmResult.task || extractedEntities.task,
      entity: llmResult.entity || extractedEntities.entity,
      recipient_name: llmResult.recipient_name || extractedEntities.recipient_name,
      action_required: llmResult.action_required ?? false,
      urgency: llmResult.urgency || 'medium',
      deadline: llmResult.deadline || extractedEntities.deadline,
      time_sensitive: llmResult.time_sensitive ?? false,
      original_message: userIntent,
      reasoning: llmResult.reasoning,
    };

    console.log('[EmailClassifier] Classification result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('[EmailClassifier] LLM failed, using fallback:', error);

    // Fallback to rule-based classification
    const fallback = getFallbackClassification(userIntent);
    const extractedEntities = extractEntities(userIntent);

    return {
      ...fallback,
      ...extractedEntities,
    };
  }
}

/**
 * Quick classification without LLM (for performance-sensitive paths)
 */
export function classifyEmailIntentFast(userIntent: string): EmailIntent {
  const fallback = getFallbackClassification(userIntent);
  const extractedEntities = extractEntities(userIntent);

  return {
    ...fallback,
    ...extractedEntities,
  };
}

/**
 * Map classification to action type for backward compatibility
 */
export function mapClassificationToActionType(
  classification: EmailClassificationType
): string {
  switch (classification) {
    case 'reminder':
      return 'EMAIL.TASK_REMINDER';
    case 'notification':
      return 'EMAIL.NOTIFICATION';
    case 'alert':
      return 'EMAIL.URGENT_ALERT';
    default:
      return 'EMAIL.NOTIFICATION';
  }
}
