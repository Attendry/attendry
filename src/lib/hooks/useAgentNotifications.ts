'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseAgentNotificationsReturn {
  pendingApprovals: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAgentNotifications(options: { enabled?: boolean; autoRefresh?: boolean; refreshInterval?: number } = {}): UseAgentNotificationsReturn {
  const { enabled = true, autoRefresh = true, refreshInterval = 30000 } = options;
  
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents/outreach/drafts?status=pending_approval&limit=1');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch notifications');
      }

      setPendingApprovals(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
      setPendingApprovals(0);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Initial load
  useEffect(() => {
    if (enabled) {
      fetchNotifications();
    }
  }, [enabled, fetchNotifications]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !enabled) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, enabled, refreshInterval, fetchNotifications]);

  return {
    pendingApprovals,
    loading,
    error,
    refresh: fetchNotifications
  };
}

