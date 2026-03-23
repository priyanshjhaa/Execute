# Smart Email Classification System

## Overview

The Smart Email Classification System transforms user intent into clean, product-level emails through intelligent classification and structured templates.

## Architecture

```
User Intent → LLM Classification → Structured Intent → Smart Template → Polished Email
```

### Key Components

1. **Email Classifier** (`packages/llm/src/email-classifier.ts`)
   - Classifies emails into 3 types: Reminder, Notification, Alert
   - Extracts entities (task, entity, recipient, urgency, deadline)
   - Uses LLM with regex fallback for performance

2. **Smart Templates** (`packages/llm/src/smart-email-templates.ts`)
   - Clean, product-level HTML templates
   - Each type optimized for its purpose
   - Modern styling with details boxes

3. **Email Renderer** (`packages/execution/src/email/renderer.ts`)
   - Renders structured content to HTML/text
   - Supports urgency indicators
   - Clean, minimal design

## Email Types

### 1. REMINDER
**Purpose:** Tasks, deadlines, action items

**Keywords:** "remind", "don't forget", "deadline", "due", "submit", "complete", "task"

**Example:**
```
User intent: "Remind PJ to submit Manipal University Jaipur progress report"

Generated:
- Type: reminder
- Task: submit progress report
- Entity: Manipal University Jaipur
- Recipient: PJ
- Urgency: medium
- Action required: true
```

**Email Output:**
```
Subject: Reminder: submit progress report from Manipal University Jaipur

Hi PJ,

This is a reminder to submit progress report from Manipal University Jaipur.

[Details box]
Task: submit progress report
Organization: Manipal University Jaipur
Next Step: Complete and submit

[View Workflow button]

Powered by Execute — Turn instructions into actions
```

### 2. NOTIFICATION
**Purpose:** Informational updates, confirmations, status changes

**Keywords:** "update", "confirm", "receipt", "summary", "report", "FYI"

**Example:**
```
User intent: "Notify John that the meeting has been scheduled"

Generated:
- Type: notification
- Task: meeting has been scheduled
- Recipient: John
- Urgency: low
- Action required: false
```

**Email Output:**
```
Subject: Meeting has been scheduled ✓

Hi John,

Here's your meeting has been scheduled. We wanted to keep you informed.

[View Details button]

If you have any questions, feel free to reach out.

Powered by Execute — Turn instructions into actions
```

### 3. ALERT
**Purpose:** Urgent, time-sensitive issues requiring immediate attention

**Keywords:** "urgent", "alert", "critical", "immediate", "ASAP", "emergency", "warning"

**Example:**
```
User intent: "Alert team about critical server failure immediately"

Generated:
- Type: alert
- Task: server failure
- Recipient: team
- Urgency: urgent
- Action required: true
- Time sensitive: true
```

**Email Output:**
```
Subject: ⚠️ URGENT: server failure

Hi team,

This requires team's immediate attention: server failure.

[Details box]
Issue: server failure
Action Required: Yes
Timeframe: immediately

[Take Action button]

Please address this urgently to avoid any issues.

Powered by Execute — Turn instructions into actions
```

## Intent Extraction

The system extracts structured data from user intent:

```typescript
interface EmailIntent {
  type: 'reminder' | 'notification' | 'alert';
  task?: string;           // What needs to be done
  entity?: string;         // Organization, company, system
  recipient_name?: string; // Who should receive this
  action_required?: boolean;
  urgency?: 'low' | 'medium' | 'high' | 'urgent';
  deadline?: string;       // Specific deadline mentioned
  time_sensitive?: boolean;
  original_message: string;
  reasoning?: string;      // LLM's classification reasoning
}
```

## Usage

### Basic Usage

```typescript
import { classifyEmailIntent } from '@execute/llm/email-classifier';
import { generateSmartEmail } from '@execute/llm/smart-email-templates';
import { renderEmail } from '@execute/execution';

// Classify intent
const intent = await classifyEmailIntent(
  "Remind PJ to submit Manipal University Jaipur progress report"
);

// Generate email content
const emailContent = generateSmartEmail(intent);

// Render to HTML
const { html, text } = renderEmail(emailContent);
```

### In Workflow Generation

```typescript
import { generateStructuredEmailContent } from '@execute/llm/structured-email-generator';

const email = await generateStructuredEmailContent(
  "Remind PJ to submit Manipal University Jaipur progress report",
  { name: 'PJ', email: 'pj@example.com' }
);

// Returns:
// {
//   subject: "Reminder: submit progress report...",
//   html: "...",
//   text: "...",
//   actionType: "EMAIL.REMINDER",
//   variables: { task, entity, recipient_name, urgency }
// }
```

## Classification Logic

### Priority Rules

1. **Alerts** take priority - urgent keywords trigger immediately
2. **Reminders** detected by task/deadline language
3. **Notifications** as default for informational content

### Fallback System

If LLM classification fails:
1. Rule-based regex classification activates
2. Keyword matching for quick type detection
3. Entity extraction still works via patterns
4. Never fails to generate an email

## Template Customization

Each email type has a dedicated template function:

```typescript
// Reminder template
export function generateReminderEmail(intent: EmailIntent): SmartEmailContent

// Notification template
export function generateNotificationEmail(intent: EmailIntent): SmartEmailContent

// Alert template
export function generateAlertEmail(intent: EmailIntent): SmartEmailContent
```

Modify these to customize:
- Subject line format
- Heading styles
- Body text patterns
- CTA button text
- Reply hints

## Performance Optimization

### Fast Classification (No LLM)

```typescript
import { classifyEmailIntentFast } from '@execute/llm/email-classifier';

// Fast regex-based classification (no API calls)
const intent = classifyEmailIntentFast(userIntent);
```

Use this for:
- High-volume email generation
- Real-time responses
- Cost-sensitive applications

### LLM Classification

```typescript
import { classifyEmailIntent } from '@execute/llm/email-classifier';

// Full LLM-powered classification with reasoning
const intent = await classifyEmailIntent(userIntent);
```

Use this for:
- Complex user intents
- Accurate entity extraction
- Better context understanding

## Design Principles

### 1. User Intent Over Exact Wording
```typescript
// ❌ BAD: Sends what user types
"This is a reminder about the thing"

// ✅ GOOD: Interprets what user means
{
  type: "reminder",
  task: "complete task",
  urgency: "medium"
}
```

### 2. Structure Over Free Text
```typescript
// ✅ Structured details box
**Task:** Submit progress report
**Organization:** Manipal University Jaipur
**Next Step:** Email it to HR
```

### 3. Action-Oriented CTAs
```typescript
// Reminder: "View Workflow"
// Notification: "View Details"
// Alert: "Take Action"
```

## Examples

### Example 1: Task Reminder
**Input:** "Don't forget to submit the quarterly report by Friday"

**Classification:**
```json
{
  "type": "reminder",
  "task": "submit quarterly report",
  "deadline": "Friday",
  "urgency": "medium",
  "action_required": true
}
```

### Example 2: Status Update
**Input:** "Confirm that Sarah's account was created successfully"

**Classification:**
```json
{
  "type": "notification",
  "task": "account was created successfully",
  "recipient_name": "Sarah",
  "urgency": "low",
  "action_required": false
}
```

### Example 3: Urgent Alert
**Input:** "URGENT: Security breach detected - immediate action required"

**Classification:**
```json
{
  "type": "alert",
  "task": "security breach detected",
  "urgency": "urgent",
  "action_required": true,
  "time_sensitive": true
}
```

## Migration from Old System

### Before
```typescript
// Old: Generic templates
const actionType = await classifyAction(userIntent);
const template = getEmailTemplate(actionType);
const email = renderEmailTemplate(template, variables);
```

### After
```typescript
// New: Smart classification
const intent = await classifyEmailIntent(userIntent);
const email = generateSmartEmail(intent);
const { html, text } = renderEmail(email);
```

## Benefits

1. **Better User Experience:** Clean, professional emails
2. **Higher Engagement:** Clear CTAs and structure
3. **Consistent Branding:** Unified email design
4. **Intelligent Classification:** Understands user intent
5. **Product-Level Quality:** Modern, polished templates
6. **Flexible:** Easy to customize and extend

## Future Enhancements

- [ ] Multi-language support
- [ ] Custom template builder
- [ ] A/B testing for email templates
- [ ] Analytics on email engagement
- [ ] Custom branding per workflow
- [ ] Scheduled email delivery
- [ ] Email threading support
- [ ] Attachment handling
