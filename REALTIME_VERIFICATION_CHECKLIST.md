# Real-time Setup Verification Checklist ✅

**Status:** Real-time enabled on `agent_tasks` table

---

## ✅ What's Already Done

1. **Real-time Enabled** ✅
   - `agent_tasks` table has real-time replication enabled
   - This adds the table to the `supabase_realtime` publication
   - WebSocket subscriptions will work

2. **RLS Policies** ✅
   - SELECT policy exists: "Users can view own agent tasks"
   - Policy allows users to see tasks for their own agents
   - Required for real-time subscriptions to work

3. **Code Implementation** ✅
   - `useTaskSubscription` hook is ready
   - Components are integrated (ContactCard, ContactModal)
   - Browser notifications are implemented
   - Fallback to polling is implemented

---

## Quick Verification Test

### Test 1: Check Real-time Status
Run this SQL in Supabase SQL Editor:
```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'agent_tasks';
```

**Expected Result:** Should return 1 row showing `agent_tasks` is in the publication.

### Test 2: Check RLS Policies
Run this SQL:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'agent_tasks' 
AND policyname LIKE '%view%';
```

**Expected Result:** Should show "Users can view own agent tasks" policy.

### Test 3: Test Real-time Updates
1. Open your app and navigate to a contact
2. Assign a task to an agent
3. **Watch for:**
   - Badge appears **immediately** (not after 5 seconds)
   - Console shows: `Subscribed to tasks for contact [contactId]`
   - No "falling back to polling" message

### Test 4: Test Browser Notifications
1. Assign a task to an agent
2. Wait for task to complete (or manually update status in database)
3. **Watch for:**
   - Browser notification appears
   - Notification includes contact name and agent name
   - Clicking notification focuses the window

---

## What "Replication" Means in Supabase

In Supabase, there are two related concepts:

1. **Real-time Replication** (What you enabled)
   - Adds table to `supabase_realtime` publication
   - Enables WebSocket subscriptions
   - Required for real-time updates in your app
   - ✅ **This is what you have enabled**

2. **Logical Replication** (Different feature)
   - Used for replicating data to external systems
   - Not needed for your use case
   - This is a separate feature

**For your real-time updates to work, you only need #1 (Real-time Replication), which you've already enabled!** ✅

---

## How It Works Now

```
1. Task created/updated in database
   ↓
2. Supabase detects change (via logical replication)
   ↓
3. Supabase sends WebSocket message to subscribed clients
   ↓
4. useTaskSubscription hook receives update
   ↓
5. UI updates instantly (< 100ms)
```

---

## Troubleshooting

### If updates still take 5 seconds:

1. **Check browser console:**
   - Look for: `Subscribed to tasks for contact [id]`
   - If you see: `falling back to polling` → Real-time subscription failed

2. **Check WebSocket connection:**
   - Open browser DevTools → Network tab
   - Filter by "WS" (WebSocket)
   - Should see active WebSocket connection to Supabase

3. **Verify RLS policies:**
   - Make sure SELECT policy exists
   - Test with: `SELECT * FROM agent_tasks` (should only show your tasks)

4. **Check Supabase Dashboard:**
   - Database → Replication
   - Verify `agent_tasks` shows as "Enabled"

---

## Summary

✅ **Real-time is enabled** - You're all set!  
✅ **RLS policies are correct** - Users can see their own tasks  
✅ **Code is ready** - Everything is integrated  

**Next step:** Test it! Assign a task and watch for instant updates. 🚀

