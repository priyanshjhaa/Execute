"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuickCommandInput } from "@/components/quick-command-input";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Eye,
  Zap,
  Plus,
  History,
} from "lucide-react";

// Mock data
const mockWorkflows = [
  {
    id: "1",
    name: "Client Confirmation",
    triggerType: "manual" as const,
    status: "active" as const,
    lastRunStatus: "failed" as const,
    lastRunTime: "2 hours ago",
  },
  {
    id: "2",
    name: "Invoice Follow-up",
    triggerType: "manual" as const,
    status: "active" as const,
    lastRunStatus: "success" as const,
    lastRunTime: "1 hour ago",
  },
  {
    id: "3",
    name: "User Onboarding",
    triggerType: "form" as const,
    status: "draft" as const,
    lastRunStatus: "never" as const,
    lastRunTime: null,
  },
  {
    id: "4",
    name: "Daily Report Generation",
    triggerType: "manual" as const,
    status: "active" as const,
    lastRunStatus: "success" as const,
    lastRunTime: "5 hours ago",
  },
];

const mockExecutions = [
  {
    id: "1",
    workflowName: "Client Confirmation",
    status: "failed" as const,
    timeAgo: "2 min ago",
  },
  {
    id: "2",
    workflowName: "Invoice Follow-up",
    status: "success" as const,
    timeAgo: "1 hr ago",
  },
  {
    id: "3",
    workflowName: "Daily Report Generation",
    status: "success" as const,
    timeAgo: "5 hrs ago",
  },
];

function getStatusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-white/60" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-pink-500/80" />;
    case "running":
      return <Zap className="h-4 w-4 text-white/60 animate-pulse" />;
    default:
      return <Clock className="h-4 w-4 text-white/40" />;
  }
}

export default function DashboardPage() {
  const handleCommandExecuted = () => {
    // Could trigger a refresh of recent activities
    console.log('Command executed');
  };

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
        {/* Quick Command Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Quick Command</h2>
              <p className="text-white/50 text-sm">
                Tell Execute what happened or what you want done
              </p>
            </div>
            <Link href="/dashboard/quick-commands">
              <Button variant="ghost" className="text-white/60 hover:text-white rounded-full">
                <History className="mr-2 h-4 w-4" />
                View History
              </Button>
            </Link>
          </div>
          <QuickCommandInput onCommandExecuted={handleCommandExecuted} />
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

          <div className="space-y-3">
            {mockWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="group relative p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 flex-1">
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {workflow.lastRunStatus === "never" ? (
                        <Clock className="h-5 w-5 text-white/40" />
                      ) : (
                        getStatusIcon(workflow.lastRunStatus)
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
                              ? "bg-white/10 border-white/20 text-white/80"
                              : "bg-white/5 border-white/10 text-white/40"
                          }`}
                        >
                          {workflow.status}
                        </span>
                        {workflow.lastRunTime && (
                          <span className="text-white/40">
                            Last run: {workflow.lastRunTime}
                          </span>
                        )}
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

          <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            <div className="divide-y divide-white/10">
              {mockExecutions.map((execution) => (
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
                        {execution.workflowName}
                      </p>
                      <p className="text-sm text-white/40">{execution.timeAgo}</p>
                    </div>
                    <ArrowRight className="flex-shrink-0 h-4 w-4 text-white/30" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
