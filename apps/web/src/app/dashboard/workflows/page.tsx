"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Eye, Play, Plus, Loader2, Edit } from "lucide-react";
import { useWorkflows, type Workflow } from "@/lib/query/hooks";

function getStatusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-white/40" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-green-500/10 border-green-500/30 text-green-400";
    case "draft":
      return "bg-white/5 border-white/10 text-white/60";
    case "archived":
      return "bg-white/5 border-white/10 text-white/40";
    default:
      return "bg-white/5 border-white/10 text-white/40";
  }
}

function getTriggerBadgeLabel(triggerType: string) {
  switch (triggerType) {
    case "schedule":
      return "Scheduled";
    case "webhook":
      return "Webhook";
    case "manual":
      return "Manual";
    case "email_received":
      return "Email Trigger";
    case "form_submitted":
      return "Form Trigger";
    case "user_created":
      return "User Trigger";
    case "purchase_completed":
      return "Purchase Trigger";
    default:
      return triggerType.replace(/_/g, " ");
  }
}

function getTriggerHint(triggerType: string) {
  switch (triggerType) {
    case "schedule":
      return "Runs automatically on schedule";
    case "webhook":
    case "email_received":
    case "form_submitted":
    case "user_created":
    case "purchase_completed":
      return "Runs automatically when triggered";
    case "manual":
      return "Runs only when started manually";
    default:
      return "Trigger-based workflow";
  }
}

export default function WorkflowsPage() {
  const { data: workflows = [], isLoading: loading } = useWorkflows();

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Workflows</h1>
              <p className="text-white/50">Manage all your automation workflows</p>
            </div>
            <Link href="/dashboard/workflows/new">
              <Button
                size="lg"
                className="btn-gradient w-full rounded-full px-6 py-5 text-base text-black sm:w-auto"
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Workflow
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Workflow List */}
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-6">
              <Clock className="h-10 w-10 text-white/20" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No workflows yet</h3>
            <p className="text-white/40 mb-6">Create your first workflow to get started</p>
            <Link href="/dashboard/workflows/new">
              <Button className="bg-white/10 hover:bg-white/15 text-white border-white/20">
                <Plus className="mr-2 h-4 w-4" />
                Create Workflow
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((workflow: Workflow) => (
              <div
                key={workflow.id}
                className="group relative rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/20 sm:p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4 sm:gap-6 lg:flex-1">
                    {/* Status Icon */}
                    <div className="flex-shrink-0 pt-1">
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
                      {workflow.description && (
                        <p className="mb-2 text-sm text-white/40 sm:truncate">{workflow.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60 capitalize">
                          {getTriggerBadgeLabel(workflow.triggerType)}
                        </span>
                        <span className={`px-2 py-1 rounded-md border capitalize ${getStatusColor(workflow.status)}`}>
                          {workflow.status}
                        </span>
                        <span className="text-white/40">
                          {workflow.totalExecutions} execution{workflow.totalExecutions !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-white/35">
                        {getTriggerHint(workflow.triggerType)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/dashboard/workflows/${workflow.id}/edit`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-2 h-9 w-9 hover:bg-white/5"
                      >
                        <Edit className="h-3 w-3 text-white/60" />
                      </Button>
                    </Link>
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
