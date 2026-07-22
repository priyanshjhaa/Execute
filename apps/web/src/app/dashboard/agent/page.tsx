"use client";

import { FormEvent, Fragment, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Bot, Building2, Check, ChevronRight, Clock3, FileText, GitCompareArrows, Link2, Loader2, Mail, MessageSquare, Plus, Send, ShieldCheck, Square, UserRound, Workflow as WorkflowIcon, X } from "lucide-react";
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
    return [{
      id: typeof step.id === "string"
        ? step.id
        : `${typeof step.position === "number" ? step.position : 0}-${typeof step.name === "string" ? step.name : "step"}`,
      name: typeof step.name === "string" ? step.name : "Unnamed step",
      type: typeof step.type === "string" ? step.type : "unknown",
      position: typeof step.position === "number" ? step.position : 0,
    }];
  }).sort((left, right) => left.position - right.position);
  const changedFields = Array.isArray(action.payload.changedFields)
    ? action.payload.changedFields.filter((field): field is string => typeof field === "string")
    : [];
  const validation = asRecord(action.payload.validation);
  const warnings = Array.isArray(validation?.warnings)
    ? validation.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];

  return {
    operation: action.actionType === "workflow.create" ? "create" : "update",
    name: typeof after.name === "string" ? after.name : action.title,
    previousName: typeof before?.name === "string" ? before.name : null,
    triggerType: typeof after.triggerType === "string" ? after.triggerType : "unknown",
    status: typeof after.status === "string" ? after.status : "draft",
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
              <span className="max-w-32 truncate text-[11px] font-medium text-white/65">{step.name}</span>
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

  return (
    <div className={cn("relative w-full max-w-xl overflow-hidden rounded-xl border", status.tone)}>
      <div className={cn("absolute inset-y-0 left-0 w-1", status.rail)} />
      <div className="px-4 py-4 pl-5 sm:px-5 sm:pl-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
              <ShieldCheck className="h-3.5 w-3.5 text-white/50" />
              {action.actionType.replaceAll("_", " ").replaceAll(".", " / ")}
            </div>
            <h3 className="mt-2 text-sm font-semibold leading-5 text-white">{action.title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-white/55">
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

        {!isWorkflowProposal && !isExecutionProposal && !isFormProposal && !isContactProposal && details.length > 0 && (
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
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/55 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={deciding}
                onClick={() => onDecision("approve")}
                className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50"
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
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [pendingUserText, setPendingUserText] = useState("");
  const [streamingText, setStreamingText] = useState("");
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
    <div className="flex h-[calc(100dvh-4rem)] min-h-[540px] flex-col bg-black">
      <header className="border-b border-white/10 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-white/60" />
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Agent</h1>
            <p className="mt-1 text-sm text-white/45">Ask questions and plan work with Execute</p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 p-3 sm:p-4 lg:p-6">
        <div className="mx-auto flex h-full max-w-7xl overflow-hidden rounded-xl border border-white/10 bg-white/[0.015]">
          <aside className={cn(
            "w-full shrink-0 border-white/10 bg-black md:block md:w-72 md:border-r lg:w-80",
            mobileConversationOpen ? "hidden" : "block",
          )}>
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <h2 className="text-sm font-semibold text-white">Conversations</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={startConversation}
                className="h-9 w-9 text-white/60 hover:bg-white/5 hover:text-white"
                aria-label="New conversation"
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="h-[calc(100%-4rem)] overflow-y-auto p-2">
              {threadsQuery.isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                </div>
              ) : threadsQuery.isError ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm text-red-300/80">{threadsQuery.error.message}</p>
                  <button
                    type="button"
                    onClick={() => threadsQuery.refetch()}
                    className="mt-3 text-xs font-medium text-white/60 hover:text-white"
                  >
                    Try again
                  </button>
                </div>
              ) : threads.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <MessageSquare className="mx-auto h-6 w-6 text-white/20" />
                  <p className="mt-3 text-sm text-white/45">No conversations yet</p>
                  <button
                    type="button"
                    onClick={startConversation}
                    className="mt-2 text-xs font-medium text-white/70 hover:text-white"
                  >
                    Start a conversation
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => selectThread(thread.id)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                        selectedThreadId === thread.id
                          ? "bg-white/10 text-white"
                          : "text-white/60 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span className="line-clamp-2 min-w-0 text-sm leading-5">{thread.title}</span>
                      <span className="shrink-0 pt-0.5 text-[11px] text-white/30">
                        {formatThreadTime(thread.lastMessageAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className={cn(
            "min-w-0 flex-1 flex-col bg-black",
            mobileConversationOpen ? "flex" : "hidden md:flex",
          )}>
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4 sm:px-5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMobileConversationOpen(false)}
                className="h-9 w-9 text-white/60 hover:bg-white/5 hover:text-white md:hidden"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {selectedThread?.title || "New conversation"}
                </p>
                <p className="text-xs text-white/35">Execute Agent</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {messagesQuery.isLoading && selectedThreadId ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                </div>
              ) : messagesQuery.isError ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm text-red-300/80">{messagesQuery.error.message}</p>
                  <button
                    type="button"
                    onClick={() => messagesQuery.refetch()}
                    className="mt-3 text-xs font-medium text-white/60 hover:text-white"
                  >
                    Try again
                  </button>
                </div>
              ) : messages.length === 0 && actions.length === 0 && !sendMessage.isPending ? (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Bot className="h-5 w-5 text-white/55" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">What are you working on?</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-white/40">
                    Ask about workflows, schedules, forms, executions, contacts, or integrations.
                  </p>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
                  {messages.map((message) => {
                    const isUser = message.role === "user";
                    const messageActions = actions.filter(
                      (action) => action.assistantMessageId === message.id,
                    );
                    return (
                      <Fragment key={message.id}>
                        <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[88%] whitespace-pre-wrap text-sm leading-6 sm:max-w-[78%]",
                            isUser
                              ? "rounded-2xl rounded-br-md bg-white/10 px-4 py-2.5 text-white"
                              : "text-white/75",
                          )}>
                            {getMessageText(message)}
                          </div>
                        </div>
                        {messageActions.map((action) => (
                          <AgentActionCard
                            key={action.id}
                            action={action}
                            deciding={decideAction.isPending && decideAction.variables?.action.id === action.id}
                            decisionError={
                              decideAction.isError && decideAction.variables?.action.id === action.id
                                ? decideAction.error.message
                                : undefined
                            }
                            onDecision={(decision) => decideAction.mutate({ action, decision })}
                          />
                        ))}
                      </Fragment>
                    );
                  })}
                  {detachedActions.map((action) => (
                    <AgentActionCard
                      key={action.id}
                      action={action}
                      deciding={decideAction.isPending && decideAction.variables?.action.id === action.id}
                      decisionError={
                        decideAction.isError && decideAction.variables?.action.id === action.id
                          ? decideAction.error.message
                          : undefined
                      }
                      onDecision={(decision) => decideAction.mutate({ action, decision })}
                    />
                  ))}
                  {sendMessage.isPending && pendingUserText && (
                    <div className="flex justify-end">
                      <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white/10 px-4 py-2.5 text-sm leading-6 text-white sm:max-w-[78%]">
                        {pendingUserText}
                      </div>
                    </div>
                  )}
                  {sendMessage.isPending && (
                    streamingText ? (
                      <div className="flex justify-start">
                        <div className="max-w-[88%] whitespace-pre-wrap text-sm leading-6 text-white/75 sm:max-w-[78%]">
                          {streamingText}
                          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-white/50 align-middle" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-white/40">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    )
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 p-3 sm:p-4">
              <form onSubmit={submitMessage} className="mx-auto max-w-3xl">
                {sendMessage.isError && (
                  <p className="mb-2 px-1 text-xs text-red-300/80">{sendMessage.error.message}</p>
                )}
                <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 focus-within:border-white/25">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Message Execute Agent..."
                    rows={1}
                    maxLength={4000}
                    disabled={sendMessage.isPending}
                    className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/30 disabled:opacity-60"
                  />
                  {sendMessage.isPending ? (
                    <Button
                      type="button"
                      size="icon"
                      onClick={stopResponse}
                      className="h-10 w-10 shrink-0"
                      aria-label="Stop generating"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!draft.trim()}
                      className="h-10 w-10 shrink-0"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-center text-[11px] text-white/25">
                  Enter to send, Shift + Enter for a new line
                </p>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
