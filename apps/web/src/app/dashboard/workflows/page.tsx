"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Eye, Play, Plus } from "lucide-react";

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

function getStatusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-white/60" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-pink-500/80" />;
    case "running":
      return <Clock className="h-4 w-4 text-white/60" />;
    default:
      return <Clock className="h-4 w-4 text-white/40" />;
  }
}

export default function WorkflowsPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Workflows</h1>
              <p className="text-white/50">Manage all your automation workflows</p>
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

      {/* Workflow List */}
      <div className="container mx-auto px-8 py-8">
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
    </div>
  );
}
