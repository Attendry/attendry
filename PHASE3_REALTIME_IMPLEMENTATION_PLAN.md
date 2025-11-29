# Phase 3: Real-time Updates Implementation Plan

**Date:** 2025-02-26  
**Goal:** Implement real-time task status updates and push notifications for agent assignments  
**Status:** Planning Phase

---

## Overview

This plan outlines the implementation of real-time updates for agent task assignments using Supabase real-time subscriptions and browser push notifications. This will replace the current polling mechanism (5-second intervals) with instant, event-driven updates.

---

## Architecture

### Current State
- ✅ Polling every 5 seconds to check task status
- ✅ Manual refresh on task assignment
- ✅ Toast notifications on assignment

### Target State
- ✅ Real-time updates via Supabase subscriptions
- ✅ Instant UI updates when task status changes
- ✅ Browser push notifications for task completion
- ✅ Automatic cleanup and error handling

---

## Implementation Steps

### Step 1: Supabase Real-time Configuration

#### 1.1 Enable Real-time on `agent_tasks` Table

**Location:** Supabase Dashboard → Database → Replication

**Action:**
1. Navigate to Supabase Dashboard
2. Go to Database → Replication
3. Enable replication for `agent_tasks` table
4. Verify RLS policies allow real-time subscriptions

**SQL Verification:**
```sql
-- Check if real-time is enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- If not enabled, enable it (run as superuser)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;
```

**RLS Policy Check:**
```sql
-- Ensure users can subscribe to their own agent tasks
-- This should already be covered by existing RLS policies
-- Verify: SELECT policies on agent_tasks allow user to see their tasks
```

#### 1.2 Create Database Function for Task Status Changes (Optional)

**Purpose:** Trigger notifications when task status changes to `completed` or `failed`

**Location:** `supabase/migrations/[timestamp]_add_task_status_notification.sql`

```sql
-- Function to notify on task completion
CREATE OR REPLACE FUNCTION notify_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify on status changes to completed or failed
  IF NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status THEN
    PERFORM pg_notify(
      'task_status_change',
      json_build_object(
        'task_id', NEW.id,
        'agent_id', NEW.agent_id,
        'status', NEW.status,
        'contact_id', NEW.input_data->>'contactId',
        'task_type', NEW.task_type
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS task_status_change_trigger ON agent_tasks;
CREATE TRIGGER task_status_change_trigger
  AFTER UPDATE OF status ON agent_tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_task_status_change();
```

---

### Step 2: Create Custom React Hook for Task Subscriptions

#### 2.1 Create `useTaskSubscription` Hook

**Location:** `src/lib/hooks/useTaskSubscription.ts`

**Purpose:** Centralized hook for subscribing to task updates for a specific contact

**Implementation:**

```typescript
import { useEffect, useState, useRef } from 'react';
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
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initial load of tasks
  useEffect(() => {
    if (!enabled || !contactId || agentIds.length === 0) {
      setLoading(false);
      return;
    }

    const loadInitialTasks = async () => {
      try {
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
          .in('agent_id', agentIds)
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
      } catch (err: any) {
        console.error('Error loading tasks:', err);
        setError(err.message || 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    loadInitialTasks();
  }, [contactId, agentIds, enabled]);

  // Set up real-time subscription
  useEffect(() => {
    if (!enabled || !contactId || agentIds.length === 0) {
      return;
    }

    const supabase = supabaseBrowser();
    
    // Create a channel for this contact's tasks
    const channel = supabase
      .channel(`tasks:contact:${contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'agent_tasks',
          filter: `agent_id=in.(${agentIds.join(',')})`,
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
                // Add new task (if it's pending or in_progress)
                if (['pending', 'in_progress'].includes(fullTask.status)) {
                  return [fullTask as TaskUpdate, ...prev];
                }
                return prev;
              }
            });

            // Call callbacks
            if (onTaskUpdate) {
              onTaskUpdate(fullTask as TaskUpdate);
            }

            // Check if task just completed
            if (
              payload.eventType === 'UPDATE' &&
              (fullTask.status === 'completed' || fullTask.status === 'failed')
            ) {
              const oldTask = payload.old as any;
              if (oldTask?.status !== fullTask.status) {
                if (onTaskComplete) {
                  onTaskComplete(fullTask as TaskUpdate);
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
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Channel subscription error');
          setError('Subscription error');
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
  }, [contactId, agentIds, enabled, onTaskUpdate, onTaskComplete]);

  const subscribe = () => {
    // Re-subscribe if needed
    if (!channelRef.current && enabled) {
      // Trigger re-subscription via dependency change
      // This is handled by the useEffect above
    }
  };

  const unsubscribe = () => {
    if (channelRef.current) {
      const supabase = supabaseBrowser();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  return {
    activeTasks,
    loading,
    error,
    subscribe,
    unsubscribe,
  };
}
```

---

### Step 3: Integrate Subscriptions into ContactCard

#### 3.1 Update ContactCard Component

**Location:** `src/components/contacts/ContactCard.tsx`

**Changes:**
1. Replace polling `useEffect` with `useTaskSubscription` hook
2. Remove 5-second interval
3. Add error handling for subscription failures

**Implementation:**

```typescript
// Replace the existing checkAgentActivity useEffect with:

import { useTaskSubscription } from '@/lib/hooks/useTaskSubscription';

// Inside ContactCard component:
const { activeTasks, loading: tasksLoading } = useTaskSubscription({
  contactId: contact.id,
  agentIds: outreachAgent ? [outreachAgent.id] : [],
  enabled: !!outreachAgent && !isArchived,
  onTaskComplete: (task) => {
    // Show notification when task completes
    if (task.status === 'completed') {
      toast.success('Agent task completed! Draft is ready.');
    } else if (task.status === 'failed') {
      toast.error('Agent task failed. Please check the task details.');
    }
  },
});

// Update activeTask state from subscription
useEffect(() => {
  const activeTask = activeTasks.find(
    (t) => ['pending', 'in_progress'].includes(t.status)
  );
  
  if (activeTask) {
    setActiveTask({
      id: activeTask.id,
      status: activeTask.status,
      task_type: activeTask.task_type,
      agent_name: activeTask.agent?.name || 'Agent',
      assigned_at: activeTask.assigned_at,
    });
  } else {
    setActiveTask(null);
  }
}, [activeTasks]);
```

---

### Step 4: Integrate Subscriptions into ContactModal

#### 4.1 Update ContactModal Component

**Location:** `src/components/contacts/ContactModal.tsx`

**Changes:**
1. Replace polling with `useTaskSubscription`
2. Update activeTasks state from subscription
3. Remove interval cleanup

**Implementation:**

```typescript
// Replace the existing task loading useEffect with:

import { useTaskSubscription } from '@/lib/hooks/useTaskSubscription';

// Inside ContactModal component:
const agentIds = availableAgents.map(a => a.id);

const { activeTasks: subscribedTasks, loading: tasksLoading } = useTaskSubscription({
  contactId: contact.id,
  agentIds,
  enabled: availableAgents.length > 0,
  onTaskComplete: (task) => {
    // Refresh drafts when task completes
    if (task.status === 'completed') {
      // Reload drafts
      loadAgentData();
      toast.success('Agent task completed!');
    }
  },
});

// Update activeTasks state
useEffect(() => {
  setActiveTasks(subscribedTasks);
}, [subscribedTasks]);
```

---

### Step 5: Implement Browser Push Notifications

#### 5.1 Create Notification Service

**Location:** `src/lib/services/notification-service.ts`

**Purpose:** Centralized service for browser push notifications

**Implementation:**

```typescript
interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

class NotificationService {
  private permission: NotificationPermission = 'default';

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    if (this.permission === 'default') {
      this.permission = await Notification.requestPermission();
    }

    return this.permission;
  }

  async showNotification(options: NotificationOptions): Promise<void> {
    const permission = await this.requestPermission();
    
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      badge: options.badge || '/favicon.ico',
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
    });

    // Handle click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
  }

  async notifyTaskComplete(task: {
    task_type: string;
    status: string;
    agent_name?: string;
  }): Promise<void> {
    const statusText = task.status === 'completed' ? 'completed' : 'failed';
    const emoji = task.status === 'completed' ? '✅' : '❌';
    
    await this.showNotification({
      title: `${emoji} Agent Task ${statusText}`,
      body: `${task.agent_name || 'Agent'} ${statusText} ${task.task_type.replace('_', ' ')}`,
      tag: `task-${task.status}`,
      requireInteraction: task.status === 'failed',
    });
  }

  async notifyTaskAssigned(task: {
    task_type: string;
    agent_name?: string;
  }): Promise<void> {
    await this.showNotification({
      title: '🤖 Task Assigned',
      body: `${task.agent_name || 'Agent'} will process ${task.task_type.replace('_', ' ')}`,
      tag: 'task-assigned',
    });
  }
}

export const notificationService = new NotificationService();
```

#### 5.2 Integrate Notifications into Components

**Update ContactCard and ContactModal:**

```typescript
import { notificationService } from '@/lib/services/notification-service';

// In useTaskSubscription callbacks:
onTaskComplete: async (task) => {
  await notificationService.notifyTaskComplete({
    task_type: task.task_type,
    status: task.status,
    agent_name: task.agent?.name,
  });
  
  if (task.status === 'completed') {
    toast.success('Agent task completed! Draft is ready.');
  }
},
```

---

### Step 6: Error Handling and Fallback

#### 6.1 Fallback to Polling

**Strategy:** If real-time subscription fails, fall back to polling

**Implementation in `useTaskSubscription`:**

```typescript
const [usePolling, setUsePolling] = useState(false);

useEffect(() => {
  // If subscription fails, enable polling
  if (error && error.includes('subscription')) {
    console.warn('Real-time subscription failed, falling back to polling');
    setUsePolling(true);
  }
}, [error]);

// Polling fallback
useEffect(() => {
  if (!usePolling || !enabled) return;

  const interval = setInterval(async () => {
    // Re-run initial load logic
    await loadInitialTasks();
  }, 5000);

  return () => clearInterval(interval);
}, [usePolling, enabled, contactId, agentIds]);
```

#### 6.2 Connection Status Indicator

**Add visual indicator for subscription status:**

```typescript
const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'polling'>('disconnected');

// In subscription callback:
.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    setConnectionStatus('connected');
  } else if (status === 'CHANNEL_ERROR') {
    setConnectionStatus('polling');
  }
});
```

---

### Step 7: Performance Optimizations

#### 7.1 Debounce Rapid Updates

**Prevent UI thrashing from rapid status changes:**

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedUpdate = useDebouncedCallback((task: TaskUpdate) => {
  setActiveTasks((prev) => {
    // Update logic
  });
}, 300); // 300ms debounce
```

#### 7.2 Limit Subscription Scope

**Only subscribe to relevant statuses:**

```typescript
// In channel filter, add status filter
.filter(`status=in.(pending,in_progress,completed,failed)`)
```

#### 7.3 Cleanup on Unmount

**Ensure proper cleanup:**

```typescript
useEffect(() => {
  return () => {
    // Cleanup subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
  };
}, []);
```

---

## Testing Plan

### Unit Tests
1. ✅ Test `useTaskSubscription` hook with mock Supabase client
2. ✅ Test notification service permission handling
3. ✅ Test fallback to polling on subscription failure

### Integration Tests
1. ✅ Test real-time updates in ContactCard
2. ✅ Test real-time updates in ContactModal
3. ✅ Test notification display on task completion
4. ✅ Test cleanup on component unmount

### Manual Testing Checklist
- [ ] Assign task to contact → Verify badge appears immediately
- [ ] Task status changes to `in_progress` → Verify badge updates
- [ ] Task completes → Verify notification appears
- [ ] Close contact modal → Verify subscription cleans up
- [ ] Navigate away from contacts page → Verify subscriptions cleanup
- [ ] Test with multiple contacts → Verify independent subscriptions
- [ ] Test with no internet → Verify fallback to polling
- [ ] Test notification permissions → Verify graceful handling

---

## Migration Strategy

### Phase 1: Add Subscription (Week 1)
1. Create `useTaskSubscription` hook
2. Add to ContactCard (alongside existing polling)
3. Test in development

### Phase 2: Replace Polling (Week 2)
1. Replace polling in ContactCard with subscription
2. Add to ContactModal
3. Remove interval-based polling

### Phase 3: Add Notifications (Week 3)
1. Create notification service
2. Integrate into task completion callbacks
3. Test permission handling

### Phase 4: Production Rollout (Week 4)
1. Enable real-time on `agent_tasks` table
2. Deploy to staging
3. Monitor for issues
4. Deploy to production

---

## Rollback Plan

If issues arise:
1. **Immediate:** Disable real-time subscriptions via feature flag
2. **Fallback:** Re-enable polling mechanism
3. **Fix:** Address issues in development
4. **Re-deploy:** Re-enable subscriptions after fixes

**Feature Flag Implementation:**

```typescript
const USE_REALTIME = process.env.NEXT_PUBLIC_USE_REALTIME_TASKS === 'true';

// In hook:
if (!USE_REALTIME) {
  // Use polling instead
  return usePollingTasks(...);
}
```

---

## Success Metrics

### Performance
- ✅ Subscription latency < 100ms
- ✅ UI update latency < 200ms
- ✅ No memory leaks from subscriptions
- ✅ Cleanup on component unmount

### User Experience
- ✅ Instant badge updates (no 5-second delay)
- ✅ Notifications appear within 1 second of completion
- ✅ No duplicate notifications
- ✅ Graceful fallback if subscription fails

### Reliability
- ✅ 99.9% subscription success rate
- ✅ Automatic reconnection on disconnect
- ✅ Fallback to polling if subscription fails
- ✅ No console errors in production

---

## Dependencies

### Required
- ✅ Supabase real-time enabled on `agent_tasks` table
- ✅ RLS policies allow subscriptions
- ✅ Browser support for Notifications API

### Optional
- ✅ Database trigger for task status changes (for additional notifications)
- ✅ Service Worker for background notifications (future enhancement)

---

## Future Enhancements

1. **Service Worker Notifications**
   - Background notifications when tab is closed
   - Persistent notification badges

2. **Notification Actions**
   - "View Draft" button in notification
   - "Approve" / "Reject" actions

3. **Notification Preferences**
   - User settings for notification types
   - Quiet hours / Do Not Disturb mode

4. **Multi-tab Synchronization**
   - Share subscription state across tabs
   - Prevent duplicate notifications

5. **Task Progress Indicators**
   - Real-time progress percentage
   - Estimated time remaining

---

## Notes

- **Supabase Real-time Limits:** Free tier has connection limits; monitor usage
- **Browser Compatibility:** Notifications API requires HTTPS in production
- **Performance:** Multiple subscriptions per page may impact performance; consider connection pooling
- **Security:** Ensure RLS policies prevent unauthorized subscriptions

---

## Implementation Timeline

- **Week 1:** Hook development and testing
- **Week 2:** Integration into components
- **Week 3:** Notification service and integration
- **Week 4:** Testing, optimization, and production rollout

**Total Estimated Time:** 3-4 weeks

