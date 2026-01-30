"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Play,
  Edit,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Calendar,
  Webhook,
  Mail,
  MessageSquare,
  Globe,
  GitBranch,
  Zap,
  Phone,
  ListChecks,
  Pause,
  UserPlus,
  ShoppingBag,
} from "lucide-react";

interface Step {
  id: string;
  type: string;
  name: string;
  description?: string;
  config: Record<string, any>;
  position: number;
}

interface WorkflowDefinition {
  steps: Step[];
  triggerStepId: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig?: Record<string, any>;
  status: string;
  webhookId?: string;
  scheduleExpression?: string;
  totalExecutions: number;
  successRate: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
  definition: WorkflowDefinition;
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

function getStepIcon(type: string) {
  const iconProps = { className: "h-5 w-5" };
  switch (type) {
    case "webhook":
      return <Webhook {...iconProps} />;
    case "schedule":
      return <Calendar {...iconProps} />;
    case "send_email":
      return <Mail {...iconProps} />;
    case "send_slack":
      return <MessageSquare {...iconProps} />;
    case "send_sms":
      return <Phone {...iconProps} />;
    case "http_request":
      return <Globe {...iconProps} />;
    case "create_task":
      return <ListChecks {...iconProps} />;
    case "delay":
      return <Clock {...iconProps} />;
    case "conditional":
      return <GitBranch {...iconProps} />;
    case "email_received":
      return <Mail {...iconProps} />;
    case "form_submitted":
      return <ListChecks {...iconProps} />;
    case "user_created":
      return <UserPlus {...iconProps} />;
    case "purchase_completed":
      return <ShoppingBag {...iconProps} />;
    default:
      return <Zap {...iconProps} />;
  }
}

function formatStepConfig(type: string, config: Record<string, any>): string {
  switch (type) {
    case "send_email":
      return `To: ${config.to || "{{recipient}}"}, Subject: ${config.subject || "{{subject}}"}`;
    case "send_slack":
      return `Channel: ${config.channel || "{{channel}}"}${config.username ? `, Username: ${config.username}` : ""}`;
    case "send_sms":
      return `To: ${config.to || "{{phone}}"}, Body: ${config.body?.substring(0, 50) || "{{message}}"}${config.body?.length > 50 ? "..." : ""}`;
    case "http_request":
      return `${config.method || "GET"} ${config.url || "{{url}}"}`;
    case "delay":
      return `Wait ${config.duration || 1} ${config.unit || "seconds"}`;
    case "schedule":
      return `Schedule: ${config.cron_expression || config.expression || "Not configured"}`;
    case "webhook":
      return `Endpoint: ${config.endpoint || "/api/webhook/"}, Method: ${config.method || "POST"}`;
    case "create_task":
      return `Provider: ${config.provider || "{{provider}}"}, Title: ${config.title || "{{title}}"}`;
    case "conditional":
      return `Condition: ${config.condition || "{{condition}}"}`;
    default:
      return "";
  }
}

function formatDate(dateString?: string): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchWorkflow();
  }, [params.id]);

  const fetchWorkflow = async () => {
    try {
      const response = await fetch(`/api/workflows/${params.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Workflow not found");
        } else if (response.status === 403) {
          setError("You don't have access to this workflow");
        } else {
          setError("Failed to fetch workflow");
        }
        return;
      }
      const data = await response.json();
      setWorkflow(data.workflow);
    } catch (err) {
      console.error("Error fetching workflow:", err);
      setError("Failed to fetch workflow");
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    if (!workflow) return;
    setRunning(true);
    try {
      const response = await fetch(`/api/workflows/${workflow.id}/run`, {
        method: "POST",
      });
      if (response.ok) {
        // Refresh workflow data to update stats
        fetchWorkflow();
      }
    } catch (err) {
      console.error("Error running workflow:", err);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="min-h-screen bg-black">
        <div className="container mx-auto px-8 py-8">
          <div className="max-w-2xl mx-auto text-center py-20">
            <XCircle className="h-16 w-16 text-red-500/50 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-2">
              {error || "Workflow not found"}
            </h2>
            <p className="text-white/50 mb-8">
              {error === "Workflow not found"
                ? "The workflow you're looking for doesn't exist or has been deleted."
                : "Please check your permissions and try again."}
            </p>
            <Link href="/dashboard/workflows">
              <Button className="bg-white/10 hover:bg-white/15 text-white border-white/20">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Workflows
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Sort steps by position
  const sortedSteps = [...workflow.definition.steps].sort((a, b) => a.position - b.position);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <Link href="/dashboard/workflows">
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white mb-4 rounded-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workflows
            </Button>
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold text-white">
                  {workflow.name}
                </h1>
                <span className={`px-3 py-1 rounded-full text-sm border capitalize ${getStatusColor(workflow.status)}`}>
                  {workflow.status}
                </span>
              </div>
              {workflow.description && (
                <p className="text-white/50">{workflow.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-white/40">
                <span className="capitalize">{workflow.triggerType.replace("_", " ")} trigger</span>
                <span>•</span>
                <span>Created {formatDate(workflow.createdAt)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                className="border-white/20 text-white hover:bg-white/5 rounded-full"
                onClick={() => router.push(`/dashboard/workflows/${workflow.id}/edit`)}
              >
                <Edit className="mr-2 h-5 w-5" />
                Edit
              </Button>
              <Button
                size="lg"
                className="text-base btn-gradient text-black px-6 py-5 rounded-full"
                onClick={handleRun}
                disabled={running || workflow.status !== "active"}
              >
                {running ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Play className="mr-2 h-5 w-5" />
                )}
                {running ? "Running..." : "Run Now"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10">
                <Play className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-white/50">Total Executions</p>
                <p className="text-2xl font-semibold text-white">
                  {workflow.totalExecutions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-white/50">Success Rate</p>
                <p className="text-2xl font-semibold text-white">
                  {workflow.successRate}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5">
                <Clock className="h-5 w-5 text-white/60" />
              </div>
              <div>
                <p className="text-sm text-white/50">Last Executed</p>
                <p className="text-lg font-medium text-white">
                  {formatDate(workflow.lastExecutedAt)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Trigger Configuration */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Trigger Configuration
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-white/50 w-32">Type:</span>
              <span className="text-white capitalize">{workflow.triggerType.replace(/_/g, " ")}</span>
            </div>
            {workflow.webhookId && (
              <div className="flex items-center gap-2">
                <span className="text-white/50 w-32">Webhook ID:</span>
                <span className="text-white font-mono text-xs bg-white/5 px-2 py-1 rounded">
                  {workflow.webhookId}
                </span>
              </div>
            )}
            {workflow.scheduleExpression && (
              <div className="flex items-center gap-2">
                <span className="text-white/50 w-32">Schedule:</span>
                <span className="text-white font-mono text-xs bg-white/5 px-2 py-1 rounded">
                  {workflow.scheduleExpression}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Workflow Steps ({sortedSteps.length})
          </h2>

          {sortedSteps.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">No steps defined yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSteps.map((step, index) => {
                const isTrigger = step.id === workflow.definition.triggerStepId;
                return (
                  <div
                    key={step.id}
                    className={`p-4 rounded-lg border transition-all ${
                      isTrigger
                        ? "bg-blue-500/10 border-blue-500/30"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Position Indicator */}
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                        isTrigger
                          ? "bg-blue-500 text-white"
                          : "bg-white/10 text-white/60"
                      }`}>
                        {index + 1}
                      </div>

                      {/* Step Icon */}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                        isTrigger
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-white/10 text-white/60"
                      }`}>
                        {getStepIcon(step.type)}
                      </div>

                      {/* Step Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium">{step.name}</h3>
                          {isTrigger && (
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              Trigger
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/50 border border-white/10 capitalize">
                            {step.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        {step.description && (
                          <p className="text-sm text-white/50 mb-2">{step.description}</p>
                        )}
                        {Object.keys(step.config).length > 0 && (
                          <p className="text-sm text-white/40 font-mono bg-black/30 px-2 py-1 rounded max-w-lg truncate">
                            {formatStepConfig(step.type, step.config)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
