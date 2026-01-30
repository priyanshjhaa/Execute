"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Save,
  XCircle,
  CheckCircle2,
  Trash2,
  Plus,
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
  status: string;
  definition: WorkflowDefinition;
}

const STEP_TYPES = [
  { value: "webhook", label: "Webhook", group: "trigger" },
  { value: "schedule", label: "Schedule", group: "trigger" },
  { value: "email_received", label: "Email Received", group: "trigger" },
  { value: "form_submitted", label: "Form Submitted", group: "trigger" },
  { value: "user_created", label: "User Created", group: "trigger" },
  { value: "purchase_completed", label: "Purchase Completed", group: "trigger" },
  { value: "send_email", label: "Send Email", group: "action" },
  { value: "send_slack", label: "Send Slack", group: "action" },
  { value: "send_sms", label: "Send SMS", group: "action" },
  { value: "http_request", label: "HTTP Request", group: "action" },
  { value: "create_task", label: "Create Task", group: "action" },
  { value: "add_to_list", label: "Add to List", group: "action" },
  { value: "delay", label: "Delay", group: "action" },
  { value: "conditional", label: "Conditional", group: "action" },
];

export default function EditWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [steps, setSteps] = useState<Step[]>([]);
  const [triggerStepId, setTriggerStepId] = useState("");

  useEffect(() => {
    fetchWorkflow();
  }, [params.id]);

  const fetchWorkflow = async () => {
    try {
      const response = await fetch(`/api/workflows/${params.id}`);
      if (!response.ok) {
        setError("Failed to fetch workflow");
        return;
      }
      const data = await response.json();
      setWorkflow(data.workflow);
      setName(data.workflow.name);
      setDescription(data.workflow.description || "");
      setStatus(data.workflow.status);
      setSteps(data.workflow.definition.steps || []);
      setTriggerStepId(data.workflow.definition.triggerStepId);
    } catch (err) {
      console.error("Error fetching workflow:", err);
      setError("Failed to fetch workflow");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/workflows/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          status,
          definition: {
            steps: steps.map((step, index) => ({ ...step, position: index })),
            triggerStepId,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save workflow");
      }

      setSuccessMessage("Workflow saved successfully!");
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addStep = () => {
    const newStep: Step = {
      id: crypto.randomUUID(),
      type: "send_email",
      name: "New Step",
      description: "",
      config: {},
      position: steps.length,
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (index: number, field: keyof Step, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const updateStepConfig = (index: number, key: string, value: any) => {
    const updated = [...steps];
    updated[index] = {
      ...updated[index],
      config: { ...updated[index].config, [key]: value },
    };
    setSteps(updated);
  };

  const removeStep = (index: number) => {
    const updated = steps.filter((_, i) => i !== index);
    setSteps(updated);
    if (steps[index].id === triggerStepId) {
      setTriggerStepId("");
    }
  };

  const setAsTrigger = (stepId: string) => {
    setTriggerStepId(stepId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
      </div>
    );
  }

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

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">
                Edit Workflow
              </h1>
              <p className="text-white/50">
                Make changes to your workflow configuration
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5 rounded-full"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                className="btn-gradient text-black px-6 py-5 rounded-full"
                onClick={handleSave}
                disabled={saving}
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
      <div className="container mx-auto px-8 py-8 max-w-4xl">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <p className="text-green-400">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Workflow Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                placeholder="My Workflow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
                rows={3}
                placeholder="Describe what this workflow does..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Workflow Steps ({steps.length})
            </h2>
            <Button
              size="sm"
              className="bg-white/10 hover:bg-white/15 text-white border-white/20"
              onClick={addStep}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Step
            </Button>
          </div>

          {steps.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/40 mb-4">No steps defined yet</p>
              <Button
                className="bg-white/10 hover:bg-white/15 text-white border-white/20"
                onClick={addStep}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add First Step
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="p-4 rounded-lg border border-white/10 bg-white/[0.02] relative"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white/60 text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        {step.id === triggerStepId && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 mb-1">
                            Trigger
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {step.type !== "webhook" && step.type !== "schedule" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`text-xs ${
                            step.id === triggerStepId
                              ? "bg-blue-500/20 text-blue-400"
                              : "text-white/50 hover:text-white"
                          }`}
                          onClick={() => setAsTrigger(step.id)}
                        >
                          {step.id === triggerStepId ? "✓ Trigger" : "Set as Trigger"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => removeStep(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1">
                          Step Type
                        </label>
                        <select
                          value={step.type}
                          onChange={(e) => updateStep(index, "type", e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/20"
                        >
                          <optgroup label="Triggers">
                            {STEP_TYPES.filter((t) => t.group === "trigger").map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Actions">
                            {STEP_TYPES.filter((t) => t.group === "action").map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1">
                          Step Name
                        </label>
                        <input
                          type="text"
                          value={step.name}
                          onChange={(e) => updateStep(index, "name", e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/20"
                          placeholder="Step name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={step.description || ""}
                        onChange={(e) => updateStep(index, "description", e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/20"
                        placeholder="What this step does..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-2">
                        Configuration (JSON)
                      </label>
                      <textarea
                        value={JSON.stringify(step.config, null, 2)}
                        onChange={(e) => {
                          try {
                            const config = JSON.parse(e.target.value);
                            updateStep(index, "config", config);
                          } catch {
                            // Invalid JSON, don't update
                          }
                        }}
                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white/80 text-xs font-mono focus:outline-none focus:border-white/20 resize-none"
                        rows={4}
                        placeholder='{"key": "value"}'
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
