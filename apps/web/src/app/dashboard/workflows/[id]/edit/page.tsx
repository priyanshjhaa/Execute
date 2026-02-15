"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Play,
  Plus,
  Trash2,
  Loader2,
  Save,
  Webhook,
  Calendar,
  Mail,
  MessageSquare,
  Globe,
  GitBranch,
  Zap,
  Phone,
  ListChecks,
  Clock,
  UserPlus,
  ShoppingBag,
  X,
} from "lucide-react";

interface Step {
  id: string;
  type: string;
  name: string;
  description?: string;
  config: Record<string, any>;
  position: number;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
  status: string;
  webhookId?: string;
  scheduleExpression?: string;
  definition: {
    steps: Step[];
    triggerStepId: string;
  };
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

const STEP_TYPES = [
  { value: "webhook", label: "Webhook", icon: Webhook },
  { value: "schedule", label: "Schedule", icon: Calendar },
  { value: "send_email", label: "Send Email", icon: Mail },
  { value: "send_slack", label: "Send Slack", icon: MessageSquare },
  { value: "send_sms", label: "Send SMS", icon: Phone },
  { value: "http_request", label: "HTTP Request", icon: Globe },
  { value: "create_task", label: "Create Task", icon: ListChecks },
  { value: "delay", label: "Delay", icon: Clock },
  { value: "conditional", label: "Conditional", icon: GitBranch },
] as const;

export default function EditWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [triggerType, setTriggerType] = useState("webhook");
  const [steps, setSteps] = useState<Step[]>([]);
  const [triggerStepId, setTriggerStepId] = useState<string>("");
  const [showStepPicker, setShowStepPicker] = useState(false);

  const fetchWorkflow = useCallback(async () => {
    try {
      const response = await fetch(`/api/workflows/${params.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch workflow");
      }
      const data = await response.json();
      setWorkflow(data.workflow);
      setName(data.workflow.name || "");
      setDescription(data.workflow.description || "");
      setStatus(data.workflow.status || "draft");
      setTriggerType(data.workflow.triggerType || "webhook");
      setSteps(data.workflow.definition?.steps || []);
      setTriggerStepId(data.workflow.definition?.triggerStepId || "");
    } catch (err) {
      console.error("Error fetching workflow:", err);
      setError("Failed to fetch workflow");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  const generateStepId = () => {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const addStep = (type: string) => {
    const newStep: Step = {
      id: generateStepId(),
      type,
      name: STEP_TYPES.find((t) => t.value === type)?.label || type,
      description: "",
      config: {},
      position: steps.length,
    };
    const updatedSteps = [...steps, newStep];
    setSteps(updatedSteps);

    // If this is the first step, make it the trigger
    if (updatedSteps.length === 1) {
      setTriggerStepId(newStep.id);
    }

    setShowStepPicker(false);
  };

  const removeStep = (stepId: string) => {
    const updatedSteps = steps.filter((s) => s.id !== stepId);
    setSteps(updatedSteps);

    // If we removed the trigger, set a new one
    if (stepId === triggerStepId && updatedSteps.length > 0) {
      setTriggerStepId(updatedSteps[0].id);
    } else if (updatedSteps.length === 0) {
      setTriggerStepId("");
    }
  };

  const updateStep = (stepId: string, updates: Partial<Step>) => {
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)));
  };

  const setAsTrigger = (stepId: string) => {
    setTriggerStepId(stepId);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Workflow name is required");
      return;
    }

    if (steps.length === 0) {
      setError("Add at least one step");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflows/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          status,
          definition: {
            steps: steps.map((step, index) => ({ ...step, position: index })),
            triggerStepId,
            triggerType,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update workflow");
      }

      router.push(`/dashboard/workflows/${params.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (error && !workflow) {
    return (
      <div className="min-h-screen bg-black">
        <div className="container mx-auto px-8 py-8">
          <div className="max-w-2xl mx-auto text-center py-20">
            <p className="text-red-400 mb-8">{error}</p>
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

  const sortedSteps = [...steps].sort((a, b) => a.position - b.position);

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <Link href={`/dashboard/workflows/${params.id}`}>
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white mb-4 rounded-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workflow
            </Button>
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Edit Workflow</h1>
              <p className="text-white/50 mt-1">Modify your workflow configuration</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/workflows/${params.id}`}>
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5 rounded-full"
                >
                  Cancel
                </Button>
              </Link>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="btn-gradient text-black px-6 rounded-full"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Save className="mr-2 h-5 w-5" />
                )}
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        <div className="max-w-4xl">
          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Basic Information */}
          <div className="mb-6 bg-white/[0.02] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Workflow Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Welcome Email Sequence"
                  className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of what this workflow does..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 appearance-none"
                  >
                    <option value="draft" className="bg-black">Draft</option>
                    <option value="active" className="bg-black">Active</option>
                    <option value="archived" className="bg-black">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Trigger Type
                  </label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value)}
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 appearance-none"
                  >
                    <option value="webhook">Webhook</option>
                    <option value="schedule">Schedule</option>
                    <option value="email_received">Email Received</option>
                    <option value="form_submitted">Form Submitted</option>
                    <option value="user_created">User Created</option>
                    <option value="purchase_completed">Purchase Completed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Workflow Steps</h2>
              <span className="text-sm text-white/40">{steps.length} step{steps.length !== 1 ? "s" : ""}</span>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-lg">
                <Zap className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/40 mb-6">No steps added yet. Add your first step to get started.</p>
                <Button
                  onClick={() => setShowStepPicker(!showStepPicker)}
                  className="bg-white hover:bg-white/90 text-black"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Step
                </Button>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {sortedSteps.map((step, index) => {
                  const isTrigger = step.id === triggerStepId;
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
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium flex-shrink-0 ${
                            isTrigger
                              ? "bg-blue-500 text-white"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          {index + 1}
                        </div>

                        {/* Step Icon */}
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${
                            isTrigger
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          {getStepIcon(step.type)}
                        </div>

                        {/* Step Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              value={step.name}
                              onChange={(e) => updateStep(step.id, { name: e.target.value })}
                              className="bg-transparent text-white font-medium focus:outline-none flex-1"
                            />
                            {isTrigger && (
                              <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                Trigger
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/50 border border-white/10 capitalize">
                              {step.type.replace(/_/g, " ")}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={step.description || ""}
                            onChange={(e) => updateStep(step.id, { description: e.target.value })}
                            placeholder="Add a description..."
                            className="w-full bg-transparent text-sm text-white/50 focus:outline-none placeholder:text-white/30"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {!isTrigger && (
                            <button
                              onClick={() => setAsTrigger(step.id)}
                              className="p-2 rounded hover:bg-white/10 transition-colors"
                              title="Set as trigger"
                            >
                              <Zap className="h-4 w-4 text-white/40" />
                            </button>
                          )}
                          <button
                            onClick={() => removeStep(step.id)}
                            className="p-2 rounded hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-4 w-4 text-white/40" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Step Button */}
            {steps.length > 0 && (
              <div className="relative">
                <Button
                  size="sm"
                  className="bg-white hover:bg-white/90 text-black"
                  onClick={() => setShowStepPicker(!showStepPicker)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Step
                </Button>

                {showStepPicker && (
                  <div className="absolute z-10 w-64 mt-2 bg-white/[0.05] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    {STEP_TYPES.map((stepType) => {
                      const Icon = stepType.icon;
                      return (
                        <button
                          key={stepType.value}
                          onClick={() => addStep(stepType.value)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                        >
                          <Icon className="h-4 w-4 text-white/60" />
                          <span className="text-white">{stepType.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
