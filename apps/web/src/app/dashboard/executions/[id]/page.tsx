'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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
  }>;
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
      // Navigate to the new execution
      router.push(`/dashboard/executions/${data.executionId}`);
    } catch (error) {
      console.error('Error retrying execution:', error);
      setRetrying(false);
    }
  };

  useEffect(() => {
    fetchExecution();
  }, [executionId]);

  // Auto-refresh for running executions
  useEffect(() => {
    if (execution?.status === 'running' || execution?.status === 'pending') {
      const interval = setInterval(fetchExecution, 3000);
      return () => clearInterval(interval);
    }
  }, [execution?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading execution details...</div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Execution not found</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Execution Details</h1>
          <p className="text-sm text-gray-500 mt-1">ID: {execution.id}</p>
        </div>
        <div className="flex items-center gap-3">
          {execution.workflow && (
            <button
              onClick={() => router.push(`/dashboard/workflows/${execution.workflowId}`)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              View Workflow
            </button>
          )}
          {execution.status === 'failed' && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {retrying ? 'Retrying...' : 'Retry'}
            </button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <div className={`px-4 py-3 rounded-lg ${getStatusColor(execution.status)}`}>
        <div className="flex items-center gap-2">
          <span className="font-medium capitalize">{execution.status}</span>
          {(execution.status === 'running' || execution.status === 'pending') && (
            <span className="inline-block w-2 h-2 bg-current rounded-full animate-pulse" />
          )}
        </div>
      </div>

      {/* Execution Info */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Execution Information</h2>
        </div>
        <dl className="divide-y divide-gray-200">
          <div className="px-6 py-4 grid grid-cols-3 gap-4">
            <dt className="text-sm font-medium text-gray-500">Workflow</dt>
            <dd className="text-sm text-gray-900 col-span-2">
              {execution.workflow ? (
                <button
                  onClick={() => router.push(`/dashboard/workflows/${execution.workflowId}`)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {execution.workflow.name}
                </button>
              ) : (
                <span className="text-gray-400">Unknown</span>
              )}
            </dd>
          </div>
          <div className="px-6 py-4 grid grid-cols-3 gap-4">
            <dt className="text-sm font-medium text-gray-500">Trigger Type</dt>
            <dd className="text-sm text-gray-900 capitalize col-span-2">
              {execution.triggerType}
            </dd>
          </div>
          <div className="px-6 py-4 grid grid-cols-3 gap-4">
            <dt className="text-sm font-medium text-gray-500">Started At</dt>
            <dd className="text-sm text-gray-900 col-span-2">
              {formatDate(execution.startedAt)}
            </dd>
          </div>
          <div className="px-6 py-4 grid grid-cols-3 gap-4">
            <dt className="text-sm font-medium text-gray-500">Completed At</dt>
            <dd className="text-sm text-gray-900 col-span-2">
              {formatDate(execution.completedAt)}
            </dd>
          </div>
          <div className="px-6 py-4 grid grid-cols-3 gap-4">
            <dt className="text-sm font-medium text-gray-500">Duration</dt>
            <dd className="text-sm text-gray-900 col-span-2">
              {formatDuration(execution.duration)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Error Section */}
      {execution.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-red-900 mb-2">Error</h3>
          <pre className="text-sm text-red-800 whitespace-pre-wrap font-mono bg-red-100 p-3 rounded">
            {execution.error}
          </pre>
        </div>
      )}

      {/* Steps Section */}
      {execution.steps && execution.steps.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Steps</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {execution.steps.map((step, index) => (
              <div key={step.stepId} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{step.stepName}</p>
                      <p className="text-xs text-gray-500 capitalize">{step.stepType.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(step.status)}`}>
                    {step.status}
                  </span>
                </div>
                {step.error && (
                  <p className="mt-2 text-xs text-red-600 ml-9">{step.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500">
            Step-by-step execution logs will be available here soon.
          </p>
        </div>
      )}

      {/* Raw Data */}
      <details className="bg-gray-50 rounded-lg border border-gray-200">
        <summary className="px-6 py-4 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-100">
          Raw Execution Data
        </summary>
        <pre className="px-6 py-4 text-xs text-gray-600 overflow-x-auto bg-gray-100 m-0 rounded-b-lg">
          {JSON.stringify(execution, null, 2)}
        </pre>
      </details>
    </div>
  );
}
