# Real-time Updates Setup Guide

**Date:** 2025-02-26  
**Feature:** Phase 3 - Real-time Task Status Updates

---

## Prerequisites

✅ All code changes have been implemented:
- `useTaskSubscription` hook created
- ContactCard and ContactModal integrated
- Notification service created
- Database migration created (optional)

---

## Required Setup Steps

### Step 1: Enable Real-time Replication on `agent_tasks` Table

**Location:** Supabase Dashboard → Database → Replication

1. Navigate to your Supabase project dashboard
2. Go to **Database** → **Replication**
3. Find the `agent_tasks` table in the list
4. Toggle the switch to **enable** replication for this table
5. Verify the status shows as "Enabled"

**Alternative (SQL):**
```sql
-- Run this as a superuser in Supabase SQL Editor
ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;
```

### Step 2: Verify RLS Policies

**Location:** Supabase Dashboard → Database → Tables → `agent_tasks` → Policies

Ensure that users can SELECT their own agent tasks. The existing RLS policies should already cover this, but verify:

```sql
-- This policy should exist (from migration 20250121000001)
-- Users can view own agent tasks
SELECT policy on agent_tasks using (
  EXISTS (
    SELECT 1 FROM ai_agents 
    WHERE ai_agents.id = agent_tasks.agent_id 
    AND ai_agents.user_id = auth.uid()
  )
);
```

### Step 3: Run Database Migration (Optional)

**Location:** Supabase Dashboard → Database → Migrations

The optional trigger migration (`20250226000002_add_task_status_notification_trigger.sql`) can be run if you want additional PostgreSQL notifications. This is **not required** for the real-time subscription feature to work.

To run:
1. Go to **Database** → **Migrations**
2. Click **New Migration**
3. Copy the contents of `supabase/migrations/20250226000002_add_task_status_notification_trigger.sql`
4. Run the migration

---

## Testing

### Test Real-time Updates

1. **Open a contact** in the contacts page
2. **Assign a task** to an agent for that contact
3. **Verify:**
   - Badge appears immediately on ContactCard (no 5-second delay)
   - Active task appears in ContactModal
   - Status updates in real-time when task status changes

### Test Browser Notifications

1. **Request notification permission** (browser will prompt on first use)
2. **Assign a task** to an agent
3. **Wait for task to complete** (or manually change status in database)
4. **Verify:**
   - Browser notification appears
   - Notification shows correct task details
   - Clicking notification focuses the window

### Test Fallback to Polling

1. **Disable real-time** in Supabase dashboard (temporarily)
2. **Assign a task** to an agent
3. **Verify:**
   - Console shows "falling back to polling" message
   - Updates still work (every 5 seconds)
   - No errors in console

---

## Troubleshooting

### Issue: Subscriptions not working

**Symptoms:**
- No real-time updates
- Console shows "Channel subscription error"

**Solutions:**
1. Verify real-time is enabled on `agent_tasks` table
2. Check RLS policies allow SELECT
3. Check browser console for specific errors
4. Verify Supabase project has real-time enabled (Settings → API)

### Issue: Notifications not appearing

**Symptoms:**
- No browser notifications
- Permission denied

**Solutions:**
1. Check browser notification permissions (Settings → Site Settings → Notifications)
2. Ensure site is served over HTTPS (required for notifications)
3. Check browser console for permission errors

### Issue: Multiple subscriptions

**Symptoms:**
- Duplicate updates
- Performance issues

**Solutions:**
1. Verify components properly cleanup subscriptions on unmount
2. Check for multiple instances of ContactCard/ContactModal
3. Review subscription channel names (should be unique per contact)

---

## Performance Considerations

### Connection Limits

- Supabase free tier: Limited concurrent connections
- Monitor connection count in Supabase dashboard
- Each contact with an active task creates one subscription

### Optimization Tips

1. **Unsubscribe when not needed:**
   - Subscriptions automatically cleanup on component unmount
   - Archived contacts don't subscribe

2. **Limit subscription scope:**
   - Only subscribe to relevant statuses (`pending`, `in_progress`, `completed`, `failed`)
   - Filter by agent IDs to reduce payload size

3. **Use polling fallback:**
   - If subscription fails, automatically falls back to polling
   - Prevents complete failure if real-time unavailable

---

## Monitoring

### Check Subscription Status

In browser console, you should see:
```
Subscribed to tasks for contact [contact-id]
```

### Monitor Real-time Connections

**Location:** Supabase Dashboard → Database → Replication

- View active connections
- Monitor replication lag
- Check for errors

---

## Next Steps

After setup is complete:

1. ✅ Test with a few contacts
2. ✅ Monitor for any errors
3. ✅ Verify notifications work
4. ✅ Check performance impact
5. ✅ Gather user feedback

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Check Supabase dashboard logs
3. Verify all setup steps completed
4. Review `PHASE3_REALTIME_IMPLEMENTATION_PLAN.md` for details


