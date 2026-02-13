"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "number" | "textarea" | "select" | "checkbox";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface Form {
  name: string;
  description?: string;
  fields: FormField[];
}

export default function PublicFormPage() {
  const params = useParams();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Fetch form data
  useEffect(() => {
    async function loadForm() {
      try {
        const response = await fetch(`/api/forms/${params.slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Form not found");
          } else {
            setError("Failed to load form");
          }
          return;
        }
        const data = await response.json();
        setForm(data.form);
      } catch (err) {
        console.error("Error loading form:", err);
        setError("Failed to load form");
      }
    }

    loadForm();
  }, [params.slug]);

  const handleChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    setLoading(true);
    setError(null);

    // Validate required fields
    const errors: string[] = [];
    const payload: Record<string, string> = {};

    for (const field of form.fields) {
      const currentValue = payload[field.id] || "";
      if (field.required && !currentValue) {
        errors.push(`${field.label} is required`);
      }

      // Email validation
      if (field.type === "email" && currentValue) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(currentValue)) {
          errors.push(`${field.label} must be a valid email`);
        }
      }

      payload[field.id] = currentValue;
    }

    if (errors.length > 0) {
      setError(errors.join(", "));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/forms/${params.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Submission failed");
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      setError("Failed to submit form");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (error && !submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-red-400 hover:text-red-300 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Form Submitted!</h2>
            <p className="text-white/70 mb-6">
              Your form has been submitted successfully.
            </p>
            <button
              onClick={() => window.location.href = "https://execute.app"}
              className="bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-full px-6 py-2"
            >
              Go to Execute
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 text-center">
            <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Execute</h1>
            <p className="text-white/50 text-sm">Automated workflows</p>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {form?.description && (
            <p className="text-white/60 text-center mb-8">{form.description}</p>
          )}

          <h2 className="text-3xl font-bold text-white text-center mb-8">
            {form?.name || "Form"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {form?.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <label htmlFor={field.id} className="block text-sm font-medium text-white/80 mb-2">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>

                {field.type === "textarea" ? (
                  <textarea
                    id={field.id}
                    name={field.id}
                    placeholder={field.placeholder || ""}
                    className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 focus:border-white/40 focus:ring-1 focus:ring-white/20 text-white placeholder:text-white/30 min-h-[120px] resize-none"
                    required={field.required}
                  />
                ) : field.type === "select" ? (
                  <div className="relative">
                    <select
                      id={field.id}
                      name={field.id}
                      className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 focus:border-white/40 focus:ring-1 focus:ring-white/20 text-white appearance-none"
                      required={field.required}
                    >
                      <option value="">Select...</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input
                    id={field.id}
                    type={field.type}
                    name={field.id}
                    placeholder={field.placeholder || ""}
                    className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 focus:border-white/40 focus:ring-1 focus:ring-white/20 text-white placeholder:text-white/30"
                    required={field.required}
                  />
                )}
              </div>
            ))}

            <div className="flex items-center justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-gradient text-black font-semibold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Submitting..." : "Submit"}
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                <p className="text-red-400">{error}</p>
              </div>
            )}
          </form>

          <p className="text-center text-white/30 text-sm mt-8">
            Powered by{" "}
            <a href="https://execute.app" className="text-white/50 hover:text-white/70 underline">
              Execute
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
