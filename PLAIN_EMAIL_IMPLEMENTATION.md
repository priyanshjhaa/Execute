# Plain/Manual Email Implementation

## Summary

Successfully implemented a plain/manual email path for Execute that preserves user wording closely without branded elements. This allows conversational person-to-person messages to be sent without the "Powered by Execute" footer, CTA buttons, or generic reply hints.

## Changes Made

### 1. Renderer Updates (`packages/execution/src/email/renderer.ts`)

Added presentation flags to the `EmailContent` interface:
- `showBranding?: boolean` - Controls "Powered by Execute" footer text
- `showFooter?: boolean` - Controls entire footer visibility
- `showReplyHint?: boolean` - Controls reply hint text visibility

All flags default to `true` for backward compatibility with existing emails.

### 2. Email Presets (`packages/llm/src/email-presets.ts`)

Added new email template type:
- `plain_manual` - For lightweight person-to-person messages without branded elements

Added `generatePlainManualEmail()` function that:
- Preserves user's original wording in the body
- Sets `showBranding: false`
- Sets `showFooter: false`
- Sets `showReplyHint: false`
- No CTA buttons by default
- No generic reply hints
- No company-style signoff unless explicitly provided

Updated `inferTemplateType()` to detect conversational patterns:
- Matches phrases like "send an email to X about discussing/asking/checking/following up"
- Conversational intent takes priority over meeting keywords
- Excludes notifications with keywords like "expense", "report", "summary", "alert"
- Preserves existing behavior for registration and weekly_meeting presets

### 3. Structured Email Generator (`packages/llm/src/structured-email-generator.ts`)

Updated `enhanceEmailStepStructured()` to:
- Include presentation flags in return type
- Preserve all content more faithfully (better paragraph extraction)
- Set appropriate presentation flags based on template type

### 4. Structured Prompts (`packages/llm/src/action-templates/structured-prompts.ts`)

Tightened classification rules:
- Conversational phrases like "discussing", "asking", "checking", "following up" map to GENERIC_NOTIFICATION
- Added rules to prevent forcing conversational messages into formal templates
- LLM instructed to preserve user's exact wording in variables
- DO NOT insert generic words like "expenses" or "update" unless user explicitly says them

## Examples

### Plain Manual Email (New Behavior)

**Input:** "Send an email to PJ about discussing monthly claude code subscriptions"

**Result:**
- Template: `plain_manual`
- Subject: "Email from Execute"
- Heading: "Hello"
- Intro: "Hi PJ,"
- Body: [Preserves user's exact wording]
- No branding footer
- No CTA button
- No reply hints
- Clean, personal email

### Registration Email (Unchanged)

**Input:** "Send a welcome email to new user after registration"

**Result:**
- Template: `registration`
- Full branding with "Powered by Execute"
- CTA button: "View Submission"
- Reply hint: "If you have any questions..."
- Preserves existing behavior

### Weekly Meeting Email (Unchanged)

**Input:** "Send an email for the weekly team meeting"

**Result:**
- Template: `weekly_meeting`
- Full branding
- Calendar CTA
- Structured meeting details
- Preserves existing behavior

## Test Results

All tests passing:
- ✓ Conversational - discussing subscriptions → `plain_manual`
- ✓ Conversational - asking about meeting → `plain_manual`
- ✓ Conversational - following up → `plain_manual`
- ✓ Formal - registration → `registration`
- ✓ Formal - meeting → `weekly_meeting`

## Backward Compatibility

All changes are backward compatible:
- Presentation flags are optional with safe defaults (`true`)
- Existing preset flows (registration, weekly_meeting) unchanged
- New `plain_manual` type only applies to conversational intents
- No breaking changes to public APIs

## Files Modified

1. `packages/execution/src/email/renderer.ts`
2. `packages/llm/src/email-presets.ts`
3. `packages/llm/src/structured-email-generator.ts`
4. `packages/llm/src/action-templates/structured-prompts.ts`

## Build Status

✓ All TypeScript compilation successful
✓ All packages build without errors
✓ All tests passing
