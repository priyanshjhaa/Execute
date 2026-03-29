/**
 * Email Template Type Definitions
 *
 * Types for dynamic email generation with user preferences
 */

/**
 * Email tone options
 */
export type EmailTone = 'formal' | 'casual' | 'friendly' | 'urgent';

/**
 * Email structure options
 */
export type EmailStructure = 'detailed' | 'brief' | 'minimal';

/**
 * Email writing style options
 */
export type EmailStyle = 'professional' | 'conversational' | 'direct';

/**
 * User email preferences
 */
export interface EmailPreferences {
  // Tone selection
  tone?: EmailTone;

  // Structure preference
  structure?: EmailStructure;

  // Writing style
  style?: EmailStyle;

  // Custom instructions
  customInstructions?: string;

  // Override flags - allow users to override specific parts
  overrides?: {
    subject?: string;
    heading?: string;
    body?: string;
    includeBranding?: boolean;
    includeSignature?: boolean;
    includeCTA?: boolean;
  };
}

/**
 * Extracted entity information
 */
export interface EmailEntities {
  task?: string;
  entity?: string; // organization, company, system
  recipient_name?: string;
  urgency?: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: string;
}

/**
 * Recipient information
 */
export interface RecipientInfo {
  name?: string;
  email?: string;
  company?: string;
}

/**
 * Existing send_email step configuration that can inform template generation.
 */
export interface EmailStepConfigInput {
  to?: string | string[];
  subject?: string;
  heading?: string;
  body?: string;
  intro?: string;
  details?: string;
  ctaText?: string;
  ctaLink?: string;
  signatureName?: string;
  replyHint?: string;
}

/**
 * Email generation context
 */
export interface EmailGenerationContext {
  // Original workflow context
  userIntent: string;
  triggerType?: string;

  // User preferences (if provided)
  preferences?: EmailPreferences;

  // Extracted entities from classification
  entities?: EmailEntities;

  // Existing email step config from workflow generation
  stepConfig?: EmailStepConfigInput;

  // Recipient info
  recipientInfo?: RecipientInfo;
}

/**
 * Enhanced email content with metadata
 */
export interface DynamicEmailContent {
  subject: string;
  heading: string;
  intro?: string;
  body: string;
  details?: string;
  ctaText?: string;
  ctaLink?: string;
  signatureName?: string;
  replyHint?: string;

  // Presentation flags
  showBranding: boolean;
  showFooter: boolean;
  showReplyHint: boolean;

  // Metadata about generation
  metadata?: {
    templateUsed: string;
    tone?: EmailTone;
    structure?: EmailStructure;
    style?: EmailStyle;
    generatedAt: string;
  };
}
