"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Plus,
  FileText,
  Copy,
  Check,
  Edit,
  Trash2,
  Loader2,
  ExternalLink,
  Power,
  PowerOff,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Form {
  id: string;
  name: string;
  description?: string;
  publicSlug: string;
  isActive: boolean;
  fieldCount: number;
  hasWorkflow: boolean;
  workflowId?: string;
  createdAt: string;
  updatedAt: string;
}

const queryKeys = {
  forms: ["forms"] as const,
};

export default function FormsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const { data: forms = [], isLoading } = useQuery({
    queryKey: queryKeys.forms,
    queryFn: async () => {
      const response = await fetch("/api/forms");
      if (!response.ok) {
        if (response.status === 401) return [];
        throw new Error("Failed to fetch forms");
      }
      const data = await response.json();
      return data.forms || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/forms/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete form");
      }
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(
        queryKeys.forms,
        forms.filter((f: Form) => f.id !== deletedId)
      );
      setShowDeleteConfirm(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/forms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!response.ok) {
        throw new Error("Failed to update form");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms });
    },
  });

  const handleCopySlug = (slug: string) => {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white mb-4 rounded-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Forms</h1>
              <p className="text-white/50 mt-1">
                Create hosted forms to collect data and trigger workflows
              </p>
            </div>

            <Button
              size="lg"
              className="text-base btn-gradient text-black px-6 py-5 rounded-full"
              onClick={() => router.push("/dashboard/forms/new")}
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Form
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
          </div>
        ) : forms.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-12 text-center">
            <FileText className="h-16 w-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No forms yet</h3>
            <p className="text-white/50 mb-6">
              Get started by creating your first hosted form.
            </p>
            <Button
              className="btn-gradient text-black rounded-full"
              onClick={() => router.push("/dashboard/forms/new")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Form
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {forms.map((form: Form) => (
              <div
                key={form.id}
                className="bg-white/[0.02] border border-white/10 rounded-xl p-6 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{form.name}</h3>
                      <p className="text-xs text-white/40">
                        {formatDate(form.createdAt)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      toggleActiveMutation.mutate({
                        id: form.id,
                        isActive: form.isActive,
                      })
                    }
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    disabled={toggleActiveMutation.isPending}
                  >
                    {form.isActive ? (
                      <Power className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <PowerOff className="h-4 w-4 text-white/30" />
                    )}
                  </button>
                </div>

                {form.description && (
                  <p className="text-sm text-white/60 mb-4 line-clamp-2">
                    {form.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-white/40 mb-4">
                  <span>{form.fieldCount} fields</span>
                  {form.hasWorkflow && (
                    <span className="text-emerald-400">• Linked workflow</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-white/20 text-white hover:bg-white/5"
                    onClick={() => handleCopySlug(form.publicSlug)}
                  >
                    {copiedSlug === form.publicSlug ? (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy Link
                      </>
                    )}
                  </Button>

                  <a
                    href={`/f/${form.publicSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-white/20 hover:bg-white/5 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 text-white/60" />
                  </a>

                  <Link href={`/dashboard/forms/${form.id}/edit`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-2 h-9 w-9 hover:bg-white/5"
                    >
                      <Edit className="h-3 w-3 text-white/60" />
                    </Button>
                  </Link>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-2 h-9 w-9 hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => setShowDeleteConfirm(form.id)}
                  >
                    <Trash2 className="h-3 w-3 text-white/60" />
                  </Button>
                </div>

                {!form.isActive && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-xs text-white/30">
                      This form is inactive and won't accept submissions.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Form?</h3>
            <p className="text-white/60 mb-6">
              This action cannot be undone. The form and all its submissions will be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => deleteMutation.mutate(showDeleteConfirm)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
