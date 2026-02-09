'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Globe,
  GitBranch,
  Zap,
  Phone,
  ListChecks,
  Calendar,
} from 'lucide-react';

interface Execution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  triggerType: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
  workflow: {
    id: string;
    name: string;
  } | null;
  steps?: Array<{
    stepId: string;
    stepName: string;
    stepType: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt: string;
    completedAt: string | null;
    error: string | null;
    data?: any;
    output?: any;
  }>;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-green-500/10 border-green-500/30 text-green-400';
    case 'failed':
      return 'bg-red-500/10 border-red-500/30 text-red-400';
    case 'running':
      return 'bg-sky-500/10 border-sky-500/30 text-sky-400';
    case 'pending':
      return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    default:
      return 'bg-white/5 border-white/10 text-white/60';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-400" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-400" />;
    case 'running':
      return <Loader2 className="h-5 w-5 text-sky-400 animate-spin" />;
    case 'pending':
      return <Clock className="h-5 w-5 text-yellow-400" />;
    default:
      return <Clock className="h-5 w-5 text-white/60" />;
  }
}

function getStepIcon(type: string) {
  const iconProps = { className: 'h-5 w-5' };
  switch (type) {
    case 'webhook':
      return <Globe {...iconProps} />;
    case 'schedule':
      return <Calendar {...iconProps} />;
    case 'send_email':
      return <Mail {...iconProps} />;
    case 'send_slack':
      return <MessageSquare {...iconProps} />;
    case 'send_sms':
      return <Phone {...iconProps} />;
    case 'http_request':
      return <Globe {...iconProps} />;
    case 'create_task':
      return <ListChecks {...iconProps} />;
    case 'delay':
      return <Clock {...iconProps} />;
    case 'conditional':
      return <GitBranch {...iconProps} />;
    default:
      return <Zap {...iconProps} />;
  }
}

function formatDuration(ms: number | null) {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

export default function ExecutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const executionId = params.id as string;

  const [execution, setExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const fetchExecution = async () => {
    try {
      const response = await fetch(`/api/executions/${executionId}`);
      if (!response.ok) {
        if (response.status === 404 || response.status === 400) {
          router.push('/dashboard/executions');
          return;
        }
        throw new Error('Failed to fetch execution');
      }
      const data = await response.json();
      setExecution(data.execution);
    } catch (error) {
      console.error('Error fetching execution:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!execution?.workflowId) return;
    setRetrying(true);
    try {
      const response = await fetch(`/api/workflows/${execution.workflowId}/run`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to retry execution');
      const data = await response.json();
      router.push(`/dashboard/executions/${data.executionId}`);
    } catch (error) {
      console.error('Error retrying execution:', error);
      setRetrying(false);
    }
  };

  useEffect(() => {
    fetchExecution();
  }, [executionId]);

  useEffect(() => {
    if (execution?.status === 'running' || execution?.status === 'pending') {
      const interval = setInterval(fetchExecution, 3000);
      return () => clearInterval(interval);
    }
  }, [execution?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/40">Execution not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-black">
        <div className="container mx-auto px-8 py-8">
          <Link href="/dashboard/executions">
            <Button
              variant="ghost"
              className="text-white/60 hover:text-white mb-4 rounded-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Executions
            </Button>
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold text-white">Execution Details</h1>
                <span className={`px-3 py-1 rounded-full text-sm border capitalize flex items-center gap-2 ${getStatusColor(execution.status)}`}>
                  {getStatusIcon(execution.status)}
                  {execution.status}
                </span>
              </div>
              <p className="text-white/50 text-sm">ID: {execution.id}</p>
            </div>

            <div className="flex items-center gap-3">
              {execution.workflow && (
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/20 text-white hover:bg-white/5 rounded-full"
                  onClick={() => router.push(`/dashboard/workflows/${execution.workflowId}`)}
                >
                  View Workflow
                </Button>
              )}
              {execution.status === 'failed' && (
                <Button
                  size="lg"
                  className="text-base btn-gradient text-black px-6 py-5 rounded-full"
                  onClick={handleRetry}
                  disabled={retrying}
                >
                  {retrying ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                  )}
                  {retrying ? 'Retrying...' : 'Retry'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-8 py-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5">
                <Mail className="h-5 w-5 text-white/60" />
              </div>
              <div>
                <p className="text-sm text-white/50">Trigger</p>
                <p className="text-lg font-medium text-white capitalize">
                  {execution.triggerType.replace('_', ' ')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5">
                <Clock className="h-5 w-5 text-white/60" />
              </div>
              <div>
                <p className="text-sm text-white/50">Duration</p>
                <p className="text-lg font-medium text-white">
                  {formatDuration(execution.duration)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5">
                <Calendar className="h-5 w-5 text-white/60" />
              </div>
              <div>
                <p className="text-sm text-white/50">Started</p>
                <p className="text-lg font-medium text-white">
                  {new Date(execution.startedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5">
                <Zap className="h-5 w-5 text-white/60" />
              </div>
              <div>
                <p className="text-sm text-white/50">Steps</p>
                <p className="text-lg font-medium text-white">
                  {execution.steps?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Info */}
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Workflow</h2>
          <div className="flex items-center justify-between">
            <div>
              {execution.workflow ? (
                <button
                  onClick={() => router.push(`/dashboard/workflows/${execution.workflowId}`)}
                  className="text-lg text-white hover:text-sky-400 transition-colors"
                >
                  {execution.workflow.name}
                </button>
              ) : (
                <span className="text-white/40">Unknown workflow</span>
              )}
            </div>
            <div className="text-sm text-white/50">
              {formatDate(execution.startedAt)} - {formatDate(execution.completedAt)}
            </div>
          </div>
        </div>

        {/* Error Section */}
        {execution.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-400 mb-2">Error</h3>
                <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono bg-black/30 p-4 rounded-lg">
                  {execution.error}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Steps Section */}
        {execution.steps && execution.steps.length > 0 ? (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                Execution Steps ({execution.steps.length})
              </h2>
            </div>
            <div className="divide-y divide-white/10">
              {execution.steps.map((step, index) => (
                <div key={step.stepId} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {/* Position Indicator */}
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium flex-shrink-0 ${
                        step.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : step.status === 'failed'
                            ? 'bg-red-500/20 text-red-400'
                            : step.status === 'running'
                              ? 'bg-sky-500/20 text-sky-400'
                              : 'bg-white/10 text-white/60'
                      }`}>
                        {index + 1}
                      </div>

                      {/* Step Icon */}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${
                        step.status === 'completed'
                          ? 'bg-green-500/10 text-green-400'
                          : step.status === 'failed'
                            ? 'bg-red-500/10 text-red-400'
                            : step.status === 'running'
                              ? 'bg-sky-500/10 text-sky-400'
                              : 'bg-white/10 text-white/60'
                      }`}>
                        {getStepIcon(step.stepType)}
                      </div>

                      {/* Step Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium">{step.stepName}</h3>
                          <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/50 border border-white/10 capitalize">
                            {step.stepType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-white/50">
                          <span>Started: {new Date(step.startedAt).toLocaleTimeString()}</span>
                          {step.completedAt && (
                            <span>Completed: {new Date(step.completedAt).toLocaleTimeString()}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border flex-shrink-0 ${getStatusColor(step.status)}`}>
                      {step.status}
                    </span>
                  </div>

                  {/* Step Error */}
                  {step.error && (
                    <div className="mt-3 ml-12 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-sm text-red-400">{step.error}</p>
                    </div>
                  )}

                  {/* Step Output (for completed steps with data) */}
                  {step.status === 'completed' && step.data && (
                    <div className="mt-3 ml-12 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-xs text-green-400 mb-2 font-medium">Output:</p>
                      <pre className="text-xs text-green-300 whitespace-pre-wrap font-mono bg-black/30 p-3 rounded overflow-x-auto">
                        {typeof step.data === 'object'
                          ? JSON.stringify(step.data, null, 2)
                          : String(step.data)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl p-12 text-center">
            <Clock className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40">
              Step-by-step execution logs will be available here soon.
            </p>
          </div>
        )}

        {/* Raw Data */}
        <details className="bg-white/[0.02] border border-white/10 rounded-xl">
          <summary className="px-6 py-4 cursor-pointer text-sm font-medium text-white/70 hover:bg-white/[0.02] rounded-t-xl">
            Raw Execution Data
          </summary>
          <pre className="px-6 py-4 text-xs text-white/60 overflow-x-auto bg-black/50 m-0 rounded-b-xl border-t border-white/10">
            {JSON.stringify(execution, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
