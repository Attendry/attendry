# Follow-up Agent Implementation Summary
**Date:** 2025-02-26  
**Status:** Complete ✅

---

## What Was Implemented

### 1. FollowupAgent Class ✅

**File:** `src/lib/agents/followup-agent.ts`

**Features:**
- ✅ Extends BaseAgent
- ✅ Handles `schedule_followup` and `execute_followup` tasks
- ✅ Follow-up scheduling with configurable delay
- ✅ Follow-up message drafting using LLM
- ✅ Automatic execution of scheduled follow-ups
- ✅ Max follow-up limits with escalation
- ✅ Multiple follow-up types (reminder, value_add, escalation, check_in)

**Key Methods:**
- `scheduleFollowup()` - Schedules a follow-up for a contact
- `executeFollowup()` - Executes a scheduled follow-up
- `draftFollowupMessage()` - Uses LLM to draft follow-up messages
- `determineFollowupType()` - Chooses appropriate follow-up type
- `getFollowupCount()` - Tracks number of follow-ups
- `escalateToUser()` - Escalates when max follow-ups reached

---

### 2. Database Migration ✅

**File:** `supabase/migrations/20250226000003_add_agent_followup_schedule_table.sql`

**Features:**
- ✅ `agent_followup_schedule` table
- ✅ Tracks scheduled follow-ups with execution status
- ✅ Links to contacts, agents, and original outreach
- ✅ Proper indexes for performance
- ✅ RLS policies for security

**Table Schema:**
- `id` - UUID primary key
- `agent_id` - Reference to ai_agents
- `contact_id` - Reference to saved_speaker_profiles
- `original_outreach_id` - Reference to agent_outreach_drafts
- `scheduled_for` - When to execute the follow-up
- `followup_type` - Type of follow-up (reminder, value_add, escalation, check_in)
- `message_draft` - Drafted message (stored after execution)
- `status` - scheduled, executed, cancelled, skipped
- `executed_at` - Timestamp when executed

---

### 3. Follow-up Execution Cron Job ✅

**File:** `src/app/api/cron/execute-followups/route.ts`

**Features:**
- ✅ Finds due follow-ups (scheduled_for <= now)
- ✅ Creates execute_followup tasks
- ✅ Processes tasks via job queue
- ✅ Handles errors gracefully
- ✅ Returns execution results

**Schedule:** Runs every hour (configured in vercel.json)

---

### 4. Outreach Agent Integration ✅

**File:** `src/lib/agents/outreach-agent.ts`

**Changes:**
- ✅ Added `notifyFollowupAgent()` method
- ✅ Automatically notifies Follow-up Agent when draft is created
- ✅ Schedules follow-up based on `defaultFollowupDelayDays` config
- ✅ Only notifies if `notifyFollowupAgent` config is true

**Flow:**
1. Outreach Agent creates draft
2. If `notifyFollowupAgent` is enabled, creates task for Follow-up Agent
3. Follow-up Agent schedules follow-up
4. Cron job executes follow-up when due

---

### 5. Job Queue Integration ✅

**File:** `src/lib/services/job-queue.ts`

**Changes:**
- ✅ Added `processAgentTask()` function (exported for direct use)
- ✅ Added support for `followup` agent type
- ✅ Improved fallback mechanism for serverless environments
- ✅ Better error handling

---

### 6. Fixed Outreach Agent Task Processing ✅

**Issues Fixed:**
- ✅ Added fallback mechanism when Redis unavailable
- ✅ Direct task processing if queue fails
- ✅ Better error handling and logging
- ✅ Works in serverless environments (Vercel)

**Changes:**
- `queueAgentTask()` now falls back to direct processing
- `processAgentTask()` exported for direct use
- Cron job processes tasks directly if queue fails
- Worker only initialized in non-serverless environments

---

## How It Works

### Follow-up Workflow

```
1. Outreach Agent creates draft
   ↓
2. Outreach Agent notifies Follow-up Agent (if enabled)
   ↓
3. Follow-up Agent receives schedule_followup task
   ↓
4. Follow-up Agent schedules follow-up (stores in agent_followup_schedule)
   ↓
5. Cron job (/api/cron/execute-followups) runs hourly
   ↓
6. Cron job finds due follow-ups
   ↓
7. Creates execute_followup tasks
   ↓
8. Follow-up Agent executes follow-up
   - Drafts message using LLM
   - Sends email (if contact has email)
   - Creates agent_outreach_sent record
   - Updates follow-up status to 'executed'
```

### Task Processing Flow (Fixed)

```
1. User assigns task
   ↓
2. Task created in database (status: pending)
   ↓
3. Try to queue task
   ↓
4. If queue fails → Process directly (fallback)
   ↓
5. If queue succeeds → Worker processes (or cron job picks up)
   ↓
6. Agent processes task
   ↓
7. Draft created / Follow-up scheduled
```

---

## Configuration

### Follow-up Agent Config

```typescript
{
  defaultFollowupDelayDays: 3,        // Days to wait before follow-up
  maxFollowups: 3,                     // Max follow-ups before escalation
  escalationAfterAttempts: 2,         // Escalate after N attempts
  followupTypes: ['reminder', 'value_add', 'escalation'] // Available types
}
```

### Outreach Agent Config (for notifications)

```typescript
{
  notifyFollowupAgent: true,           // Enable Follow-up Agent notifications
  defaultFollowupDelayDays: 3          // Delay for scheduled follow-up
}
```

---

## Database Migrations Required

1. ✅ `20250226000002_add_agent_outreach_sent_table.sql` - For tracking sent messages
2. ✅ `20250226000003_add_agent_followup_schedule_table.sql` - For follow-up scheduling

**Run these migrations in Supabase Dashboard or via CLI**

---

## Testing

### Test Follow-up Scheduling

1. Create an Outreach Agent with `notifyFollowupAgent: true`
2. Create a Follow-up Agent
3. Assign a draft_outreach task to Outreach Agent
4. Verify:
   - Draft is created
   - Task is created for Follow-up Agent
   - Follow-up is scheduled in `agent_followup_schedule` table

### Test Follow-up Execution

1. Create a scheduled follow-up with `scheduled_for` in the past
2. Call `/api/cron/execute-followups` (with CRON_SECRET)
3. Verify:
   - Follow-up is executed
   - Message is drafted
   - Email is sent (if contact has email)
   - `agent_outreach_sent` record is created
   - Follow-up status updated to 'executed'

### Test Task Processing Fix

1. Assign a task to Outreach Agent
2. Check console logs:
   - Should see "[Job Queue] Queued task..." or "[Job Queue] Failed to queue task, processing directly"
3. Verify:
   - Task is processed (status changes to completed)
   - Draft is created
   - No 10-minute wait

---

## Known Limitations

1. **LinkedIn Follow-ups:** Not yet implemented (email only)
2. **Follow-up Type Selection:** Currently defaults to 'reminder' (can be enhanced)
3. **Escalation:** Logs activity but doesn't create user notifications yet
4. **Email Blocking:** Follow-ups respect `ALLOW_EMAIL_SENDING` flag

---

## Next Steps

### Immediate
1. Run database migrations
2. Test follow-up scheduling
3. Test follow-up execution
4. Monitor cron job execution

### Short-term
1. Add UI components for follow-up schedule
2. Add follow-up history view
3. Enhance follow-up type selection logic
4. Add user notifications for escalations

### Future Enhancements
1. Smart follow-up timing based on contact behavior
2. A/B testing for follow-up messages
3. Multi-channel follow-ups (LinkedIn, etc.)
4. Follow-up templates and customization

---

## Files Created/Modified

### Created
- ✅ `src/lib/agents/followup-agent.ts`
- ✅ `src/app/api/cron/execute-followups/route.ts`
- ✅ `supabase/migrations/20250226000003_add_agent_followup_schedule_table.sql`

### Modified
- ✅ `src/lib/services/job-queue.ts` - Added fallback and followup support
- ✅ `src/lib/agents/outreach-agent.ts` - Added Follow-up Agent notification
- ✅ `src/app/api/cron/process-agent-tasks/route.ts` - Improved error handling
- ✅ `vercel.json` - Added follow-up execution cron job

---

**Implementation Complete:** 2025-02-26  
**Status:** Ready for testing

