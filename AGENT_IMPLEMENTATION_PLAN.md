# Execute Agent Implementation Plan

Build the agent through small, independently testable phases. The agent coordinates work while the existing deterministic executor continues to perform and log workflow steps.

## Current Status

- Phases 1-3 are complete and were stabilized on July 16, 2026.
- Phase 4 is complete: provider tokens stream to the UI and active runs can be cancelled safely.
- Phase 5 is complete: each turn uses a bounded eight-message window, rolling summary memory, and an explicit total context budget.
- Phase 6 is complete: the agent can inspect tenant-scoped workflows, executions, and logs, diagnose failed executions, and use bounded tool-call rounds while preserving streaming.
- Successful turns persist the user and assistant messages atomically.
- Provider failures do not create empty threads or unmatched user messages.
- Automated tests cover missing configuration, provider fallback, empty responses, output limits, and total provider failure.
- Phase 7 is complete: proposed actions are tenant-scoped, expire safely, handle repeated decisions idempotently, and render as confirmation cards in Agent conversations.
- Phase 8 is in progress: the agent can generate, validate, and display workflow creation and update proposals without applying them.
- Phase 9 is complete: confirmed execution proposals run through the existing executor, support cancellation and retry, and return linked execution receipts.
- Phase 10 is complete: the agent can inspect forms and apply confirmed form creation, editing, status, and workflow-link changes.
- Phase 11 is complete: the agent can search contacts and apply confirmed contact creation, editing, and status changes with case-insensitive email uniqueness.
- Phase 12 is complete: integration status and OAuth guidance are tenant-scoped, public responses exclude secrets, and disconnection requires explicit approval.

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
- Enforce a configurable total context budget with conservative token estimates.
- Truncate oversized legacy content safely while preserving recent information.
- Process long summary backlogs in bounded chronological batches.

## Phase 6: Read-Only Workspace Tools - Complete

- Add tools to inspect workflows and executions.
- Add execution diagnosis.
- Bound model and tool calls per turn.

## Phase 7: Confirmation Infrastructure - Complete

- Persist proposed agent actions. - Complete
- Add approval and rejection handling. - Complete
- Add expiry and idempotency handling. - Complete
- Add confirmation cards to the Agent UI. - Complete

## Phase 8: Workflow Creation and Editing - In Progress

- Reuse the existing parser and validator. - Complete
- Propose new supported workflow definitions. - Complete
- Propose changes to existing tenant-owned workflows. - Complete
- Display workflow proposals and changes in confirmation cards. - Complete
- Create and update workflow definitions after confirmation.
- Activate or archive workflows after confirmation.

## Phase 9: Workflow Execution - Complete

- Run workflows through the existing executor after confirmation. - Complete
- Cancel or retry executions. - Complete
- Report and link execution results. - Complete

## Phase 10: Forms - Complete

- Inspect, create, and edit forms. - Complete
- Activate or deactivate forms. - Complete
- Link forms to workflows. - Complete

## Phase 11: Contacts - Complete

- Search and inspect contacts. - Complete
- Create, edit, activate, or deactivate contacts. - Complete
- Prevent duplicate contact emails. - Complete

## Phase 12: Integrations - Complete

- Inspect integration status. - Complete
- Guide users through existing OAuth screens. - Complete
- Support confirmed disconnection without exposing secrets. - Complete

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
