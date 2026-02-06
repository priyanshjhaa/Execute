"use client";

import { useEffect, useState } from "react";

export interface Integration {
  id: string;
  userId: string;
  type: string;
  name: string;
  config?: Record<string, any>;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/integrations');
      if (!response.ok) {
        throw new Error('Failed to fetch integrations');
      }
      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (err: any) {
      setError(err.message);
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  // Helper to check if a specific integration type is connected
  const hasIntegration = (type: string) => {
    return integrations.some(i => i.type === type && i.isActive);
  };

  // Get integrations by type
  const getIntegrationsByType = (type: string) => {
    return integrations.filter(i => i.type === type && i.isActive);
  };

  // Get a single integration by type
  const getIntegrationByType = (type: string) => {
    return integrations.find(i => i.type === type && i.isActive);
  };

  return {
    integrations,
    loading,
    error,
    refetch: fetchIntegrations,
    hasIntegration,
    getIntegrationsByType,
    getIntegrationByType,
  };
}
