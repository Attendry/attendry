import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { RealtimeChannel } from '@supabase/supabase-js';

interface TaskUpdate {
  id: string;
  status: string;
  task_type: string;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  input_data: Record<string, any>;
  agent?: {
    id: string;
    name: string;
    agent_type: string;
  };
}

interface UseTaskSubscriptionOptions {
  contactId: string;
  agentIds: string[];
  enabled?: boolean;
  onTaskUpdate?: (task: TaskUpdate) => void;
  onTaskComplete?: (task: TaskUpdate) => void;
}

interface UseTaskSubscriptionReturn {
  activeTasks: TaskUpdate[];
  loading: boolean;
  error: string | null;
  subscribe: () => void;
  unsubscribe: () => void;
}

export function useTaskSubscription({
  contactId,
  agentIds,
  enabled = true,
  onTaskUpdate,
  onTaskComplete,
}: UseTaskSubscriptionOptions): UseTaskSubscriptionReturn {
  const [activeTasks, setActiveTasks] = useState<TaskUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usePolling, setUsePolling] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loadingRef = useRef(false);
  const errorCountRef = useRef(0);
  
  // Store callbacks in refs to avoid dependency issues
  const onTaskUpdateRef = useRef(onTaskUpdate);
  const onTaskCompleteRef = useRef(onTaskComplete);
  
  useEffect(() => {
    onTaskUpdateRef.current = onTaskUpdate;
    onTaskCompleteRef.current = onTaskComplete;
  }, [onTaskUpdate, onTaskComplete]);

  // Memoize agentIds as a sorted string for stable comparison
  const agentIdsKey = useMemo(() => {
    return agentIds.length > 0 ? [...agentIds].sort().join(',') : '';
  }, [agentIds]);

  // Memoize the actual agentIds array for use in queries
  const stableAgentIds = useMemo(() => {
    return agentIds.length > 0 ? [...agentIds] : [];
  }, [agentIdsKey]);

  // Load initial tasks with debouncing and error handling
  const loadInitialTasks = useCallback(async () => {
    if (!contactId || stableAgentIds.length === 0) {
      setLoading(false);
      return;
    }

    // Prevent concurrent requests
    if (loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      const supabase = supabaseBrowser();

      // Get all tasks for user's agents
      const { data: allTasks, error: queryError } = await supabase
        .from('agent_tasks')
        .select(`
          id,
          status,
          task_type,
          assigned_at,
          started_at,
          completed_at,
          input_data,
          agent:ai_agents(id, name, agent_type)
        `)
        .in('agent_id', stableAgentIds)
        .in('status', ['pending', 'in_progress', 'completed', 'failed'])
        .order('assigned_at', { ascending: false })
        .limit(20);

      if (queryError) throw queryError;

      // Filter tasks for this contact
      const contactTasks = (allTasks || []).filter((task: any) => {
        const inputData = task.input_data || {};
        return inputData.contactId === contactId;
      });

      setActiveTasks(contactTasks);
      setError(null);
      errorCountRef.current = 0; // Reset error count on success
    } catch (err: any) {
      errorCountRef.current += 1;
      console.error('Error loading tasks:', err);
      setError(err.message || 'Failed to load tasks');
      
      // If too many errors, disable to prevent infinite loops
      if (errorCountRef.current > 5) {
        console.error('Too many errors loading tasks, disabling subscription');
        setUsePolling(false);
        setLoading(false);
        return;
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [contactId, stableAgentIds]);

  // Initial load - only when dependencies actually change
  useEffect(() => {
    if (!enabled || !contactId || stableAgentIds.length === 0) {
      setLoading(false);
      return;
    }

    // Reset error count when dependencies change
    errorCountRef.current = 0;
    loadInitialTasks();
  }, [contactId, agentIdsKey, enabled, loadInitialTasks]);

  // Set up real-time subscription
  useEffect(() => {
    if (!enabled || !contactId || stableAgentIds.length === 0 || usePolling) {
      return;
    }

    const supabase = supabaseBrowser();
    
    // Clean up any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // Create a channel for this contact's tasks
    const channel = supabase
      .channel(`tasks:contact:${contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'agent_tasks',
          filter: `agent_id=in.(${stableAgentIds.join(',')})`,
        },
        async (payload) => {
          try {
            const task = payload.new as any;
            
            // Check if this task is for our contact
            const inputData = task?.input_data || {};
            if (inputData.contactId !== contactId) {
              return; // Not for this contact
            }

            // Fetch full task data with agent info
            const { data: fullTask, error: fetchError } = await supabase
              .from('agent_tasks')
              .select(`
                id,
                status,
                task_type,
                assigned_at,
                started_at,
                completed_at,
                input_data,
                agent:ai_agents(id, name, agent_type)
              `)
              .eq('id', task.id)
              .single();

            if (fetchError || !fullTask) {
              console.error('Error fetching task details:', fetchError);
              return;
            }

            // Update local state
            setActiveTasks((prev) => {
              const existingIndex = prev.findIndex((t) => t.id === fullTask.id);
              
              if (payload.eventType === 'DELETE') {
                // Remove task
                return prev.filter((t) => t.id !== fullTask.id);
              }

              if (existingIndex >= 0) {
                // Update existing task
                const updated = [...prev];
                updated[existingIndex] = fullTask as TaskUpdate;
                return updated;
              } else {
                // Add new task (include completed/failed for recent completion notifications)
                if (['pending', 'in_progress', 'completed', 'failed'].includes(fullTask.status)) {
                  return [fullTask as TaskUpdate, ...prev];
                }
                return prev;
              }
            });

            // Call callbacks using refs
            if (onTaskUpdateRef.current) {
              onTaskUpdateRef.current(fullTask as TaskUpdate);
            }

            // Check if task just completed
            if (
              payload.eventType === 'UPDATE' &&
              (fullTask.status === 'completed' || fullTask.status === 'failed')
            ) {
              const oldTask = payload.old as any;
              if (oldTask?.status !== fullTask.status) {
                if (onTaskCompleteRef.current) {
                  onTaskCompleteRef.current(fullTask as TaskUpdate);
                }
              }
            }
          } catch (err) {
            console.error('Error handling real-time update:', err);
            setError(err instanceof Error ? err.message : 'Update error');
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to tasks for contact ${contactId}`);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel subscription error, falling back to polling');
          setError('Subscription error');
          setUsePolling(true);
        }
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [contactId, agentIdsKey, enabled, usePolling, stableAgentIds]);

  // Polling fallback
  useEffect(() => {
    if (!usePolling || !enabled || !contactId || stableAgentIds.length === 0) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Poll every 5 seconds as fallback
    pollingIntervalRef.current = setInterval(() => {
      loadInitialTasks();
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [usePolling, enabled, contactId, agentIdsKey, loadInitialTasks, stableAgentIds.length]);

  const subscribe = () => {
    // Re-subscription is handled by the useEffect above
    setUsePolling(false);
  };

  const unsubscribe = () => {
    if (channelRef.current) {
      const supabase = supabaseBrowser();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    activeTasks,
    loading,
    error,
    subscribe,
    unsubscribe,
  };
}

