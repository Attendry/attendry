-- Migration: 20250226000002
-- Add agent_outreach_sent table to track sent messages
-- This table stores records of messages that have been sent (via email/LinkedIn)

-- ============================================================================
-- Agent Outreach Sent Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_outreach_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES agent_outreach_drafts(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES saved_speaker_profiles(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES user_opportunities(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'other')),
  recipient_email TEXT,
  recipient_name TEXT,
  subject TEXT,
  message_body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for agent_outreach_sent
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sent_agent_id ON agent_outreach_sent(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sent_contact_id ON agent_outreach_sent(contact_id);
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sent_draft_id ON agent_outreach_sent(draft_id);
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sent_sent_at ON agent_outreach_sent(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sent_delivery_status ON agent_outreach_sent(delivery_status);
CREATE INDEX IF NOT EXISTS idx_agent_outreach_sent_opportunity_id ON agent_outreach_sent(opportunity_id);

-- RLS policies for agent_outreach_sent
ALTER TABLE agent_outreach_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sent messages" ON agent_outreach_sent;
CREATE POLICY "Users can view own sent messages" ON agent_outreach_sent
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_outreach_sent.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own sent messages" ON agent_outreach_sent;
CREATE POLICY "Users can insert own sent messages" ON agent_outreach_sent
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_outreach_sent.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own sent messages" ON agent_outreach_sent;
CREATE POLICY "Users can update own sent messages" ON agent_outreach_sent
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_outreach_sent.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Helper function to update delivery status
-- ============================================================================
CREATE OR REPLACE FUNCTION update_outreach_delivery_status(
  p_sent_id UUID,
  p_status TEXT,
  p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE agent_outreach_sent
  SET 
    delivery_status = p_status,
    delivered_at = CASE WHEN p_status = 'delivered' THEN p_timestamp ELSE delivered_at END,
    opened_at = CASE WHEN p_status = 'opened' THEN p_timestamp ELSE opened_at END,
    clicked_at = CASE WHEN p_status = 'clicked' THEN p_timestamp ELSE clicked_at END,
    bounced_at = CASE WHEN p_status = 'bounced' THEN p_timestamp ELSE bounced_at END
  WHERE id = p_sent_id;
END;
$$;

