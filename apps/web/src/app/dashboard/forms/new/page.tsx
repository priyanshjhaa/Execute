"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Type,
  Mail,
  Hash,
  AlignLeft,
  List,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  Zap,
} from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  triggerType: string;
  status: string;
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "number" | "textarea" | "select" | "checkbox";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

const FIELD_TYPES = [
  { value: "text", label: "Short Text", icon: Type },
  { value: "email", label: "Email", icon: Mail },
  { value: "number", label: "Number", icon: Hash },
  { value: "textarea", label: "Long Text", icon: AlignLeft },
  { value: "select", label: "Dropdown", icon: List },
] as const;

export default function NewFormPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);

  // Fetch workflows on mount
  useEffect(() => {
    async function fetchWorkflows() {
      try {
        const response = await fetch("/api/workflows");
        if (response.ok) {
          const data = await response.json();
          setWorkflows(data.workflows || []);
        }
      } catch (err) {
        console.error("Error fetching workflows:", err);
      } finally {
        setLoadingWorkflows(false);
      }
    }
    fetchWorkflows();
  }, []);

  const generateFieldId = () => {
    return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleAddField = (type: FormField["type"]) => {
    const newField: FormField = {
      id: generateFieldId(),
      label: "",
      type,
      required: false,
      placeholder: "",
      options: type === "select" ? ["Option 1", "Option 2"] : undefined,
    };
    setFields([...fields, newField]);
    setShowFieldPicker(false);
  };

  const handleRemoveField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
  };

  const handleUpdateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields(
      fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f))
    );
  };

  const handleAddOption = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field && field.options) {
      handleUpdateField(fieldId, {
        options: [...field.options, `Option ${field.options.length + 1}`],
      });
    }
  };

  const handleRemoveOption = (fieldId: string, optionIndex: number) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field && field.options) {
      handleUpdateField(fieldId, {
        options: field.options.filter((_, i) => i !== optionIndex),
      });
    }
  };

  const handleUpdateOption = (fieldId: string, optionIndex: number, value: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field && field.options) {
      const newOptions = [...field.options];
      newOptions[optionIndex] = value;
      handleUpdateField(fieldId, { options: newOptions });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      setError("Form name is required");
      return;
    }

    if (fields.length === 0) {
      setError("Add at least one field");
      return;
    }

    const invalidField = fields.find((f) => !f.label.trim());
    if (invalidField) {
      setError("All fields must have a label");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          fields,
          workflowId: selectedWorkflowId || null,
          isActive: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create form");
      }

      router.push("/dashboard/forms");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFieldIcon = (type: FormField["type"]) => {
    const fieldConfig = FIELD_TYPES.find((t) => t.value === type);
    if (!fieldConfig) return null;
    const Icon = fieldConfig.icon;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <Link href="/dashboard/forms">
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white mb-4 rounded-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Forms
            </Button>
          </Link>

          <h1 className="text-3xl font-bold text-white">Create New Form</h1>
          <p className="text-white/50 mt-1">
            Build a hosted form to collect submissions and trigger workflows
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Form Details */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Form Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Form Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contact Form"
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="A brief description of what this form is for..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Linked Workflow (Optional)
                  </label>
                  {loadingWorkflows ? (
                    <div className="flex items-center gap-2 text-white/40 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading workflows...
                    </div>
                  ) : workflows.length === 0 ? (
                    <p className="text-white/40 text-sm">No workflows available. Create a workflow first.</p>
                  ) : (
                    <select
                      value={selectedWorkflowId}
                      onChange={(e) => setSelectedWorkflowId(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 rounded-lg text-white focus:outline-none focus:border-white/20 appearance-none"
                    >
                      <option value="" className="bg-black">Select a workflow to trigger...</option>
                      {workflows.map((wf) => (
                        <option key={wf.id} value={wf.id} className="bg-black">
                          {wf.name} ({wf.triggerType})
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedWorkflowId && (
                    <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Form submissions will trigger this workflow
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Fields
                </h2>
                <span className="text-sm text-white/40">
                  {fields.length} field{fields.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-4">
                {fields.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-lg">
                    <FileText className="h-8 w-8 text-white/20 mx-auto mb-2" />
                    <p className="text-white/40 text-sm">No fields added yet</p>
                  </div>
                ) : (
                  fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="bg-white/[0.02] border border-white/10 rounded-lg p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getFieldIcon(field.type)}
                          <span className="text-sm text-white/60 capitalize">
                            {field.type}
                          </span>
                          <span className="text-white/30">•</span>
                          <span className="text-sm font-mono text-white/30">
                            {field.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(field.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-white/40" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                          Label <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) =>
                            handleUpdateField(field.id, { label: e.target.value })
                          }
                          placeholder="Field Label"
                          className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                          Placeholder
                        </label>
                        <input
                          type="text"
                          value={field.placeholder || ""}
                          onChange={(e) =>
                            handleUpdateField(field.id, {
                              placeholder: e.target.value,
                            })
                          }
                          placeholder="Enter placeholder text..."
                          className="w-full px-4 py-2.5 bg-white/[0.02] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                        />
                      </div>

                      {field.type === "select" && (
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">
                            Options
                          </label>
                          <div className="space-y-2">
                            {field.options?.map((option, optIndex) => (
                              <div
                                key={optIndex}
                                className="flex items-center gap-2"
                              >
                                <span className="text-white/30 text-sm">
                                  {optIndex + 1}.
                                </span>
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) =>
                                    handleUpdateOption(
                                      field.id,
                                      optIndex,
                                      e.target.value
                                    )
                                  }
                                  className="flex-1 px-3 py-2 bg-white/[0.02] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/20"
                                />
                                {field.options && field.options.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveOption(field.id, optIndex)
                                    }
                                    className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3 text-white/40" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleAddOption(field.id)}
                              className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
                            >
                                <Plus className="h-3 w-3" />
                                Add Option
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`required-${field.id}`}
                          checked={field.required}
                          onChange={(e) =>
                            handleUpdateField(field.id, {
                              required: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-white/20 bg-white/5 focus:ring-emerald-500 focus:ring-offset-0"
                        />
                        <label
                          htmlFor={`required-${field.id}`}
                          className="text-sm text-white/70 cursor-pointer"
                        >
                          Required field
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Field Button */}
              <div className="relative mt-4">
                <button
                  type="button"
                  onClick={() => setShowFieldPicker(!showFieldPicker)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-white/20 rounded-lg text-white/60 hover:text-white hover:border-white/40 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Field
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showFieldPicker ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showFieldPicker && (
                  <div className="absolute z-10 w-full mt-2 bg-white/[0.05] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    {FIELD_TYPES.map((fieldType) => {
                      const Icon = fieldType.icon;
                      return (
                        <button
                          key={fieldType.value}
                          type="button"
                          onClick={() => handleAddField(fieldType.value)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                        >
                          <Icon className="h-4 w-4 text-white/60" />
                          <span className="text-white">{fieldType.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
              <Link href="/dashboard/forms">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5"
                  disabled={loading}
                >
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                className="btn-gradient text-black px-8"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Create Form
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
