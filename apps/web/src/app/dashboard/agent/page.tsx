"use client";

import { FormEvent, Fragment, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Bot, Building2, Check, ChevronRight, Clock3, Command, CornerDownLeft, FileText, GitCompareArrows, History, Link2, Loader2, Mail, MessageSquare, Plus, Search, Send, ShieldCheck, Sparkles, Square, Unplug, UserRound, Workflow as WorkflowIcon, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AgentThread {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentContentBlock {
  type: "text";
  text: string;
}

interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: AgentContentBlock[];
  createdAt: string;
}

type AgentActionStatus = "pending" | "approved" | "rejected" | "expired" | "executing" | "completed" | "failed";

interface AgentProposedAction {
  id: string;
  threadId: string;
  assistantMessageId: string | null;
  actionType: string;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  status: AgentActionStatus;
  expiresAt: string;
  decidedAt: string | null;
  executionStartedAt?: string | null;
  executionCompletedAt?: string | null;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AgentConversation {
  messages: AgentMessage[];
  actions: AgentProposedAction[];
}

interface AgentActionDecisionResponse {
  action: AgentProposedAction;
  idempotent: boolean;
  executionHandled?: boolean;
}

interface SendMessageResponse {
  thread: {
    id: string;
    title: string;
    created: boolean;
  };
  messages: {
    user: AgentMessage;
    assistant: AgentMessage;
  };
  actions: AgentProposedAction[];
}

type AgentStreamEvent =
  | { type: "start"; runId: string }
  | { type: "delta"; delta: string }
  | ({ type: "done" } & SendMessageResponse)
  | { type: "cancelled" }
  | { type: "error"; error: string };

const agentQueryKeys = {
  threads: ["agent", "threads"] as const,
  messages: (threadId: string) => ["agent", "threads", threadId, "messages"] as const,
};

function formatThreadTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMessageTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

const suggestedPrompts = [
  "Create a weekly reminder workflow for my Monday meeting",
  "Log ₹5,000 as a marketing expense",
  "Show me failed executions that need attention",
];

function getMessageText(message: AgentMessage): string {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function formatActionValue(value: unknown): string {
  const formatted = typeof value === "string" ? value : JSON.stringify(value);
  if (!formatted) return "—";
  return formatted.length > 180 ? `${formatted.slice(0, 177)}...` : formatted;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function workflowProposalPreview(action: AgentProposedAction) {
  if (action.actionType !== "workflow.create" && action.actionType !== "workflow.update") {
    return null;
  }
  const after = asRecord(action.payload.after);
  const before = asRecord(action.payload.before);
  const definition = asRecord(after?.definition);
  if (!after || !definition || !Array.isArray(definition.steps)) return null;

  const steps = definition.steps.flatMap((value) => {
    const step = asRecord(value);
    if (!step) return [];
    const config = asRecord(step.config);
    const recipient = step.type === "send_email"
      ? (typeof config?.to === "string" ? config.to : Array.isArray(config?.to) ? config.to.join(", ") : null)
      : null;
    const destination = step.type === "send_slack" && typeof config?.channel === "string"
      ? config.channel
      : recipient;
    return [{
      id: typeof step.id === "string"
        ? step.id
        : `${typeof step.position === "number" ? step.position : 0}-${typeof step.name === "string" ? step.name : "step"}`,
      name: typeof step.name === "string" ? step.name : "Unnamed step",
      type: typeof step.type === "string" ? step.type : "unknown",
      position: typeof step.position === "number" ? step.position : 0,
      destination,
    }];
  }).sort((left, right) => left.position - right.position);
  const changedFields = Array.isArray(action.payload.changedFields)
    ? action.payload.changedFields.filter((field): field is string => typeof field === "string")
    : [];
  const validation = asRecord(action.payload.validation);
  const warnings = Array.isArray(validation?.warnings)
    ? validation.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
  const triggerConfig = asRecord(after.triggerConfig);
  const integrations = [...new Set(steps.flatMap((step) => {
    if (step.type === "send_email") return ["Email"];
    if (step.type === "send_slack") return ["Slack"];
    return [];
  }))];
  const result = asRecord(action.result);

  return {
    operation: action.actionType === "workflow.create" ? "create" : "update",
    name: typeof after.name === "string" ? after.name : action.title,
    previousName: typeof before?.name === "string" ? before.name : null,
    triggerType: typeof after.triggerType === "string" ? after.triggerType : "unknown",
    status: typeof after.status === "string" ? after.status : "draft",
    scheduleExpression: typeof after.scheduleExpression === "string" ? after.scheduleExpression : null,
    timezone: typeof triggerConfig?.timezone === "string" ? triggerConfig.timezone : null,
    integrations,
    resultHref: typeof result?.href === "string" ? result.href : null,
    steps,
    changedFields,
    warnings,
  };
}

function WorkflowProposalPreview({ action }: { action: AgentProposedAction }) {
  const preview = workflowProposalPreview(action);
  if (!preview) return null;
  const visibleSteps = preview.steps.slice(0, 8);

  return (
    <div className="mt-4 border-y border-white/[0.07] py-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-white/70">
          {preview.operation === "update"
            ? <GitCompareArrows className="h-3.5 w-3.5 text-amber-100/70" />
            : <WorkflowIcon className="h-3.5 w-3.5 text-amber-100/70" />}
          {preview.name}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
          {preview.triggerType.replaceAll("_", " ")} trigger
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
          {preview.status}
        </span>
      </div>

      {preview.previousName && preview.previousName !== preview.name && (
        <p className="mt-2 text-xs text-white/40">
          Rename <span className="text-white/60">{preview.previousName}</span> to <span className="text-white/75">{preview.name}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-y-2">
        {visibleSteps.map((step, index) => (
          <Fragment key={step.id}>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/[0.07] bg-black/30 px-2.5 py-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[9px] text-white/55">
                {index + 1}
              </span>
              <span className="max-w-40 truncate text-[11px] font-medium text-white/65">
                {step.name}{step.destination ? ` → ${step.destination}` : ""}
              </span>
            </div>
            {index < visibleSteps.length - 1 && (
              <ChevronRight className="mx-1 h-3 w-3 shrink-0 text-white/20" />
            )}
          </Fragment>
        ))}
        {preview.steps.length > visibleSteps.length && (
          <span className="ml-2 text-[11px] text-white/35">+{preview.steps.length - visibleSteps.length} more</span>
        )}
      </div>

      {(preview.scheduleExpression || preview.timezone || preview.integrations.length > 0) && (
        <dl className="mt-3 grid gap-2 text-xs text-white/50 sm:grid-cols-2">
          {preview.scheduleExpression && <div><dt className="text-white/30">Schedule</dt><dd>{preview.scheduleExpression}</dd></div>}
          {preview.timezone && <div><dt className="text-white/30">Timezone</dt><dd>{preview.timezone}</dd></div>}
          {preview.integrations.length > 0 && <div><dt className="text-white/30">Integrations</dt><dd>{preview.integrations.join(", ")}</dd></div>}
        </dl>
      )}

      {preview.operation === "create" && preview.status === "active" && (
        <p className="mt-3 rounded-lg border border-amber-200/15 bg-amber-100/[0.05] px-3 py-2 text-xs leading-5 text-amber-50/70">
          Approval creates this workflow as active and authorizes its future scheduled runs.
        </p>
      )}

      {preview.changedFields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {preview.changedFields.map((field) => (
            <span key={field} className="rounded-full border border-sky-200/10 bg-sky-200/[0.04] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-sky-100/55">
              {field.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      )}

      {preview.warnings.length > 0 && (
        <p className="mt-3 text-[11px] leading-4 text-amber-100/55">
          {preview.warnings.length} validation warning{preview.warnings.length === 1 ? "" : "s"}: {preview.warnings[0]}
        </p>
      )}

      {(action.status === "completed" || action.status === "failed") && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5 text-xs">
          <span className={action.status === "failed" ? "text-rose-200/70" : "text-emerald-100/70"}>
            {action.status === "failed" ? action.errorMessage || "Workflow action failed" : "Workflow saved and ready"}
          </span>
          {action.status === "completed" && preview.resultHref && (
            <Link href={preview.resultHref} className="font-medium text-amber-50/65 hover:text-amber-50">View workflow</Link>
          )}
        </div>
      )}
    </div>
  );
}

function QuickActionPreview({ action }: { action: AgentProposedAction }) {
  if (action.actionType !== 'event.log' && action.actionType !== 'email.send') return null;
  const isEmail = action.actionType === 'email.send';
  const recipient = typeof action.payload.recipient === 'string' ? action.payload.recipient : null;
  const subject = typeof action.payload.subject === 'string' ? action.payload.subject : null;
  const body = typeof action.payload.body === 'string' ? action.payload.body : null;
  const eventType = typeof action.payload.eventType === 'string' ? action.payload.eventType : null;
  const title = typeof action.payload.title === 'string' ? action.payload.title : null;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.07] bg-black/25">
      <dl className="divide-y divide-white/[0.06] px-3.5 text-xs">
        {isEmail ? (
          <>
            <div className="grid grid-cols-[5rem_1fr] gap-3 py-2.5"><dt className="text-white/30">Recipient</dt><dd className="break-all text-white/70">{recipient}</dd></div>
            <div className="grid grid-cols-[5rem_1fr] gap-3 py-2.5"><dt className="text-white/30">Subject</dt><dd className="text-white/70">{subject}</dd></div>
            <div className="grid grid-cols-[5rem_1fr] gap-3 py-2.5"><dt className="text-white/30">Body</dt><dd className="max-h-60 overflow-y-auto whitespace-pre-wrap text-white/60">{body}</dd></div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-[5rem_1fr] gap-3 py-2.5"><dt className="text-white/30">Type</dt><dd className="text-white/70">{eventType}</dd></div>
            <div className="grid grid-cols-[5rem_1fr] gap-3 py-2.5"><dt className="text-white/30">Title</dt><dd className="text-white/70">{title}</dd></div>
            <div className="grid grid-cols-[5rem_1fr] gap-3 py-2.5"><dt className="text-white/30">Data</dt><dd className="break-words text-white/60">{formatActionValue(action.payload.data)}</dd></div>
          </>
        )}
      </dl>
      {(action.status === 'completed' || action.status === 'failed') && (
        <p className={cn("border-t border-white/[0.07] px-3.5 py-2.5 text-[11px]", action.status === 'failed' ? 'text-rose-200/65' : 'text-emerald-100/65')}>
          {action.status === 'failed' ? action.errorMessage || 'The approved action failed.' : isEmail ? 'Email sent.' : 'Event logged.'}
        </p>
      )}
    </div>
  );
}

function FormProposalPreview({ action }: { action: AgentProposedAction }) {
  if (!['form.create', 'form.update', 'form.activate', 'form.deactivate', 'form.link_workflow'].includes(action.actionType)) {
    return null;
  }
  const after = asRecord(action.payload.after);
  if (!after) return null;
  const fields = Array.isArray(after.fields)
    ? after.fields.map(asRecord).filter((field): field is Record<string, unknown> => Boolean(field))
    : [];
  const formName = typeof after.name === 'string' ? after.name : 'Form';
  const workflowName = typeof after.workflowName === 'string' ? after.workflowName : null;
  const isActive = after.isActive === true;
  const result = asRecord(action.result);
  const formHref = typeof result?.href === 'string' ? result.href : null;
  const publicHref = typeof result?.publicHref === 'string' ? result.publicHref : null;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.07] bg-black/25">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-violet-200/10 bg-violet-200/[0.05] text-violet-100/55">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white/75">{formName}</p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">
              {fields.length} field{fields.length === 1 ? '' : 's'} · {isActive ? 'active' : 'inactive'}
            </p>
          </div>
        </div>
        <span className={cn(
          "rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-wider",
          isActive
            ? "border-emerald-200/10 bg-emerald-200/[0.04] text-emerald-100/55"
            : "border-white/10 bg-white/[0.03] text-white/35",
        )}>
          {isActive ? 'Accepting submissions' : 'Closed'}
        </span>
      </div>

      {fields.length > 0 && (
        <ol className="divide-y divide-white/[0.055] px-3.5">
          {fields.slice(0, 4).map((field, index) => (
            <li key={typeof field.id === 'string' ? field.id : index} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 py-2">
              <span className="font-mono text-[9px] text-violet-100/30">{String(index + 1).padStart(2, '0')}</span>
              <span className="truncate text-[11px] text-white/60">{typeof field.label === 'string' ? field.label : 'Untitled field'}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/25">{typeof field.type === 'string' ? field.type : 'field'}</span>
            </li>
          ))}
          {fields.length > 4 && <li className="py-2 text-[10px] text-white/30">+{fields.length - 4} more fields</li>}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-3.5 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-white/35">
          <Link2 className="h-3 w-3" />
          <span className={action.status === 'failed' ? 'text-rose-200/60' : undefined}>
            {action.status === 'failed'
              ? action.errorMessage || 'The approved form action failed.'
              : workflowName ? `Submissions → ${workflowName}` : 'No workflow linked'}
          </span>
        </div>
        {action.status === 'completed' && (formHref || publicHref) && (
          <div className="flex items-center gap-2">
            {publicHref && <Link href={publicHref} className="text-[10px] text-white/40 hover:text-white/70">Open form</Link>}
            {formHref && <Link href={formHref} className="text-[10px] font-medium text-violet-100/60 hover:text-violet-100">Edit form</Link>}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactProposalPreview({ action }: { action: AgentProposedAction }) {
  if (!['contact.create', 'contact.update', 'contact.activate', 'contact.deactivate'].includes(action.actionType)) {
    return null;
  }
  const after = asRecord(action.payload.after);
  if (!after) return null;
  const name = typeof after.name === 'string' ? after.name : 'Contact';
  const email = typeof after.email === 'string' ? after.email : 'No email';
  const company = typeof after.company === 'string' ? after.company : null;
  const jobTitle = typeof after.jobTitle === 'string' ? after.jobTitle : null;
  const tags = Array.isArray(after.tags)
    ? after.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 4)
    : [];
  const isActive = after.isActive === true;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
  const result = asRecord(action.result);
  const href = typeof result?.href === 'string' ? result.href : null;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.07] bg-black/25">
      <div className="flex items-start gap-3.5 px-3.5 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-100/10 bg-cyan-100/[0.055] font-mono text-[11px] font-semibold tracking-wider text-cyan-50/65">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white/75">{name}</p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-white/40">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{email}</span>
              </p>
            </div>
            <span className={cn(
              "rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-wider",
              isActive
                ? "border-cyan-100/10 bg-cyan-100/[0.04] text-cyan-50/55"
                : "border-white/10 bg-white/[0.025] text-white/35",
            )}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {(company || jobTitle) && (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30">
              <Building2 className="h-3 w-3" />
              {[jobTitle, company].filter(Boolean).join(' · ')}
            </p>
          )}
          {tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.map((tag) => <span key={tag} className="rounded-full border border-white/[0.07] px-2 py-0.5 text-[9px] text-white/35">{tag}</span>)}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-3.5 py-2.5 text-[10px]">
        <span className={action.status === 'failed' ? 'text-rose-200/60' : 'text-white/30'}>
          {action.status === 'failed' ? action.errorMessage || 'The approved contact action failed.' : 'One email address per workspace contact'}
        </span>
        {action.status === 'completed' && href && (
          <Link href={href} className="flex items-center gap-1.5 font-medium text-cyan-50/55 hover:text-cyan-50">
            <UserRound className="h-3 w-3" />
            Edit contact
          </Link>
        )}
      </div>
    </div>
  );
}

function ExecutionProposalPreview({ action }: { action: AgentProposedAction }) {
  if (!['workflow.run', 'execution.cancel', 'execution.retry'].includes(action.actionType)) {
    return null;
  }
  const workflowName = typeof action.payload.workflowName === "string"
    ? action.payload.workflowName
    : "Workflow execution";
  const sourceExecutionId = typeof action.payload.executionId === "string"
    ? action.payload.executionId
    : null;
  const result = asRecord(action.result);
  const resultExecutionId = typeof result?.executionId === "string" ? result.executionId : sourceExecutionId;
  const href = typeof result?.href === "string"
    ? result.href
    : resultExecutionId ? `/dashboard/executions/${resultExecutionId}` : null;
  const resultStatus = typeof result?.status === "string" ? result.status : null;
  const verb = action.actionType === "workflow.run"
    ? "Run workflow"
    : action.actionType === "execution.cancel" ? "Cancel execution" : "Retry failed execution";

  return (
    <div className="mt-4 border-y border-white/[0.07] py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">{verb}</p>
          <p className="mt-1 text-xs font-medium text-white/70">{workflowName}</p>
        </div>
        {sourceExecutionId && (
          <span className="font-mono text-[9px] text-white/25">{sourceExecutionId.slice(0, 8)}</span>
        )}
      </div>

      {(action.status === "completed" || action.status === "failed") && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/30 px-3 py-2.5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">Execution receipt</p>
            <p className={cn(
              "mt-1 text-xs font-medium",
              action.status === "failed" ? "text-rose-200/70" : "text-emerald-100/70",
            )}>
              {action.status === "failed" ? action.errorMessage || "Action failed" : resultStatus?.replaceAll("_", " ") || "Completed"}
            </p>
          </div>
          {href && (
            <Link
              href={href}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              View execution
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function IntegrationProposalPreview({ action }: { action: AgentProposedAction }) {
  if (action.actionType !== 'integration.disconnect') return null;
  const before = asRecord(action.payload.before);
  const provider = typeof before?.name === 'string' ? before.name : 'Integration';
  const providerType = typeof before?.type === 'string' ? before.type : 'provider';
  const result = asRecord(action.result);
  const href = typeof result?.href === 'string' ? result.href : '/dashboard/integrations';

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.07] bg-black/25">
      <div className="flex items-start gap-3.5 px-3.5 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-100/10 bg-rose-100/[0.045] text-rose-50/60">
          <Unplug className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-white/75">{provider}</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">{providerType}</p>
            </div>
            <span className="rounded-full border border-rose-100/10 bg-rose-100/[0.035] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-rose-50/55">
              Disconnect
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-white/40">
            Stored credentials will be removed. Secret values are never shown in this confirmation.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-3.5 py-2.5 text-[10px]">
        <span className={action.status === 'failed' ? 'text-rose-200/60' : 'text-white/30'}>
          {action.status === 'failed' ? action.errorMessage || 'The integration could not be disconnected.' : 'Explicit approval required'}
        </span>
        {action.status === 'completed' && (
          <Link href={href} className="font-medium text-rose-50/55 hover:text-rose-50">View integrations</Link>
        )}
      </div>
    </div>
  );
}

function actionStatusCopy(action: AgentProposedAction) {
  if (action.status === "pending") {
    return {
      label: "Approval required",
      detail: `Decision closes ${new Date(action.expiresAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`,
      tone: "border-amber-300/20 bg-amber-200/[0.045]",
      rail: "bg-amber-200",
      icon: <Clock3 className="h-3.5 w-3.5" />,
    };
  }
  if (action.status === "approved" || action.status === "completed") {
    return {
      label: action.status === "completed" ? "Completed" : "Approved",
      detail: action.status === "completed" ? "The approved action completed." : "Ready for the next execution phase.",
      tone: "border-emerald-300/15 bg-emerald-300/[0.035]",
      rail: "bg-emerald-300",
      icon: <Check className="h-3.5 w-3.5" />,
    };
  }
  if (action.status === "rejected") {
    return {
      label: "Rejected",
      detail: "This proposal will not be applied.",
      tone: "border-rose-300/15 bg-rose-300/[0.03]",
      rail: "bg-rose-300/70",
      icon: <X className="h-3.5 w-3.5" />,
    };
  }
  if (action.status === "executing") {
    return {
      label: "In progress",
      detail: "The approved action is being applied.",
      tone: "border-sky-300/15 bg-sky-300/[0.03]",
      rail: "bg-sky-300/70",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    };
  }
  if (action.status === "failed") {
    return {
      label: "Failed",
      detail: "The approved action could not be completed.",
      tone: "border-rose-300/15 bg-rose-300/[0.03]",
      rail: "bg-rose-300/70",
      icon: <X className="h-3.5 w-3.5" />,
    };
  }
  return {
    label: "Expired",
    detail: action.status === "expired" ? "The approval window closed without a decision." : "This action is no longer awaiting approval.",
    tone: "border-white/10 bg-white/[0.025]",
    rail: "bg-white/30",
    icon: <Clock3 className="h-3.5 w-3.5" />,
  };
}

function AgentActionCard({
  action,
  deciding,
  decisionError,
  onDecision,
}: {
  action: AgentProposedAction;
  deciding: boolean;
  decisionError?: string;
  onDecision: (decision: "approve" | "reject") => void;
}) {
  const status = actionStatusCopy(action);
  const details = Object.entries(action.payload).slice(0, 4);
  const isWorkflowProposal = action.actionType === "workflow.create" || action.actionType === "workflow.update";
  const isExecutionProposal = ['workflow.run', 'execution.cancel', 'execution.retry'].includes(action.actionType);
  const isFormProposal = ['form.create', 'form.update', 'form.activate', 'form.deactivate', 'form.link_workflow'].includes(action.actionType);
  const isContactProposal = ['contact.create', 'contact.update', 'contact.activate', 'contact.deactivate'].includes(action.actionType);
  const isIntegrationProposal = action.actionType === 'integration.disconnect';
  const isQuickProposal = action.actionType === 'event.log' || action.actionType === 'email.send';

  return (
    <div className={cn("relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-[0_18px_55px_rgba(0,0,0,0.2)] backdrop-blur", status.tone)}>
      <div className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full", status.rail)} />
      <div className="px-4 py-4 pl-5 sm:px-5 sm:pl-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
              <ShieldCheck className="h-3.5 w-3.5 text-white/50" />
              {action.actionType.replaceAll("_", " ").replaceAll(".", " / ")}
            </div>
            <h3 className="mt-2 text-sm font-semibold leading-5 text-white">{action.title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/20 px-2.5 py-1 text-[10px] font-medium text-white/55">
            {status.icon}
            <span>{status.label}</span>
          </div>
        </div>

        {action.description && (
          <p className="mt-2 text-sm leading-5 text-white/55">{action.description}</p>
        )}

        {isWorkflowProposal && <WorkflowProposalPreview action={action} />}
        {isExecutionProposal && <ExecutionProposalPreview action={action} />}
        {isFormProposal && <FormProposalPreview action={action} />}
        {isContactProposal && <ContactProposalPreview action={action} />}
        {isIntegrationProposal && <IntegrationProposalPreview action={action} />}
        {isQuickProposal && <QuickActionPreview action={action} />}

        {!isWorkflowProposal && !isExecutionProposal && !isFormProposal && !isContactProposal && !isIntegrationProposal && !isQuickProposal && details.length > 0 && (
          <dl className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {details.map(([key, value]) => (
              <div key={key} className="grid grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] gap-3 py-2 text-xs leading-5">
                <dt className="truncate font-mono text-[10px] uppercase tracking-wider text-white/30">{key}</dt>
                <dd className="break-words text-white/65">{formatActionValue(value)}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-white/30">{status.detail}</p>
          {action.status === "pending" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={deciding}
                onClick={() => onDecision("reject")}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/55 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={deciding}
                onClick={() => onDecision("approve")}
                className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3.5 py-2 text-xs font-semibold text-black transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50"
              >
                {deciding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Approve
              </button>
            </div>
          )}
        </div>
        {decisionError && <p className="mt-2 text-xs text-rose-300/80">{decisionError}</p>}
      </div>
    </div>
  );
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const data = await response.json().catch(() => null);
  return new Error(data?.error || fallback);
}

export default function AgentPage() {
  const queryClient = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [threadSearch, setThreadSearch] = useState("");
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [pendingUserText, setPendingUserText] = useState("");
  const [streamingText, setStreamingText] = useState("");

  useEffect(() => {
    const suggestedPrompt = new URLSearchParams(window.location.search).get('prompt');
    if (suggestedPrompt && suggestedPrompt.length <= 4_000) setDraft(suggestedPrompt);
  }, []);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequestRef = useRef<AbortController | null>(null);

  const threadsQuery = useQuery<AgentThread[]>({
    queryKey: agentQueryKeys.threads,
    queryFn: async () => {
      const response = await fetch("/api/agent/threads");
      if (!response.ok) throw await readError(response, "Failed to load conversations");
      const data = await response.json();
      return data.threads || [];
    },
  });

  const messagesQuery = useQuery<AgentConversation>({
    queryKey: agentQueryKeys.messages(selectedThreadId || "new"),
    queryFn: async () => {
      const response = await fetch(`/api/agent/threads/${selectedThreadId}/messages`);
      if (!response.ok) throw await readError(response, "Failed to load conversation");
      const data = await response.json();
      return { messages: data.messages || [], actions: data.actions || [] };
    },
    enabled: !!selectedThreadId,
    refetchInterval: 30_000,
  });

  const sendMessage = useMutation<SendMessageResponse | null, Error, string>({
    mutationFn: async (message) => {
      const runId = crypto.randomUUID();
      const requestController = new AbortController();
      activeRequestRef.current = requestController;
      setActiveRunId(runId);
      setPendingUserText(message);
      setStreamingText("");

      try {
        const response = await fetch("/api/agent/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId,
            message,
            ...(selectedThreadId ? { threadId: selectedThreadId } : {}),
          }),
          signal: requestController.signal,
        });

        if (!response.ok) throw await readError(response, "Failed to send message");
        if (!response.body) throw new Error("Streaming is unavailable");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let completedResponse: SendMessageResponse | null = null;
        let wasCancelled = false;

        const handleLine = (line: string) => {
          if (!line.trim()) return;
          const event = JSON.parse(line) as AgentStreamEvent;

          if (event.type === "delta") {
            setStreamingText((current) => current + event.delta);
          } else if (event.type === "done") {
            completedResponse = {
              thread: event.thread,
              messages: event.messages,
              actions: event.actions || [],
            };
          } else if (event.type === "cancelled") {
            wasCancelled = true;
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          lines.forEach(handleLine);

          if (done) {
            if (buffer) handleLine(buffer);
            break;
          }
        }

        if (wasCancelled) return null;
        if (!completedResponse) throw new Error("Agent stream ended before completion");
        return completedResponse;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return null;
        }
        throw error;
      } finally {
        activeRequestRef.current = null;
        setActiveRunId(null);
      }
    },
    onSuccess: (data) => {
      setPendingUserText("");
      setStreamingText("");
      if (!data) return;

      const threadId = data.thread.id;
      queryClient.setQueryData<AgentConversation>(
        agentQueryKeys.messages(threadId),
        (current) => ({
          messages: [
            ...(current?.messages || []),
            data.messages.user,
            data.messages.assistant,
          ],
          actions: [...(current?.actions || []), ...(data.actions || [])],
        }),
      );
      setSelectedThreadId(threadId);
      setDraft("");
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.threads });
    },
    onError: () => {
      setPendingUserText("");
      setStreamingText("");
    },
  });

  const decideAction = useMutation<
    AgentActionDecisionResponse,
    Error,
    { action: AgentProposedAction; decision: "approve" | "reject" }
  >({
    mutationFn: async ({ action, decision }) => {
      const response = await fetch(`/api/agent/actions/${action.id}/${decision}`, {
        method: "POST",
      });
      if (!response.ok) throw await readError(response, `Failed to ${decision} action`);
      return response.json();
    },
    onSuccess: ({ action }) => {
      queryClient.setQueryData<AgentConversation>(
        agentQueryKeys.messages(action.threadId),
        (current) => current ? {
          ...current,
          actions: current.actions.map((item) => item.id === action.id ? action : item),
        } : current,
      );
    },
    onError: (_error, { action }) => {
      queryClient.invalidateQueries({ queryKey: agentQueryKeys.messages(action.threadId) });
    },
  });

  const threads = threadsQuery.data || [];
  const filteredThreads = threadSearch.trim()
    ? threads.filter((thread) => thread.title.toLowerCase().includes(threadSearch.trim().toLowerCase()))
    : threads;
  const messages = selectedThreadId ? (messagesQuery.data?.messages || []) : [];
  const actions = selectedThreadId ? (messagesQuery.data?.actions || []) : [];
  const messageIds = new Set(messages.map((message) => message.id));
  const detachedActions = actions.filter(
    (action) => !action.assistantMessageId || !messageIds.has(action.assistantMessageId),
  );
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, actions.length, sendMessage.isPending, streamingText]);

  const startConversation = () => {
    setSelectedThreadId(null);
    setDraft("");
    setMobileConversationOpen(true);
    sendMessage.reset();
  };

  const selectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setMobileConversationOpen(true);
    sendMessage.reset();
  };

  const submitMessage = (event?: FormEvent) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || sendMessage.isPending) return;
    sendMessage.mutate(message);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  const stopResponse = () => {
    if (!activeRunId) return;

    void fetch(`/api/agent/runs/${activeRunId}/cancel`, { method: "POST" })
      .catch(() => undefined);
    activeRequestRef.current?.abort();
  };

  return (
    <div className="relative isolate flex h-[calc(100dvh-4rem)] min-h-[580px] flex-col overflow-hidden bg-[#05070a]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-cyan-400/[0.055] blur-[110px]" />
        <div className="absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-violet-500/[0.055] blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.022] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <header className="flex h-[5.25rem] shrink-0 items-center justify-between border-b border-white/[0.075] px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200/15 bg-cyan-100/[0.055] shadow-[0_0_28px_rgba(103,232,249,0.08)]">
            <Sparkles className="h-[18px] w-[18px] text-cyan-100/75" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#05070a] bg-emerald-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl">Execute Agent</h1>
              <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-white/35 sm:inline">command layer</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-white/35">Inspect, plan, and act across your workspace</p>
          </div>
        </div>
        <div className="hidden items-center gap-5 text-[10px] text-white/30 sm:flex">
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-amber-100/50" />Writes require approval</span>
          <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-cyan-100/50" />Streaming live</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 p-2.5 sm:p-4 lg:p-5">
        <div className="mx-auto flex h-full max-w-[1500px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#070a0f]/90 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <aside className={cn(
            "w-full shrink-0 border-white/[0.075] bg-[#080c12]/95 md:block md:w-[19rem] md:border-r lg:w-[21rem]",
            mobileConversationOpen ? "hidden" : "block",
          )}>
            <div className="border-b border-white/[0.07] p-3.5">
              <button
                type="button"
                onClick={startConversation}
                className="flex w-full items-center justify-between rounded-xl border border-cyan-100/15 bg-cyan-100/[0.065] px-3.5 py-3 text-left text-sm font-medium text-cyan-50/90 transition-all hover:border-cyan-100/25 hover:bg-cyan-100/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/30"
              >
                <span className="flex items-center gap-2.5"><Plus className="h-4 w-4" />New conversation</span>
                <Command className="h-3.5 w-3.5 text-cyan-50/35" />
              </button>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                <input
                  value={threadSearch}
                  onChange={(event) => setThreadSearch(event.target.value)}
                  placeholder="Search conversations"
                  className="h-9 w-full rounded-lg border border-white/[0.07] bg-black/20 pl-9 pr-3 text-xs text-white/70 outline-none transition-colors placeholder:text-white/25 focus:border-white/15"
                />
              </div>
            </div>

            <div className="flex h-[calc(100%-7.75rem)] flex-col">
              <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/30"><History className="h-3 w-3" />Recent</span>
                <span className="font-mono text-[9px] text-white/20">{threads.length}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
                {threadsQuery.isLoading ? (
                  <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>
                ) : threadsQuery.isError ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs leading-5 text-rose-200/70">{threadsQuery.error.message}</p>
                    <button type="button" onClick={() => threadsQuery.refetch()} className="mt-3 text-xs font-medium text-white/60 hover:text-white">Try again</button>
                  </div>
                ) : threads.length === 0 ? (
                  <div className="mx-2 mt-2 rounded-xl border border-dashed border-white/[0.08] px-5 py-10 text-center">
                    <MessageSquare className="mx-auto h-5 w-5 text-white/20" />
                    <p className="mt-3 text-xs text-white/40">Your conversations will collect here.</p>
                  </div>
                ) : filteredThreads.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-white/35">No matching conversations</p>
                ) : (
                  <div className="space-y-1">
                    {filteredThreads.map((thread) => {
                      const selected = selectedThreadId === thread.id;
                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => selectThread(thread.id)}
                          className={cn(
                            "group relative flex w-full items-start gap-3 overflow-hidden rounded-xl px-3 py-3 text-left transition-all",
                            selected ? "bg-white/[0.075] text-white" : "text-white/55 hover:bg-white/[0.035] hover:text-white/80",
                          )}
                        >
                          {selected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-cyan-200/80" />}
                          <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border", selected ? "border-cyan-100/15 bg-cyan-100/[0.055] text-cyan-50/60" : "border-white/[0.06] bg-white/[0.025] text-white/25")}>
                            <MessageSquare className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-xs font-medium leading-5">{thread.title}</span>
                            <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-white/20">{formatThreadTime(thread.lastMessageAt)}</span>
                          </span>
                          <ChevronRight className={cn("mt-1 h-3.5 w-3.5 shrink-0 transition-all", selected ? "translate-x-0 text-white/35" : "-translate-x-1 text-transparent group-hover:translate-x-0 group-hover:text-white/25")} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className={cn(
            "relative min-w-0 flex-1 flex-col bg-[#070a0f]/70",
            mobileConversationOpen ? "flex" : "hidden md:flex",
          )}>
            <div className="flex h-[4.5rem] shrink-0 items-center justify-between gap-3 border-b border-white/[0.075] bg-[#080b10]/85 px-4 backdrop-blur sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <Button type="button" variant="ghost" size="icon" onClick={() => setMobileConversationOpen(false)} className="h-9 w-9 text-white/50 hover:bg-white/5 hover:text-white md:hidden" aria-label="Back to conversations">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white/85">{selectedThread?.title || "Untitled workspace task"}</p>
                  <p className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />Agent ready · tenant scoped
                  </p>
                </div>
              </div>
              <button type="button" onClick={startConversation} className="hidden items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] font-medium text-white/45 transition-colors hover:border-white/15 hover:bg-white/[0.035] hover:text-white sm:flex">
                <Plus className="h-3.5 w-3.5" />New task
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {messagesQuery.isLoading && selectedThreadId ? (
                <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-100/35" /></div>
              ) : messagesQuery.isError ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200/10 bg-rose-200/[0.04]"><X className="h-4 w-4 text-rose-200/60" /></div>
                  <p className="mt-4 text-sm text-rose-200/70">{messagesQuery.error.message}</p>
                  <button type="button" onClick={() => messagesQuery.refetch()} className="mt-3 text-xs font-medium text-white/60 hover:text-white">Reload conversation</button>
                </div>
              ) : messages.length === 0 && actions.length === 0 && !sendMessage.isPending ? (
                <div className="mx-auto flex min-h-full max-w-4xl items-start px-5 py-5 sm:px-10 lg:px-14 lg:py-6">
                  <div className="w-full">
                    <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-100/45"><span className="h-px w-8 bg-cyan-100/30" />Workspace command</div>
                    <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[2.15rem] lg:text-[2.35rem]">
                      Name the outcome.<br /><span className="text-white/35">I&apos;ll map the work.</span>
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-5 text-white/40">Inspect live workspace data, diagnose execution failures, or prepare changes for your approval—all from one conversation.</p>
                    <div className="mt-5 grid max-w-3xl gap-2.5 sm:grid-cols-3">
                      {suggestedPrompts.map((prompt, index) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setDraft(prompt)}
                          className="group min-h-[5.25rem] rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-100/15 hover:bg-cyan-100/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/25 motion-reduce:transform-none"
                        >
                          <span className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-white/20"><span>0{index + 1}</span><CornerDownLeft className="h-3 w-3 transition-colors group-hover:text-cyan-100/45" /></span>
                          <span className="mt-3 block text-xs font-medium leading-5 text-white/55 transition-colors group-hover:text-white/80">{prompt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-4xl space-y-7 px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
                  {messages.map((message) => {
                    const isUser = message.role === "user";
                    const messageActions = actions.filter((action) => action.assistantMessageId === message.id);
                    return (
                      <Fragment key={message.id}>
                        {isUser ? (
                          <div className="flex flex-col items-end">
                            <div className="mb-1.5 flex items-center gap-2 px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/20"><span>You</span><span>{formatMessageTime(message.createdAt)}</span></div>
                            <div className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-cyan-100/10 bg-cyan-100/[0.07] px-4 py-3 text-sm leading-6 text-white/85 shadow-[0_12px_35px_rgba(0,0,0,0.16)] sm:max-w-[76%]">{getMessageText(message)}</div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-200/10 bg-violet-200/[0.05] text-violet-100/60"><Sparkles className="h-3.5 w-3.5" /></div>
                            <div className="min-w-0 max-w-[calc(100%-2.75rem)] flex-1">
                              <div className="mb-1.5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/20"><span className="text-violet-100/40">Execute Agent</span><span>{formatMessageTime(message.createdAt)}</span></div>
                              <div className="max-w-3xl whitespace-pre-wrap text-sm leading-6 text-white/70">{getMessageText(message)}</div>
                            </div>
                          </div>
                        )}
                        {messageActions.length > 0 && (
                          <div className="space-y-3 pl-0 sm:pl-11">
                            {messageActions.map((action) => (
                              <AgentActionCard key={action.id} action={action} deciding={decideAction.isPending && decideAction.variables?.action.id === action.id} decisionError={decideAction.isError && decideAction.variables?.action.id === action.id ? decideAction.error.message : undefined} onDecision={(decision) => decideAction.mutate({ action, decision })} />
                            ))}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                  {detachedActions.map((action) => (
                    <div key={action.id} className="pl-0 sm:pl-11"><AgentActionCard action={action} deciding={decideAction.isPending && decideAction.variables?.action.id === action.id} decisionError={decideAction.isError && decideAction.variables?.action.id === action.id ? decideAction.error.message : undefined} onDecision={(decision) => decideAction.mutate({ action, decision })} /></div>
                  ))}
                  {sendMessage.isPending && pendingUserText && (
                    <div className="flex flex-col items-end">
                      <div className="mb-1.5 px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/20">You · now</div>
                      <div className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-cyan-100/10 bg-cyan-100/[0.07] px-4 py-3 text-sm leading-6 text-white/85 sm:max-w-[76%]">{pendingUserText}</div>
                    </div>
                  )}
                  {sendMessage.isPending && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-200/10 bg-violet-200/[0.05] text-violet-100/60"><Sparkles className="h-3.5 w-3.5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-violet-100/40">Execute Agent · live</div>
                        {streamingText ? (
                          <div className="max-w-3xl whitespace-pre-wrap text-sm leading-6 text-white/70">{streamingText}<span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-cyan-100/60 align-middle" /></div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-white/35"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-100/50" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-100/35 [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-100/20 [animation-delay:300ms]" /></span><span>Reading workspace context</span></div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="shrink-0 bg-gradient-to-t from-[#070a0f] via-[#070a0f] to-transparent px-3 pb-3 pt-2 sm:px-5 sm:pb-4">
              <form onSubmit={submitMessage} className="mx-auto max-w-4xl">
                {sendMessage.isError && <div className="mb-2 rounded-lg border border-rose-200/10 bg-rose-200/[0.04] px-3 py-2 text-xs text-rose-200/70">{sendMessage.error.message}</div>}
                <div className="rounded-2xl border border-white/[0.1] bg-[#0c1118]/95 p-2 shadow-[0_18px_55px_rgba(0,0,0,0.38)] transition-colors focus-within:border-cyan-100/20 focus-within:shadow-[0_18px_60px_rgba(0,0,0,0.42),0_0_0_1px_rgba(103,232,249,0.04)]">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Describe an outcome or ask about your workspace…"
                    rows={2}
                    maxLength={4000}
                    disabled={sendMessage.isPending}
                    className="max-h-36 min-h-[3.25rem] w-full resize-none bg-transparent px-2.5 py-2 text-sm leading-6 text-white/85 outline-none placeholder:text-white/25 disabled:opacity-60"
                  />
                  <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-1.5 pt-2">
                    <div className="flex min-w-0 items-center gap-3 font-mono text-[9px] uppercase tracking-wider text-white/20">
                      <span className="hidden items-center gap-1.5 sm:flex"><CornerDownLeft className="h-3 w-3" />Enter to send</span>
                      <span>{draft.length.toLocaleString()} / 4,000</span>
                    </div>
                    {sendMessage.isPending ? (
                      <button type="button" onClick={stopResponse} className="flex h-9 items-center gap-2 rounded-lg border border-rose-200/15 bg-rose-200/[0.055] px-3 text-xs font-medium text-rose-100/75 transition-colors hover:bg-rose-200/[0.09]" aria-label="Stop generating"><Square className="h-3 w-3 fill-current" />Stop</button>
                    ) : (
                      <button type="submit" disabled={!draft.trim()} className="flex h-9 items-center gap-2 rounded-lg bg-cyan-50 px-3.5 text-xs font-semibold text-[#061014] transition-all hover:bg-white disabled:pointer-events-none disabled:opacity-25" aria-label="Send message">Send <Send className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-center font-mono text-[8px] uppercase tracking-[0.16em] text-white/15">Scoped to your workspace · proposed changes always require confirmation</p>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
