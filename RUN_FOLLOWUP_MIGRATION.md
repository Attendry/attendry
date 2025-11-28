# Run Follow-up Schedule Migration

**Error:** `Could not find the table 'public.agent_followup_schedule' in the schema cache`

**Solution:** Run the migration to create the `agent_followup_schedule` table.

---

## Quick Fix: Run Migration in Supabase Dashboard

1. **Open Supabase Dashboard**
   - Go to your project
   - Navigate to **SQL Editor**

2. **Create New Query**
   - Click "New Query"
   - Copy and paste the SQL below

3. **Run the Migration**
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

---

## Migration SQL

```sql
-- Migration: 20250226000003
-- Add agent_followup_schedule table for Follow-up Agent
-- This table stores scheduled follow-ups that need to be executed

-- ============================================================================
-- Agent Follow-up Schedule Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_followup_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES saved_speaker_profiles(id) ON DELETE CASCADE,
  original_outreach_id UUID REFERENCES agent_outreach_drafts(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  followup_type TEXT NOT NULL CHECK (followup_type IN ('reminder', 'value_add', 'escalation', 'check_in')),
  message_draft TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'executed', 'cancelled', 'skipped')),
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_followup_schedule
CREATE INDEX IF NOT EXISTS idx_followup_schedule_agent_id ON agent_followup_schedule(agent_id);
CREATE INDEX IF NOT EXISTS idx_followup_schedule_contact_id ON agent_followup_schedule(contact_id);
CREATE INDEX IF NOT EXISTS idx_followup_schedule_scheduled_for ON agent_followup_schedule(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_followup_schedule_status ON agent_followup_schedule(status);
CREATE INDEX IF NOT EXISTS idx_followup_schedule_original_outreach ON agent_followup_schedule(original_outreach_id);
CREATE INDEX IF NOT EXISTS idx_followup_schedule_due ON agent_followup_schedule(scheduled_for) WHERE status = 'scheduled';

-- RLS policies for agent_followup_schedule
ALTER TABLE agent_followup_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own follow-up schedules" ON agent_followup_schedule;
CREATE POLICY "Users can view own follow-up schedules" ON agent_followup_schedule
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_followup_schedule.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own follow-up schedules" ON agent_followup_schedule;
CREATE POLICY "Users can insert own follow-up schedules" ON agent_followup_schedule
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_followup_schedule.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own follow-up schedules" ON agent_followup_schedule;
CREATE POLICY "Users can update own follow-up schedules" ON agent_followup_schedule
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_followup_schedule.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own follow-up schedules" ON agent_followup_schedule;
CREATE POLICY "Users can delete own follow-up schedules" ON agent_followup_schedule
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_followup_schedule.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );
```

---

## Verify Migration

After running, verify the table was created:

```sql
-- Check if table exists
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'agent_followup_schedule';

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agent_followup_schedule';
```

---

## Other Migrations to Check

While you're at it, make sure these migrations have also been run:

1. ✅ `20250226000002_add_agent_outreach_sent_table.sql` - For tracking sent messages
2. ✅ `20250226000003_add_agent_followup_schedule_table.sql` - **This one** (the error you're seeing)
3. ✅ `20250226000004_fix_log_agent_activity_rls.sql` - RLS fix for activity logging
4. ✅ `20250226000005_enable_realtime_agent_tasks.sql` - Real-time replication (you already enabled this)

---

## After Running Migration

Once the migration is complete:
1. Refresh your application
2. The error should disappear
3. Follow-up Agent features should work
4. You can schedule and execute follow-ups

---

**File Location:** `supabase/migrations/20250226000003_add_agent_followup_schedule_table.sql`

