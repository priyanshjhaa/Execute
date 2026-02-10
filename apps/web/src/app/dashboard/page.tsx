"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Eye,
  Zap,
  Plus,
  Wand2,
  Loader2,
} from "lucide-react";
import { useWorkflows, useExecutions, formatTimeAgo, type Workflow, type Execution } from "@/lib/query/hooks";

export default function DashboardPage() {
  // TanStack Query hooks with caching - data persists across navigation
  const { data: workflows = [], isLoading: workflowsLoading } = useWorkflows();
  const { data: executions = [], isLoading: executionsLoading } = useExecutions(5);

  // Show initial loading on first visit only
  const isLoading = workflowsLoading || executionsLoading;

  function getStatusIcon(status: string) {
    switch (status) {
      case "success":
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-white/60" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-pink-500/80" />;
      case "running":
        return <Zap className="h-4 w-4 text-white/60 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-white/40" />;
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Top Section */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
              <p className="text-white/50">
                Monitor and manage your workflows
              </p>
            </div>
            <Link href="/dashboard/workflows/new">
              <Button
                size="lg"
                className="text-base btn-gradient text-black px-6 py-5 rounded-full"
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Workflow
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-8 py-8">
        {/* Quick Commands CTA Card */}
        <div className="mb-12">
          <Link href="/dashboard/quick-commands">
            <div className="group relative p-6 md:p-8 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] overflow-hidden transition-all duration-300 cursor-pointer">
              {/* Pink gradient orb at top left */}
              <div className="absolute -top-8 -left-8 w-40 h-40 bg-gradient-to-br from-pink-500/40 via-pink-400/20 to-transparent rounded-full blur-[40px] pointer-events-none"></div>
              {/* Sky blue gradient orb at bottom right */}
              <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-gradient-to-tl from-sky-500/40 via-sky-400/20 to-transparent rounded-full blur-[40px] pointer-events-none"></div>

              {/* Header */}
              <div className="flex items-center justify-between mb-6 relative">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-xl bg-white/10 border border-white/20 group-hover:scale-110 transition-transform duration-300">
                    <Wand2 className="h-6 w-6 md:h-8 md:w-8 text-white/70" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Quick Commands</h2>
                    <p className="text-white/60 text-sm md:text-base">
                      Tell Execute what happened or what you want done
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all duration-300 flex-shrink-0" />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-left">
                  <span className="text-2xl">💰</span>
                  <span className="text-white/80 text-sm font-medium">Spent ₹5,000 on ads</span>
                </button>
                <button className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-left">
                  <span className="text-2xl">🤝</span>
                  <span className="text-white/80 text-sm font-medium">We signed Acme Corp</span>
                </button>
                <button className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-left">
                  <span className="text-2xl">📧</span>
                  <span className="text-white/80 text-sm font-medium">Send meeting reminder</span>
                </button>
              </div>
            </div>
          </Link>
        </div>

        {/* Workflow List Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Workflows</h2>
            <Link href="/dashboard/workflows">
              <Button variant="ghost" className="text-white/60 hover:text-white rounded-full">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
                <Clock className="h-8 w-8 text-white/20" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No workflows yet</h3>
              <p className="text-white/40 text-sm mb-4">Create your first workflow to get started</p>
              <Link href="/dashboard/workflows/new">
                <Button className="bg-white/10 hover:bg-white/15 text-white border-white/20 text-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Workflow
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.slice(0, 4).map((workflow: Workflow) => (
                <div
                  key={workflow.id}
                  className="group relative p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6 flex-1">
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {workflow.status === "active" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <Clock className="h-5 w-5 text-white/40" />
                        )}
                      </div>

                      {/* Workflow Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {workflow.name}
                        </h3>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 capitalize">
                            {workflow.triggerType}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-md border capitalize ${
                              workflow.status === "active"
                                ? "bg-green-500/10 border-green-500/30 text-green-400"
                                : "bg-white/5 border-white/10 text-white/40"
                            }`}
                          >
                            {workflow.status}
                          </span>
                          <span className="text-white/40">
                            {workflow.totalExecutions} execution{workflow.totalExecutions !== 1 ? 's' : ''}
                          </span>
                          <span className="text-white/40">
                            Created {formatTimeAgo(workflow.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <Link href={`/dashboard/workflows/${workflow.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/20 text-white hover:bg-white/5 hover:text-white rounded-full"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                      {workflow.triggerType === "manual" && workflow.status === "active" && (
                        <Button
                          size="sm"
                          className="bg-white/10 hover:bg-white/15 text-black border-white/20 rounded-full"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Run
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Executions Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Recent Executions</h2>
            <Link href="/dashboard/executions">
              <Button variant="ghost" className="text-white/60 hover:text-white rounded-full">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
            </div>
          ) : executions.length === 0 ? (
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-12 text-center">
              <Clock className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">No executions yet</p>
            </div>
          ) : (
            <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
              <div className="divide-y divide-white/10">
                {executions.map((execution: Execution) => (
                  <Link
                    key={execution.id}
                    href={`/dashboard/executions/${execution.id}`}
                    className="block hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="p-4 flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {getStatusIcon(execution.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/80 font-medium truncate">
                          {execution.workflow?.name || "Unknown Workflow"}
                        </p>
                        <p className="text-sm text-white/40">{formatTimeAgo(execution.startedAt)}</p>
                      </div>
                      <ArrowRight className="flex-shrink-0 h-4 w-4 text-white/30" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
