-- PHASE 2 OPTIMIZATION: Speaker Event History Table
-- Migration: 20250221000004
-- Enables cross-event speaker tracking and history queries

-- Speaker event history table
CREATE TABLE IF NOT EXISTS speaker_event_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Speaker identification (canonical key based on normalized name + org)
  speaker_key TEXT NOT NULL, -- hash(normalizedName + normalizedOrg)
  speaker_name TEXT NOT NULL,
  speaker_org TEXT,
  speaker_title TEXT,
  
  -- Event relationship
  event_id UUID REFERENCES collected_events(id) ON DELETE CASCADE,
  
  -- Speaker context for this event
  talk_title TEXT,
  session_name TEXT,
  speech_title TEXT, -- Alias for talk_title for compatibility
  
  -- Metadata
  appeared_at TIMESTAMPTZ DEFAULT NOW(),
  confidence DECIMAL(3,2), -- Confidence of speaker extraction (0.00 to 1.00)
  
  -- Prevent duplicate entries
  UNIQUE(speaker_key, event_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_speaker_history_key ON speaker_event_history(speaker_key);
CREATE INDEX IF NOT EXISTS idx_speaker_history_event ON speaker_event_history(event_id);
CREATE INDEX IF NOT EXISTS idx_speaker_history_appeared ON speaker_event_history(appeared_at DESC);
CREATE INDEX IF NOT EXISTS idx_speaker_history_name_org ON speaker_event_history(speaker_name, speaker_org);

-- Composite index for common queries (speaker history by key, ordered by date)
CREATE INDEX IF NOT EXISTS idx_speaker_history_key_appeared ON speaker_event_history(speaker_key, appeared_at DESC);

-- RLS policies
ALTER TABLE speaker_event_history ENABLE ROW LEVEL SECURITY;

-- Users can view speaker history (public data)
CREATE POLICY "Users can view speaker history" ON speaker_event_history
  FOR SELECT USING (true);

-- Service can insert speaker history
CREATE POLICY "Service can insert speaker history" ON speaker_event_history
  FOR INSERT WITH CHECK (true);

-- Service can update speaker history
CREATE POLICY "Service can update speaker history" ON speaker_event_history
  FOR UPDATE USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON speaker_event_history TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE speaker_event_history IS 'PHASE 2: Tracks speaker appearances across events for cross-event queries and history';
COMMENT ON COLUMN speaker_event_history.speaker_key IS 'Canonical key: hash(normalizedName + normalizedOrg) for fuzzy matching';
COMMENT ON COLUMN speaker_event_history.appeared_at IS 'When this speaker-event relationship was recorded';
COMMENT ON COLUMN speaker_event_history.confidence IS 'Confidence score of speaker extraction (0.00 to 1.00)';



