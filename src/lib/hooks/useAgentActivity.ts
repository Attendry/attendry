'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AgentActivityLog } from '@/lib/types/agents';

interface UseAgentActivityOptions {
  agentId: string;
  enabled?: boolean;
  limit?: number;
  actionType?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseAgentActivityReturn {
  activities: AgentActivityLog[];
  loading: boolean;
  error: string | null;
  total: number;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useAgentActivity(options: UseAgentActivityOptions): UseAgentActivityReturn {
  const {
    agentId,
    enabled = true,
    limit = 50,
    actionType,
    autoRefresh = false,
    refreshInterval = 10000 // 10 seconds
  } = options;

  const [activities, setActivities] = useState<AgentActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  const fetchActivities = useCallback(async (reset = false) => {
    if (!enabled || !agentId) return;

    if (reset) {
      offsetRef.current = 0;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offsetRef.current.toString());
      if (actionType) {
        params.append('actionType', actionType);
      }

      const response = await fetch(`/api/agents/${agentId}/activity?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch activity');
      }

      const newActivities = Array.isArray(data.activities) ? data.activities : [];
      
      if (reset) {
        setActivities(newActivities);
      } else {
        setActivities(prev => [...prev, ...newActivities]);
      }

      offsetRef.current += newActivities.length;
      setTotal(data.total || 0);
      setHasMore(newActivities.length === limit && offsetRef.current < (data.total || 0));
    } catch (err: any) {
      setError(err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [agentId, enabled, limit, actionType]);

  const refresh = useCallback(async () => {
    await fetchActivities(true);
  }, [fetchActivities]);

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) {
      await fetchActivities(false);
    }
  }, [fetchActivities, loading, hasMore]);

  // Initial load
  useEffect(() => {
    if (enabled && agentId) {
      fetchActivities(true);
    }
  }, [enabled, agentId, actionType, fetchActivities]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !enabled || !agentId) return;

    const interval = setInterval(() => {
      fetchActivities(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, enabled, agentId, refreshInterval, fetchActivities]);

  return {
    activities,
    loading,
    error,
    total,
    refresh,
    loadMore,
    hasMore
  };
}
