/**
 * Hook for managing follow-up schedules
 */

import { useState, useEffect, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

export interface FollowupSchedule {
  id: string;
  agent_id: string;
  contact_id: string;
  original_outreach_id: string | null;
  scheduled_for: string;
  followup_type: 'reminder' | 'value_add' | 'escalation' | 'check_in';
  message_draft: string | null;
  status: 'scheduled' | 'executed' | 'cancelled' | 'skipped';
  executed_at: string | null;
  created_at: string;
  contact?: {
    speaker_data: any;
    enhanced_data?: any;
  };
  original_outreach?: {
    subject: string | null;
    message_body: string;
    sent_at: string | null;
  };
}

export interface UseFollowupScheduleOptions {
  agentId?: string;
  contactId?: string;
  status?: 'scheduled' | 'executed' | 'cancelled' | 'skipped';
  limit?: number;
  enabled?: boolean;
}

export interface UseFollowupScheduleReturn {
  schedules: FollowupSchedule[];
  loading: boolean;
  error: string | null;
  total: number;
  refresh: () => Promise<void>;
  cancelSchedule: (scheduleId: string) => Promise<void>;
}

export function useFollowupSchedule(
  options: UseFollowupScheduleOptions = {}
): UseFollowupScheduleReturn {
  const {
    agentId,
    contactId,
    status,
    limit = 50,
    enabled = true,
  } = options;

  const [schedules, setSchedules] = useState<FollowupSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchSchedules = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = await supabaseBrowser();
      let query = supabase
        .from('agent_followup_schedule')
        .select(`
          *,
          contact:saved_speaker_profiles!inner(
            speaker_data,
            enhanced_data
          ),
          original_outreach:agent_outreach_drafts(
            subject,
            message_body,
            sent_at
          )
        `, { count: 'exact' })
        .order('scheduled_for', { ascending: true });

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      if (contactId) {
        query = query.eq('contact_id', contactId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setSchedules((data || []) as FollowupSchedule[]);
      setTotal(count || 0);
    } catch (err: any) {
      console.error('Error fetching follow-up schedules:', err);
      setError(err.message || 'Failed to fetch follow-up schedules');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [agentId, contactId, status, limit, enabled]);

  const cancelSchedule = useCallback(async (scheduleId: string) => {
    try {
      const supabase = await supabaseBrowser();
      const { error: updateError } = await supabase
        .from('agent_followup_schedule')
        .update({ status: 'cancelled' })
        .eq('id', scheduleId);

      if (updateError) {
        throw updateError;
      }

      // Refresh schedules
      await fetchSchedules();
    } catch (err: any) {
      console.error('Error cancelling follow-up schedule:', err);
      throw err;
    }
  }, [fetchSchedules]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return {
    schedules,
    loading,
    error,
    total,
    refresh: fetchSchedules,
    cancelSchedule,
  };
}

