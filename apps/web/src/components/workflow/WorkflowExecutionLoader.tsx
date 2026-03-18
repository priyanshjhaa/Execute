"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Zap, Clock } from "lucide-react";

interface ExecutionStep {
  stepId: string;
  stepName: string;
  stepType: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface WorkflowExecutionLoaderProps {
  executionId: string;
  workflowName: string;
  onComplete?: () => void;
}

export function WorkflowExecutionLoader({
  executionId,
  workflowName,
  onComplete,
}: WorkflowExecutionLoaderProps) {
  const router = useRouter();
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [status, setStatus] = useState<"running" | "completed" | "failed">("running");
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLLS = 120; // 2 minutes with 1-second polling

  // Poll execution status
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/executions/${executionId}`);
        if (!response.ok) throw new Error("Failed to fetch execution status");

        const data = await response.json();

        // Update steps
        if (data.execution.steps && data.execution.steps.length > 0) {
          setSteps(data.execution.steps);

          // Find current running step
          const runningStepIndex = data.execution.steps.findIndex(
            (s: ExecutionStep) => s.status === "running"
          );
          if (runningStepIndex !== -1) {
            setCurrentStepIndex(runningStepIndex);
          }

          // Check for failed step
          const failedStep = data.execution.steps.find(
            (s: ExecutionStep) => s.status === "failed"
          );
          if (failedStep) {
            setStatus("failed");
            setError(failedStep.error || "Step execution failed");
            clearInterval(pollInterval);
          }
        }

        // Check if execution is complete
        if (data.execution.status === "completed") {
          setStatus("completed");
          clearInterval(pollInterval);
          setTimeout(() => {
            if (onComplete) onComplete();
            else router.push(`/dashboard/executions/${executionId}`);
          }, 1500); // Show success state briefly before redirecting
        } else if (data.execution.status === "failed") {
          setStatus("failed");
          setError(data.execution.error || "Execution failed");
          clearInterval(pollInterval);
          setTimeout(() => {
            router.push(`/dashboard/executions/${executionId}`);
          }, 2000);
        }

        setPollCount((prev) => {
          if (prev >= MAX_POLLS) {
            clearInterval(pollInterval);
            router.push(`/dashboard/executions/${executionId}`);
          }
          return prev + 1;
        });
      } catch (err) {
        console.error("Error polling execution status:", err);
        clearInterval(pollInterval);
        setError("Failed to monitor execution status");
        setTimeout(() => {
          router.push(`/dashboard/executions/${executionId}`);
        }, 2000);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [executionId, router, onComplete]);

  function getStepIcon(type: string) {
    // Simplified icon mapping
    return <Zap className="h-5 w-5" />;
  }

  function getStepStatusColor(stepStatus: string) {
    switch (stepStatus) {
      case "completed":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "running":
        return "bg-sky-500/20 text-sky-400 border-sky-500/30";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-white/10 text-white/40 border-white/10";
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">Running Workflow</h1>
          <p className="text-white/50">{workflowName}</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Status Card */}
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-8 mb-8">
            <div className="flex items-center justify-center mb-6">
              {status === "running" && (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Loader2 className="h-16 w-16 text-sky-400 animate-spin" />
                    <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-sky-400/20 animate-ping" />
                  </div>
                </div>
              )}
              {status === "completed" && (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <CheckCircle2 className="h-16 w-16 text-green-400" />
                    <div className="absolute inset-0 h-16 w-16 rounded-full bg-green-400/20 animate-pulse" />
                  </div>
                </div>
              )}
              {status === "failed" && (
                <div className="flex items-center gap-4">
                  <Clock className="h-16 w-16 text-red-400" />
                </div>
              )}
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-semibold text-white mb-2">
                {status === "running" && "Executing workflow..."}
                {status === "completed" && "Workflow completed!"}
                {status === "failed" && "Workflow failed"}
              </h2>
              <p className="text-white/50">
                {status === "running" &&
                  (steps.length > 0
                    ? `Processing step ${currentStepIndex + 1} of ${steps.length}`
                    : "Initializing...")}
                {status === "completed" && "Redirecting to execution details..."}
                {status === "failed" && error}
              </p>
            </div>
          </div>

          {/* Steps Progress */}
          {steps.length > 0 && (
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Execution Progress
              </h3>
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={step.stepId}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${
                      step.status === "running"
                        ? "bg-sky-500/10 border-sky-500/30"
                        : step.status === "completed"
                          ? "bg-green-500/10 border-green-500/30"
                          : step.status === "failed"
                            ? "bg-red-500/10 border-red-500/30"
                            : "bg-white/5 border-white/10"
                    }`}
                  >
                    {/* Status Icon */}
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-lg border flex-shrink-0 ${getStepStatusColor(
                        step.status
                      )}`}
                    >
                      {step.status === "running" && (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      )}
                      {step.status === "completed" && (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                      {step.status === "failed" && <Clock className="h-5 w-5" />}
                      {step.status === "pending" && <Clock className="h-5 w-5" />}
                    </div>

                    {/* Step Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-medium">{step.stepName}</h4>
                        <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/50 border border-white/10 capitalize">
                          {step.stepType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 capitalize">
                        {step.status}
                      </p>
                    </div>

                    {/* Step Status Badge */}
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full border flex-shrink-0 ${getStepStatusColor(
                        step.status
                      )}`}
                    >
                      {step.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading State (when steps are not yet available) */}
          {steps.length === 0 && (
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-12 text-center">
              <Loader2 className="h-12 w-12 text-white/20 mx-auto mb-4 animate-spin" />
              <p className="text-white/40">Initializing workflow execution...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
