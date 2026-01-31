"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, ArrowRight, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Execution {
  id: string;
  workflowId: string;
  status: "running" | "completed" | "failed" | "waiting";
  triggerType: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  workflow?: {
    id: string;
    name: string;
  };
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-400" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-pink-500/80" />;
    case "running":
      return <Clock className="h-5 w-5 text-blue-400 animate-pulse" />;
    case "waiting":
      return <Clock className="h-5 w-5 text-yellow-400" />;
    default:
      return <Clock className="h-5 w-5 text-white/40" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "text-green-400";
    case "failed":
      return "text-pink-400";
    case "running":
      return "text-blue-400";
    case "waiting":
      return "text-yellow-400";
    default:
      return "text-white/60";
  }
}

function formatDuration(duration?: number): string {
  if (!duration) return "-";
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(1)}s`;
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

type FilterType = "all" | "running" | "completed" | "failed";

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    fetchExecutions();
  // Refresh every 5 seconds if there are running executions
    const interval = setInterval(() => {
      if (executions.some(e => e.status === "running")) {
        fetchExecutions();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchExecutions = async () => {
    try {
      const response = await fetch("/api/executions");
      if (!response.ok) {
        // Handle 401 gracefully - user might need to sync
        if (response.status === 401) {
          setExecutions([]);
          return;
        }
        throw new Error("Failed to fetch executions");
      }
      const data = await response.json();
      setExecutions(data.executions || []);
    } catch (err) {
      console.error("Error fetching executions:", err);
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredExecutions = executions.filter(execution => {
    if (filter === "all") return true;
    return execution.status === filter;
  });

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Executions</h1>
              <p className="text-white/50">View all workflow execution history</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/5 rounded-full"
              onClick={fetchExecutions}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Loader2 className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <Filter className="h-4 w-4 text-white/50" />
          <div className="flex items-center gap-1">
            {(["all", "running", "completed", "failed"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm capitalize transition-colors ${
                  filter === f
                    ? "bg-white/10 text-white border border-white/20"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Executions List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-12 text-center">
            <Clock className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40">
              {filter === "all" ? "No executions yet" : `No ${filter} executions`}
            </p>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            <div className="divide-y divide-white/10">
              {filteredExecutions.map((execution) => (
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
                        {execution.workflow?.name || "Unknown Workflow"}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-white/40">
                        <span>{formatTimeAgo(execution.startedAt)}</span>
                        <span>•</span>
                        <span>{formatDuration(execution.duration)}</span>
                        <span>•</span>
                        <span className={getStatusColor(execution.status)}>
                          {execution.status}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{execution.triggerType}</span>
                      </div>
                      {execution.error && (
                        <p className="mt-2 text-sm text-pink-400/80 truncate max-w-lg">
                          {execution.error}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="flex-shrink-0 h-5 w-5 text-white/30" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
