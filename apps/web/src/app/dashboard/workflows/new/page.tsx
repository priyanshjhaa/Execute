"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Wand2 } from "lucide-react";

export default function NewWorkflowPage() {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Call the workflow generation API
      const response = await fetch('/api/workflows/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instruction }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to generate workflow');
      }

      // TODO: Save workflow to database and redirect to edit page
      console.log('Generated workflow:', data.workflow);

      // For now, just redirect to workflows list
      router.push('/dashboard/workflows');
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
      setLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-white mb-2">
            Create New Workflow
          </h1>
          <p className="text-white/50">
            Describe what you want to automate in plain English, and we'll convert
            it into executable steps.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
          {/* Instruction Input */}
          <div>
            <label
              htmlFor="instruction"
              className="block text-sm font-medium text-white/80 mb-2"
            >
              What would you like to automate?
            </label>
            <textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Example: Send a welcome email to new users when they sign up with their name"
              className="w-full h-48 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-colors resize-none"
              required
              disabled={loading}
            />
            <p className="mt-2 text-sm text-white/40">
              Be specific about triggers (when it should run) and actions
              (what should happen).
            </p>
          </div>

          {/* Examples */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Example Instructions
            </h3>
            <ul className="space-y-3 text-white/70">
              <li className="flex items-start gap-2">
                <span className="text-white/40 mt-1">•</span>
                <span>
                  "Send a Slack message to #sales when a high-value lead fills
                  out the contact form"
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/40 mt-1">•</span>
                <span>
                  "Create a task in Asana when a user reports a bug, with the
                  bug details as task description"
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/40 mt-1">•</span>
                <span>
                  "Add user to Mailchimp newsletter list when they complete
                  purchase"
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/40 mt-1">•</span>
                <span>
                  "Send SMS alert to admin when server error rate exceeds 5%"
                </span>
              </li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            disabled={loading || !instruction.trim()}
            className="text-base btn-gradient px-8 py-6 rounded-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating Workflow...
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5 mr-2" />
                Generate Workflow
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
