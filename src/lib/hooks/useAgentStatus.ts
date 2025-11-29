'use client';

import { useState, useEffect, useCallback } from 'react';
import { GetAgentStatusResponse } from '@/lib/types/agents';

interface UseAgentStatusOptions {
  agentId: string;
  enabled?: boolean;
  pollInterval?: number; // milliseconds
}

interface UseAgentStatusReturn {
  status: GetAgentStatusResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAgentStatus(options: UseAgentStatusOptions): UseAgentStatusReturn {
  const { agentId, enabled = true, pollInterval } = options;
  const [status, setStatus] = useState<GetAgentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!enabled || !agentId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agents/${agentId}/status`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch agent status');
      }

      setStatus(data.status || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load agent status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [agentId, enabled]);

  useEffect(() => {
    fetchStatus();

    if (pollInterval && pollInterval > 0) {
      const interval = setInterval(fetchStatus, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, pollInterval]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus
  };
}


