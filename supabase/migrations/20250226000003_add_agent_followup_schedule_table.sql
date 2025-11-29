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

