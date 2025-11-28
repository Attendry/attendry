'use client';

import { useState, useEffect, useCallback } from 'react';
import { AgentOutreachDraft, DraftStatus } from '@/lib/types/agents';

interface UseOutreachDraftsOptions {
  status?: DraftStatus;
  agentId?: string;
  enabled?: boolean;
}

interface UseOutreachDraftsReturn {
  drafts: (AgentOutreachDraft & { agent?: any; contact?: any; opportunity?: any })[];
  loading: boolean;
  error: string | null;
  approveDraft: (draftId: string, edits?: { subject?: string; messageBody?: string }) => Promise<void>;
  rejectDraft: (draftId: string, reason: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useOutreachDrafts(options: UseOutreachDraftsOptions = {}): UseOutreachDraftsReturn {
  const { status = 'pending_approval', agentId, enabled = true } = options;
  const [drafts, setDrafts] = useState<(AgentOutreachDraft & { agent?: any; contact?: any; opportunity?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('status', status);
      if (agentId) {
        params.append('agentId', agentId);
      }

      const response = await fetch(`/api/agents/outreach/drafts?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        // Ensure error is always a string
        const errorMessage = typeof data.error === 'string' 
          ? data.error 
          : data.error?.message || 'Failed to fetch drafts';
        throw new Error(errorMessage);
      }

      // Ensure drafts is always an array
      setDrafts(Array.isArray(data.drafts) ? data.drafts : []);
    } catch (err: any) {
      // Ensure error message is always a string
      const errorMessage = err?.message || (typeof err === 'string' ? err : 'Failed to load drafts');
      setError(errorMessage);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [status, agentId, enabled]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const approveDraft = useCallback(async (
    draftId: string,
    edits?: { subject?: string; messageBody?: string }
  ): Promise<void> => {
    try {
      const response = await fetch(`/api/agents/outreach/drafts/${draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve draft');
      }

      await fetchDrafts();
    } catch (err: any) {
      setError(err.message || 'Failed to approve draft');
      throw err;
    }
  }, [fetchDrafts]);

  const rejectDraft = useCallback(async (draftId: string, reason: string): Promise<void> => {
    try {
      const response = await fetch(`/api/agents/outreach/drafts/${draftId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject draft');
      }

      await fetchDrafts();
    } catch (err: any) {
      setError(err.message || 'Failed to reject draft');
      throw err;
    }
  }, [fetchDrafts]);

  return {
    drafts,
    loading,
    error,
    approveDraft,
    rejectDraft,
    refresh: fetchDrafts
  };
}


