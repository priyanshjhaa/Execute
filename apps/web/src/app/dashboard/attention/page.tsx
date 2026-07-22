"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Check, ChevronRight, CircleSlash2, Loader2, Radar, RotateCcw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type FindingStatus = 'open' | 'resolved' | 'dismissed';

interface FailureFinding {
  id: string;
  executionId: string;
  workflowId: string | null;
  workflowName: string | null;
  category: string;
  severity: 'high' | 'medium';
  title: string;
  summary: string;
  evidence: string[];
  status: FindingStatus;
  detectedAt: string;
  proposedRepair: {
    kind: string;
    label: string;
    description: string;
    agentPrompt: string;
    requiresApproval: true;
  };
}

const statuses: Array<{ value: FindingStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

function formatCategory(category: string) {
  return category.replaceAll('_', ' ');
}

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AttentionPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FindingStatus>('open');
  const findingsQuery = useQuery<FailureFinding[]>({
    queryKey: ['failure-findings', status],
    queryFn: async () => {
      const response = await fetch(`/api/agent/failure-findings?status=${status}`);
      if (!response.ok) throw new Error('Failed to load failure findings');
      const data = await response.json();
      return data.findings || [];
    },
    refetchInterval: status === 'open' ? 30_000 : false,
  });
  const updateFinding = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: string; nextStatus: FindingStatus }) => {
      const response = await fetch(`/api/agent/failure-findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error('Failed to update finding');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['failure-findings'] });
    },
  });
  const findings = findingsQuery.data || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-rose-100/45">
                <Radar className="h-3.5 w-3.5" /> Failure monitor
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Needs attention</h1>
              <p className="mt-2 text-sm leading-6 text-white/45">Failed runs are classified here. Repairs stay as reviewable guidance until you choose to continue in Agent.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white/40">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-100/55" /> No automatic repairs
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-1 border-b border-white/[0.07]">
          {statuses.map((item) => (
            <button key={item.value} onClick={() => setStatus(item.value)} className={cn(
              'relative px-4 py-3 text-xs font-medium transition-colors',
              status === item.value ? 'text-white' : 'text-white/35 hover:text-white/65',
            )}>
              {item.label}
              {status === item.value && <span className="absolute inset-x-2 bottom-0 h-px bg-rose-200/70" />}
            </button>
          ))}
        </div>

        {findingsQuery.isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-white/35" /></div>
        ) : findingsQuery.isError ? (
          <div className="flex items-center gap-2 border border-rose-300/15 bg-rose-300/[0.035] px-5 py-4 text-sm text-rose-100/70"><AlertTriangle className="h-4 w-4" /> The attention queue could not be loaded.</div>
        ) : findings.length === 0 ? (
          <div className="border border-white/[0.07] bg-white/[0.018] px-6 py-20 text-center">
            <Check className="mx-auto h-6 w-6 text-emerald-100/45" />
            <p className="mt-4 text-sm font-medium text-white/65">{status === 'open' ? 'No failed runs need attention' : `No ${status} findings`}</p>
            <p className="mt-2 text-xs text-white/30">The monitor will add newly failed executions after its next scheduler scan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {findings.map((finding) => (
              <article key={finding.id} className="group relative overflow-hidden border border-white/[0.075] bg-white/[0.018] transition-colors hover:bg-white/[0.028]">
                <div className={cn('absolute inset-y-0 left-0 w-0.5', finding.severity === 'high' ? 'bg-rose-300/80' : 'bg-amber-200/65')} />
                <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">
                      <span className={finding.severity === 'high' ? 'text-rose-100/60' : 'text-amber-100/55'}>{finding.severity}</span>
                      <span>·</span><span>{formatCategory(finding.category)}</span><span>·</span><span>{timeAgo(finding.detectedAt)}</span>
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-white/82">{finding.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-white/45">{finding.summary}</p>
                    {finding.evidence.length > 0 && (
                      <div className="mt-4 border-l border-white/[0.08] pl-4">
                        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">Failure trace</p>
                        {finding.evidence.slice(0, 2).map((line, index) => <p key={index} className="mt-1 truncate font-mono text-[10px] leading-5 text-white/35">{line}</p>)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-between border-t border-white/[0.07] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">Proposed next step</p>
                      <p className="mt-2 text-xs font-semibold text-white/65">{finding.proposedRepair.label}</p>
                      <p className="mt-1 text-[11px] leading-5 text-white/35">{finding.proposedRepair.description}</p>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <Link href={`/dashboard/agent?prompt=${encodeURIComponent(finding.proposedRepair.agentPrompt)}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-black hover:bg-white/90">
                        Review in Agent <ChevronRight className="h-3 w-3" />
                      </Link>
                      <Link href={`/dashboard/executions/${finding.executionId}`} className="inline-flex items-center gap-1.5 px-2 py-2 text-[11px] text-white/40 hover:text-white/70">
                        Execution <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-white/[0.055] px-5 py-2.5 sm:px-6">
                  {status === 'open' ? <>
                    <button disabled={updateFinding.isPending} onClick={() => updateFinding.mutate({ id: finding.id, nextStatus: 'dismissed' })} className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-white/30 hover:text-white/60 disabled:opacity-40"><CircleSlash2 className="h-3 w-3" /> Dismiss</button>
                    <button disabled={updateFinding.isPending} onClick={() => updateFinding.mutate({ id: finding.id, nextStatus: 'resolved' })} className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-emerald-100/50 hover:text-emerald-100/80 disabled:opacity-40"><Check className="h-3 w-3" /> Mark resolved</button>
                  </> : (
                    <button disabled={updateFinding.isPending} onClick={() => updateFinding.mutate({ id: finding.id, nextStatus: 'open' })} className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-white/35 hover:text-white/65 disabled:opacity-40"><RotateCcw className="h-3 w-3" /> Reopen</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
