-- Phase 1: AI Agent System - Core Tables
-- Migration: 20250121000001
-- Creates tables for multi-agent system foundation

-- ============================================================================
-- Core Agent Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('outreach', 'followup', 'planning', 'research')),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'waiting_approval', 'paused', 'error')),
  config JSONB NOT NULL DEFAULT '{}',
  capabilities JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  UNIQUE(user_id, agent_type)
);

-- Indexes for ai_agents
CREATE INDEX IF NOT EXISTS idx_ai_agents_user_id ON ai_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_type ON ai_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents(status);
CREATE INDEX IF NOT EXISTS idx_ai_agents_user_type ON ai_agents(user_id, agent_type);

-- RLS policies for ai_agents
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agents" ON ai_agents;
CREATE POLICY "Users can view own agents" ON ai_agents
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own agents" ON ai_agents;
CREATE POLICY "Users can insert own agents" ON ai_agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own agents" ON ai_agents;
CREATE POLICY "Users can update own agents" ON ai_agents
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own agents" ON ai_agents;
CREATE POLICY "Users can delete own agents" ON ai_agents
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Agent Tasks Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  input_data JSONB NOT NULL,
  output_data JSONB,
  requires_approval BOOLEAN DEFAULT false,
  approved_by_user BOOLEAN,
  approved_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for agent_tasks
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_requires_approval ON agent_tasks(requires_approval) WHERE requires_approval = true;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned_at ON agent_tasks(assigned_at DESC);

-- RLS policies for agent_tasks
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agent tasks" ON agent_tasks;
CREATE POLICY "Users can view own agent tasks" ON agent_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_tasks.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own agent tasks" ON agent_tasks;
CREATE POLICY "Users can insert own agent tasks" ON agent_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_tasks.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own agent tasks" ON agent_tasks;
CREATE POLICY "Users can update own agent tasks" ON agent_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_tasks.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Messages Table (for Phase 3, but created now for schema consistency)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  to_agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('request', 'response', 'notification', 'escalation')),
  payload JSONB NOT NULL,
  requires_response BOOLEAN DEFAULT false,
  response_to_id UUID REFERENCES agent_messages(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

-- Indexes for agent_messages
CREATE INDEX IF NOT EXISTS idx_agent_messages_from ON agent_messages(from_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_type ON agent_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_unread ON agent_messages(to_agent_id, read_at) WHERE read_at IS NULL;

-- RLS policies for agent_messages
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agent messages" ON agent_messages;
CREATE POLICY "Users can view own agent messages" ON agent_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE (ai_agents.id = agent_messages.from_agent_id OR ai_agents.id = agent_messages.to_agent_id)
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Outreach Drafts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_outreach_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES saved_speaker_profiles(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES user_opportunities(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'other')),
  subject TEXT,
  message_body TEXT NOT NULL,
  personalization_context JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  rejection_reason TEXT
);

-- Indexes for agent_outreach_drafts
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_agent_id ON agent_outreach_drafts(agent_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_contact_id ON agent_outreach_drafts(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_opportunity_id ON agent_outreach_drafts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_status ON agent_outreach_drafts(status);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_pending_approval ON agent_outreach_drafts(agent_id, status) WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_created ON agent_outreach_drafts(created_at DESC);

-- RLS policies for agent_outreach_drafts
ALTER TABLE agent_outreach_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own outreach drafts" ON agent_outreach_drafts;
CREATE POLICY "Users can view own outreach drafts" ON agent_outreach_drafts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_outreach_drafts.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own outreach drafts" ON agent_outreach_drafts;
CREATE POLICY "Users can insert own outreach drafts" ON agent_outreach_drafts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_outreach_drafts.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own outreach drafts" ON agent_outreach_drafts;
CREATE POLICY "Users can update own outreach drafts" ON agent_outreach_drafts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_outreach_drafts.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Activity Log Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_activity_log
CREATE INDEX IF NOT EXISTS idx_activity_log_agent_id ON agent_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_task_id ON agent_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON agent_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON agent_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_agent_created ON agent_activity_log(agent_id, created_at DESC);

-- RLS policies for agent_activity_log
ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agent activity" ON agent_activity_log;
CREATE POLICY "Users can view own agent activity" ON agent_activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_activity_log.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Agent Performance Metrics Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,
  response_rate DECIMAL(5,2),
  average_response_time_hours DECIMAL(10,2),
  opportunities_identified INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, metric_date)
);

-- Indexes for agent_performance_metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent_id ON agent_performance_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_date ON agent_performance_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_agent_date ON agent_performance_metrics(agent_id, metric_date DESC);

-- RLS policies for agent_performance_metrics
ALTER TABLE agent_performance_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agent metrics" ON agent_performance_metrics;
CREATE POLICY "Users can view own agent metrics" ON agent_performance_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_performance_metrics.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to update agent last_active_at
CREATE OR REPLACE FUNCTION update_agent_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_agents
  SET last_active_at = NOW()
  WHERE id = NEW.agent_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_active_at on task creation/update
DROP TRIGGER IF EXISTS update_agent_last_active_on_task ON agent_tasks;
CREATE TRIGGER update_agent_last_active_on_task
  AFTER INSERT OR UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_last_active();

-- Function to log agent activity
CREATE OR REPLACE FUNCTION log_agent_activity(
  p_agent_id UUID,
  p_task_id UUID,
  p_action_type TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO agent_activity_log (agent_id, task_id, action_type, description, metadata)
  VALUES (p_agent_id, p_task_id, p_action_type, p_description, p_metadata)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;


