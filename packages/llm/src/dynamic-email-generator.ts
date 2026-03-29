/**
 * Dynamic Email Generator
 *
 * Produces a single universal business email template for custom workflow emails.
 * The content is derived from the overall workflow intent plus the generated
 * send_email step config so the delivered email stays close to the original ask.
 */

import type { EmailIntent } from './email-classifier.js';
import { classifyEmailIntent } from './email-classifier.js';
import type {
  EmailPreferences,
  EmailGenerationContext,
  DynamicEmailContent,
  EmailEntities,
  EmailStepConfigInput,
} from './email-types.js';

const GENERIC_SUBJECTS = new Set([
  'update',
  'notification',
  'reminder',
  'task reminder',
  'important notice',
  'email update',
  'update from execute',
]);

const GENERIC_BODY_PATTERNS = [
  /^please review the information (above|below)\.?$/i,
  /^please review the update (above|below)\.?$/i,
  /^this is a reminder to/i,
  /^here'?s an update about/i,
  /^this requires immediate attention:/i,
];

const GENERIC_CTA_TEXT = new Set(['open execute', 'view workflow', 'view details', 'take action']);

export async function generateDynamicEmail(
  context: EmailGenerationContext
): Promise<DynamicEmailContent> {
  console.log('[DynamicEmail] Generating with context:', JSON.stringify(context, null, 2));

  let classifiedIntent: EmailIntent | undefined;
  try {
    classifiedIntent = await classifyEmailIntent(context.userIntent);
  } catch (error) {
    console.error('[DynamicEmail] Intent classification failed, continuing with workflow-only context:', error);
  }

  const mergedEntities = mergeEntities(context, classifiedIntent);
  const recipientName = deriveRecipientName(context.stepConfig, mergedEntities, context.recipientInfo);
  const topic = deriveTopic(context.userIntent, context.stepConfig, mergedEntities);
  const purpose = derivePurpose(context.userIntent, context.stepConfig, topic, classifiedIntent);
  const subject = deriveSubject(topic, context.stepConfig, context.preferences);
  const heading = deriveHeading(topic, subject);
  const intro = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const body = deriveBody(context, topic, purpose, classifiedIntent);
  const details = deriveDetails(context.stepConfig, context.preferences);
  const actionLink = deriveActionLink(context.stepConfig);
  const cta = deriveCta(context.stepConfig, actionLink);
  const signatureName = context.stepConfig?.signatureName;

  return {
    subject,
    heading,
    intro,
    body,
    details,
    ctaText: cta?.text,
    ctaLink: cta?.link,
    signatureName,
    replyHint: undefined,
    showBranding: false,
    showFooter: false,
    showReplyHint: false,
    metadata: {
      templateUsed: 'custom_business',
      tone: context.preferences?.tone,
      structure: context.preferences?.structure,
      style: context.preferences?.style,
      generatedAt: new Date().toISOString(),
    },
  };
}

function mergeEntities(
  context: EmailGenerationContext,
  intent?: EmailIntent
): EmailEntities {
  return {
    task: context.entities?.task || intent?.task,
    entity: context.entities?.entity || intent?.entity,
    recipient_name:
      context.entities?.recipient_name ||
      firstString(context.stepConfig?.to) ||
      intent?.recipient_name ||
      context.recipientInfo?.name,
    urgency: context.entities?.urgency || intent?.urgency,
    deadline: context.entities?.deadline || intent?.deadline,
  };
}

function deriveRecipientName(
  stepConfig: EmailStepConfigInput | undefined,
  entities: EmailEntities,
  recipientInfo?: EmailGenerationContext['recipientInfo']
): string | undefined {
  const raw = firstString(stepConfig?.to) || entities.recipient_name || recipientInfo?.name;
  if (!raw) return undefined;
  if (looksLikeEmail(raw)) {
    return raw.split('@')[0];
  }
  return sanitizeRecipient(raw);
}

function deriveTopic(
  userIntent: string,
  stepConfig: EmailStepConfigInput | undefined,
  entities: EmailEntities
): string {
  const explicitSubject = cleanText(stepConfig?.subject);
  if (isMeaningfulSubject(explicitSubject)) {
    return explicitSubject!;
  }

  const explicitHeading = cleanText(stepConfig?.heading);
  if (isMeaningfulSubject(explicitHeading)) {
    return explicitHeading!;
  }

  const fromIntent =
    extractAfterKeyword(userIntent, 'about') ||
    extractAfterKeyword(userIntent, 'regarding') ||
    extractAfterKeyword(userIntent, 'on') ||
    entities.task ||
    cleanText(stepConfig?.body);

  return sentenceCase(stripActionPreamble(fromIntent || userIntent));
}

function derivePurpose(
  userIntent: string,
  stepConfig: EmailStepConfigInput | undefined,
  topic: string,
  intent?: EmailIntent
): string {
  const explicitBody = cleanText(stepConfig?.body);
  if (isMeaningfulBody(explicitBody)) {
    return normalizeParagraph(explicitBody!);
  }

  const normalizedIntent = userIntent.toLowerCase();
  const topicPhrase = stripTerminalPunctuation(topic);

  if (normalizedIntent.includes('discuss')) {
    return `I wanted to reach out about ${topicPhrase}. Let's connect to discuss it and align on the next steps.`;
  }
  if (normalizedIntent.includes('follow up')) {
    return `I wanted to follow up regarding ${topicPhrase}. Please let me know how you'd like to proceed.`;
  }
  if (normalizedIntent.includes('remind')) {
    return `This is a reminder about ${topicPhrase}. Please keep it on your radar and take any needed action.`;
  }
  if (normalizedIntent.includes('confirm')) {
    return `I'm reaching out to confirm ${topicPhrase}. Please let me know if everything looks right.`;
  }
  if (normalizedIntent.includes('inform') || normalizedIntent.includes('notify') || intent?.type === 'notification') {
    return `I wanted to share an update regarding ${topicPhrase}. Please take a look when you have a moment.`;
  }
  if (normalizedIntent.includes('request') || normalizedIntent.includes('ask')) {
    return `I'm reaching out regarding ${topicPhrase}. Please let me know if you can help with this.`;
  }

  return `I'm reaching out regarding ${topicPhrase}. Please let me know if you'd like to discuss it further.`;
}

function deriveSubject(
  topic: string,
  stepConfig: EmailStepConfigInput | undefined,
  preferences?: EmailPreferences
): string {
  const explicitSubject = cleanText(stepConfig?.subject);
  if (isMeaningfulSubject(explicitSubject)) {
    return explicitSubject!;
  }

  const conciseTopic = stripTerminalPunctuation(topic);
  if (preferences?.structure === 'minimal') {
    return conciseTopic;
  }

  return sentenceCase(conciseTopic);
}

function deriveHeading(topic: string, subject: string): string {
  const base = isMeaningfulSubject(cleanText(topic)) ? topic : subject;
  return titleCase(stripTerminalPunctuation(base));
}

function deriveBody(
  context: EmailGenerationContext,
  topic: string,
  purpose: string,
  intent?: EmailIntent
): string {
  const paragraphs: string[] = [];
  const normalizedPurpose = normalizeParagraph(purpose);

  paragraphs.push(normalizedPurpose);

  const followUp = buildFollowUpParagraph(
    context.userIntent,
    topic,
    context.stepConfig,
    normalizedPurpose,
    intent
  );
  if (followUp) {
    paragraphs.push(followUp);
  }

  return dedupeParagraphs(paragraphs).join('\n\n');
}

function buildFollowUpParagraph(
  userIntent: string,
  topic: string,
  stepConfig: EmailStepConfigInput | undefined,
  purpose: string,
  intent?: EmailIntent
): string | undefined {
  const explicitBody = cleanText(stepConfig?.body);

  if (isMeaningfulBody(explicitBody) && explicitBody) {
    const normalizedBody = normalizeParagraph(explicitBody);
    if (canonicalizeText(normalizedBody) !== canonicalizeText(purpose)) {
      return normalizedBody;
    }
  }

  return undefined;
}

function deriveDetails(
  stepConfig: EmailStepConfigInput | undefined,
  preferences?: EmailPreferences
): string | undefined {
  const details = cleanText(stepConfig?.details);
  if (details) {
    return details;
  }

  if (preferences?.structure === 'detailed') {
    const body = cleanText(stepConfig?.body);
    if (body && isStructuredDetails(body)) {
      return body;
    }
  }

  return undefined;
}

function deriveActionLink(stepConfig: EmailStepConfigInput | undefined): string | undefined {
  const explicitLink = cleanText(stepConfig?.ctaLink);
  if (explicitLink) {
    return explicitLink;
  }

  const body = cleanText(stepConfig?.body);
  const urlMatch = body?.match(/https?:\/\/\S+/i);
  return urlMatch?.[0];
}

function deriveCta(
  stepConfig: EmailStepConfigInput | undefined,
  actionLink?: string
): { text: string; link: string } | undefined {
  if (!actionLink) {
    return undefined;
  }

  const explicitText = cleanText(stepConfig?.ctaText);
  if (explicitText && !GENERIC_CTA_TEXT.has(explicitText.toLowerCase())) {
    return { text: explicitText, link: actionLink };
  }

  return { text: 'Open Link', link: actionLink };
}

function cleanText(value?: string): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : undefined;
}

function firstString(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    return value.find(item => typeof item === 'string' && item.trim().length > 0);
  }
  return value;
}

function sanitizeRecipient(value: string): string {
  return value
    .replace(/^to\s+/i, '')
    .replace(/[<>"']/g, '')
    .trim();
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isMeaningfulSubject(value?: string): boolean {
  if (!value) return false;
  if (value.includes('{{')) return false;
  return !GENERIC_SUBJECTS.has(value.trim().toLowerCase());
}

function isMeaningfulBody(value?: string): boolean {
  if (!value) return false;
  if (value.includes('{{')) return false;
  return !GENERIC_BODY_PATTERNS.some(pattern => pattern.test(value.trim()));
}

function isStructuredDetails(value: string): boolean {
  return value.split('\n').some(line => /:/.test(line));
}

function extractAfterKeyword(text: string, keyword: string): string | undefined {
  const regex = new RegExp(`${keyword}\\s+(.+)$`, 'i');
  const match = text.match(regex);
  return match?.[1]?.trim();
}

function stripActionPreamble(text: string): string {
  return text
    .replace(/^send an email to\s+.+?\s+(about|regarding|on)\s+/i, '')
    .replace(/^email\s+.+?\s+(about|regarding|on)\s+/i, '')
    .replace(/^send\s+.+?\s+(about|regarding|on)\s+/i, '')
    .trim();
}

function sentenceCase(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .map(word => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function normalizeParagraph(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.endsWith('.') || normalized.endsWith('!') || normalized.endsWith('?')
    ? normalized
    : `${normalized}.`;
}

function stripTerminalPunctuation(text: string): string {
  return text.replace(/[.!?]+$/, '').trim();
}

function dedupeParagraphs(paragraphs: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const paragraph of paragraphs) {
    const canonical = canonicalizeText(paragraph);
    if (!canonical || seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    unique.push(paragraph);
  }

  return unique;
}

function canonicalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
