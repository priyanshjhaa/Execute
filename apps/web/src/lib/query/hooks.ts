/**
 * TanStack Query Hooks for API Requests
 *
 * Reusable hooks with built-in caching.
 * Data persists across navigation - no loading states when switching pages.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============================================
// TYPES
// ============================================

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
  status: string;
  totalExecutions: number;
  successRate: number;
  createdAt: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  status: "running" | "completed" | "failed" | "waiting";
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  workflow?: {
    id: string;
    name: string;
  };
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
  department?: string;
  tags?: string[];
  createdAt: string;
}

export interface Form {
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

// ============================================
// QUERY KEYS
// ============================================

export const queryKeys = {
  workflows: ["workflows"] as const,
  executions: ["executions"] as const,
  contacts: ["contacts"] as const,
  forms: ["forms"] as const,
  workflow: (id: string) => ["workflows", id] as const,
  execution: (id: string) => ["executions", id] as const,
};

// ============================================
// WORKFLOWS
// ============================================

/**
 * Fetch all workflows with caching
 * Data persists for 5 minutes across navigation
 */
export function useWorkflows() {
  return useQuery({
    queryKey: queryKeys.workflows,
    queryFn: async () => {
      const response = await fetch("/api/workflows");
      if (!response.ok) {
        if (response.status === 401) {
          return [];
        }
        throw new Error("Failed to fetch workflows");
      }
      const data = await response.json();
      return data.workflows || [];
    },
  });
}

/**
 * Fetch a single workflow by ID
 */
export function useWorkflow(id: string) {
  return useQuery({
    queryKey: queryKeys.workflow(id),
    queryFn: async () => {
      const response = await fetch(`/api/workflows/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch workflow");
      }
      return response.json();
    },
    enabled: !!id,
  });
}

// ============================================
// EXECUTIONS
// ============================================

/**
 * Fetch executions with optional limit
 * Data persists for 5 minutes across navigation
 */
export function useExecutions(limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.executions, limit],
    queryFn: async () => {
      const url = limit ? `/api/executions?limit=${limit}` : "/api/executions";
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 401) {
          return [];
        }
        throw new Error("Failed to fetch executions");
      }
      const data = await response.json();
      return data.executions || [];
    },
  });
}

/**
 * Fetch a single execution by ID
 */
export function useExecution(id: string) {
  const query = useQuery<Execution>({
    queryKey: queryKeys.execution(id),
    queryFn: async () => {
      const response = await fetch(`/api/executions/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch execution");
      }
      const json = await response.json();
      return json.execution || json;
    },
    enabled: !!id,
  });

  // Refetch running executions every 5 seconds
  // Using useEffect instead of refetchInterval for better type safety
  // The executions page already handles this with its own interval

  return query;
}

// ============================================
// CONTACTS
// ============================================

/**
 * Fetch all contacts with caching
 */
export function useContacts() {
  return useQuery({
    queryKey: queryKeys.contacts,
    queryFn: async () => {
      const response = await fetch("/api/contacts");
      if (!response.ok) {
        if (response.status === 401) {
          return [];
        }
        throw new Error("Failed to fetch contacts");
      }
      const data = await response.json();
      return data.contacts || [];
    },
  });
}

// ============================================
// FORMS
// ============================================

/**
 * Fetch all forms with caching
 */
export function useForms() {
  return useQuery({
    queryKey: queryKeys.forms,
    queryFn: async () => {
      const response = await fetch("/api/forms");
      if (!response.ok) {
        if (response.status === 401) {
          return [];
        }
        throw new Error("Failed to fetch forms");
      }
      const data = await response.json();
      return data.forms || [];
    },
  });
}

// ============================================
// UTILITIES
// ============================================

/**
 * Format a date string as "X time ago"
 */
export function formatTimeAgo(dateString: string): string {
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

// ============================================
// MUTATIONS (with cache invalidation)
// ============================================

/**
 * Run a workflow and invalidate relevant caches
 */
export function useRunWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workflowId: string) => {
      const response = await fetch(`/api/workflows/${workflowId}/run`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to run workflow");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate executions cache to show new execution
      queryClient.invalidateQueries({ queryKey: queryKeys.executions });
      // Update workflow execution count
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
    },
  });
}

/**
 * Invalidate and refetch all dashboard data
 */
export function useRefreshDashboard() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workflows });
    queryClient.invalidateQueries({ queryKey: queryKeys.executions });
    queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
  };
}
