"use client";

import Link from "next/link";
import { CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";

// Mock data
const mockExecutions = [
  {
    id: "1",
    workflowName: "Client Confirmation",
    status: "failed" as const,
    timeAgo: "2 min ago",
    duration: "3.2s",
  },
  {
    id: "2",
    workflowName: "Invoice Follow-up",
    status: "success" as const,
    timeAgo: "1 hr ago",
    duration: "2.1s",
  },
  {
    id: "3",
    workflowName: "Daily Report Generation",
    status: "success" as const,
    timeAgo: "5 hrs ago",
    duration: "4.5s",
  },
  {
    id: "4",
    workflowName: "User Onboarding",
    status: "success" as const,
    timeAgo: "1 day ago",
    duration: "5.8s",
  },
  {
    id: "5",
    workflowName: "Client Confirmation",
    status: "failed" as const,
    timeAgo: "2 days ago",
    duration: "1.9s",
  },
];

function getStatusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-5 w-5 text-white/60" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-pink-500/80" />;
    case "running":
      return <Clock className="h-5 w-5 text-white/60" />;
    default:
      return <Clock className="h-5 w-5 text-white/40" />;
  }
}

export default function ExecutionsPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Executions</h1>
            <p className="text-white/50">View all workflow execution history</p>
          </div>
        </div>
      </div>

      {/* Executions List */}
      <div className="container mx-auto px-8 py-8">
        <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
          <div className="divide-y divide-white/10">
            {mockExecutions.map((execution) => (
              <Link
                key={execution.id}
                href={`/dashboard/executions/${execution.id}`}
                className="block hover:bg-white/[0.03] transition-colors"
              >
                <div className="p-6 flex items-center gap-6">
                  <div className="flex-shrink-0">
                    {getStatusIcon(execution.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 font-semibold text-lg">
                      {execution.workflowName}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-white/40">
                      <span>{execution.timeAgo}</span>
                      <span>•</span>
                      <span>{execution.duration}</span>
                      <span className="capitalize">{execution.status}</span>
                    </div>
                  </div>
                  <ArrowRight className="flex-shrink-0 h-5 w-5 text-white/30" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
