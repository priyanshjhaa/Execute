/**
 * Smart Email Templates
 *
 * Clean, product-level templates for:
 * - REMINDER: Task reminders, deadlines, action items
 * - NOTIFICATION: Informational updates, confirmations
 * - ALERT: Urgent, time-sensitive notifications
 */

import type { EmailIntent } from './email-classifier.js';

export interface SmartEmailContent {
  subject: string;
  heading: string;
  intro?: string;
  body: string;
  details?: string;
  ctaText?: string;
  ctaLink?: string;
  signatureName?: string;
  replyHint?: string;
  showBranding: boolean;
  showFooter: boolean;
  showReplyHint: boolean;
  urgency?: 'low' | 'medium' | 'high' | 'urgent';
}

/**
 * REMINDER Email Template
 *
 * For tasks, deadlines, and action items
 */
export function generateReminderEmail(intent: EmailIntent): SmartEmailContent {
  const {
    task = 'complete your task',
    entity = '',
    recipient_name = 'there',
    deadline = 'soon',
  } = intent;

  const entityText = entity ? ` from ${entity}` : '';

  return {
    subject: `Reminder: ${task}${entityText}`,
    heading: 'Progress Report Reminder 📄',
    intro: `Hi ${recipient_name},`,
    body: `This is a reminder to ${task}${entityText}.`,
    details: `**Task:** ${task}
${entity ? `**Organization:** ${entity}` : ''}
**Next Step:** Complete and submit${deadline ? ` by ${deadline}` : ''}`,
    ctaText: 'View Workflow',
    ctaLink: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/dashboard',
    replyHint: 'Please make sure to complete this as soon as possible.',
    signatureName: 'Execute',
    showBranding: true,
    showFooter: true,
    showReplyHint: true,
    urgency: intent.urgency || 'medium',
  };
}

/**
 * NOTIFICATION Email Template
 *
 * For informational updates and confirmations
 */
export function generateNotificationEmail(intent: EmailIntent): SmartEmailContent {
  const {
    task = 'update',
    entity = '',
    recipient_name = 'there',
  } = intent;

  const entityText = entity ? ` from ${entity}` : '';

  return {
    subject: `${task.charAt(0).toUpperCase() + task.slice(1)}${entityText}`,
    heading: `${task.charAt(0).toUpperCase() + task.slice(1)} ✓`,
    intro: `Hi ${recipient_name},`,
    body: `Here's your ${task}${entityText}. We wanted to keep you informed.`,
    details: task,
    ctaText: 'View Details',
    ctaLink: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/dashboard',
    replyHint: 'If you have any questions, feel free to reach out.',
    signatureName: 'Execute',
    showBranding: true,
    showFooter: true,
    showReplyHint: true,
    urgency: 'low',
  };
}

/**
 * ALERT Email Template
 *
 * For urgent, time-sensitive issues
 */
export function generateAlertEmail(intent: EmailIntent): SmartEmailContent {
  const {
    task = 'attention required',
    entity = '',
    recipient_name = 'there',
    deadline = 'immediately',
  } = intent;

  const entityText = entity ? ` from ${entity}` : '';

  return {
    subject: `⚠️ URGENT: ${task}${entityText}`,
    heading: '⚠️ Urgent Alert',
    intro: `Hi ${recipient_name},`,
    body: `This requires ${recipient_name === 'there' ? 'your' : `${recipient_name}'s`} immediate attention: ${task}${entityText}.`,
    details: `**Issue:** ${task}
${entity ? `**Source:** ${entity}` : ''}
**Action Required:** Yes
**Timeframe:** ${deadline}`,
    ctaText: 'Take Action',
    ctaLink: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/dashboard',
    replyHint: 'Please address this urgently to avoid any issues.',
    signatureName: 'Execute',
    showBranding: true,
    showFooter: true,
    showReplyHint: true,
    urgency: 'urgent',
  };
}

/**
 * Main generator - routes to appropriate template
 */
export function generateSmartEmail(intent: EmailIntent): SmartEmailContent {
  switch (intent.type) {
    case 'reminder':
      return generateReminderEmail(intent);
    case 'notification':
      return generateNotificationEmail(intent);
    case 'alert':
      return generateAlertEmail(intent);
    default:
      return generateNotificationEmail(intent);
  }
}

/**
 * Enhanced generator with variable extraction from workflow data
 */
export function generateSmartEmailFromWorkflow(
  userIntent: string,
  variables: Record<string, string> = {}
): SmartEmailContent {
  // Use fast classification for performance
  const { classifyEmailIntentFast } = require('./email-classifier.js');
  const intent = classifyEmailIntentFast(userIntent);

  // Override with provided variables
  if (variables.task) intent.task = variables.task;
  if (variables.entity) intent.entity = variables.entity;
  if (variables.recipient_name) intent.recipient_name = variables.recipient_name;
  if (variables.deadline) intent.deadline = variables.deadline;

  return generateSmartEmail(intent);
}
