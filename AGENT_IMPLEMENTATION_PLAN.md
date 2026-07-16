# Execute Agent Implementation Plan

Build the agent through small, independently testable phases. The agent coordinates work while the existing deterministic executor continues to perform and log workflow steps.

## Current Status

- Phases 1-3 are complete and were stabilized on July 16, 2026.
- Phase 4 is complete: provider tokens stream to the UI and active runs can be cancelled safely.
- Phase 5 is complete: each turn uses a bounded eight-message window plus rolling summary memory.
- Successful turns persist the user and assistant messages atomically.
- Provider failures do not create empty threads or unmatched user messages.
- Automated tests cover missing configuration, provider fallback, empty responses, output limits, and total provider failure.
- Phase 6, read-only workspace tools, is next.

## Phase 1: Conversation Storage - Complete and Stabilized

- Add agent thread and message tables.
- Scope all records to an authenticated user.
- Add migration and schema exports.

## Phase 2: Basic Agent Response - Complete and Stabilized

- Add a provider adapter using Groq with OpenRouter fallback.
- Add one authenticated message endpoint.
- Save plain user and assistant messages without tools.

## Phase 3: Dedicated Agent Page - Complete and Stabilized

- Add Agent to the dashboard sidebar.
- Add thread creation, selection, and conversation UI.
- Add responsive loading, empty, and error states.

## Phase 4: Streaming Responses - Complete

- Stream assistant text from the server.
- Persist completed responses.
- Support stopping an active response safely.

## Phase 5: Memory and Context Limits - Complete

- Keep the current message and seven latest stored messages in active context.
- Add incremental rolling summaries capped near 700 tokens.
- Include rolling memory before recent conversation messages.
- Enforce the 4,000-character request limit and bounded model output.

## Phase 6: Read-Only Workspace Tools

- Add tools to inspect workflows and executions.
- Add execution diagnosis.
- Bound model and tool calls per turn.

## Phase 7: Confirmation Infrastructure

- Persist proposed agent actions.
- Add approval, rejection, expiry, and idempotency handling.
- Add confirmation cards to the Agent UI.

## Phase 8: Workflow Creation and Editing

- Reuse the existing parser and validator.
- Create and update supported workflow definitions.
- Activate or archive workflows after confirmation.

## Phase 9: Workflow Execution

- Run workflows through the existing executor after confirmation.
- Cancel or retry executions.
- Report and link execution results.

## Phase 10: Forms

- Inspect, create, and edit forms.
- Activate or deactivate forms.
- Link forms to workflows.

## Phase 11: Contacts

- Search and inspect contacts.
- Create, edit, activate, or deactivate contacts.
- Prevent duplicate contact emails.

## Phase 12: Integrations

- Inspect integration status.
- Guide users through existing OAuth screens.
- Support confirmed disconnection without exposing secrets.

## Phase 13: Failure Monitor

- Scan newly failed executions through the scheduler.
- Deduplicate and classify findings.
- Propose repairs without executing them.
- Add a Needs Attention inbox and sidebar badge.

## Phase 14: Cost Controls

- Track token usage, provider, model, and latency.
- Cache compact workspace context.
- Truncate tool output and enforce daily limits.
- Escalate to a reasoning model only when necessary.

## Phase 15: Security and Release

- Test tenant isolation, prompt injection, approvals, and provider outages.
- Add agent and monitor feature flags.
- Release internally before general availability.

## Core Rules

- The agent plans and coordinates; the existing executor performs workflow steps.
- All mutating or externally visible actions require confirmation.
- Quick Commands remains a separate lightweight feature.
- Failure monitoring is advisory and never retries automatically.
- Unsupported premium actions remain unavailable.
