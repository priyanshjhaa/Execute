"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";

export default function ExecutionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white/60 hover:text-white mb-4 rounded-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Client Confirmation</h1>
              <p className="text-white/50">Execution • Failed • 2 min ago</p>
            </div>
            <Button
              variant="outline"
              size="lg"
              className="border-white/20 text-white hover:bg-white/5 rounded-full"
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              Retry
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-4">Execution Logs</h2>
          <p className="text-white/60">
            This page will show step-by-step execution logs, error messages, and retry options.
            Coming soon in the next phase of development.
          </p>
        </div>
      </div>
    </div>
  );
}
