-- Auto-Save Feedback Features
-- Adds tracking for auto-save events, notifications, and undo functionality

-- Add columns to saved_speaker_profiles for auto-save tracking
ALTER TABLE saved_speaker_profiles
ADD COLUMN IF NOT EXISTS auto_saved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_save_event_id UUID REFERENCES collected_events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS auto_save_reasons JSONB DEFAULT '[]'::jsonb, -- Array of reasons why it was auto-saved
ADD COLUMN IF NOT EXISTS can_undo_until TIMESTAMPTZ, -- Timestamp until which undo is allowed (24 hours from auto_saved_at)
ADD COLUMN IF NOT EXISTS undo_requested_at TIMESTAMPTZ;

-- Create index for querying auto-saved contacts
CREATE INDEX IF NOT EXISTS idx_saved_profiles_auto_saved ON saved_speaker_profiles(user_id, auto_saved_at DESC) WHERE auto_saved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_profiles_auto_save_event ON saved_speaker_profiles(auto_save_event_id) WHERE auto_save_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_profiles_can_undo ON saved_speaker_profiles(user_id, can_undo_until) WHERE can_undo_until IS NOT NULL AND undo_requested_at IS NULL;

-- Create auto-save events table for batch tracking
CREATE TABLE IF NOT EXISTS auto_save_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES collected_events(id) ON DELETE CASCADE,
  speakers_saved INTEGER DEFAULT 0,
  speakers_processed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed', 'partial')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for auto_save_events
CREATE INDEX IF NOT EXISTS idx_auto_save_events_user ON auto_save_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_save_events_event ON auto_save_events(event_id);
CREATE INDEX IF NOT EXISTS idx_auto_save_events_status ON auto_save_events(status, created_at DESC);

-- RLS policies for auto_save_events
ALTER TABLE auto_save_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own auto-save events" ON auto_save_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage auto-save events" ON auto_save_events
  FOR ALL USING (true);

-- Function to get auto-saved count for an event
CREATE OR REPLACE FUNCTION get_event_auto_saved_count(p_event_id UUID, p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM saved_speaker_profiles
  WHERE auto_save_event_id = p_event_id
    AND user_id = p_user_id
    AND auto_saved_at IS NOT NULL
    AND deleted_at IS NULL;
  
  RETURN COALESCE(count, 0);
END;
$$;

-- Function to get today's auto-saved contacts
CREATE OR REPLACE FUNCTION get_today_auto_saved_contacts(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  speaker_data JSONB,
  enhanced_data JSONB,
  auto_saved_at TIMESTAMPTZ,
  auto_save_event_id UUID,
  auto_save_reasons JSONB,
  can_undo_until TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ssp.id,
    ssp.speaker_data,
    ssp.enhanced_data,
    ssp.auto_saved_at,
    ssp.auto_save_event_id,
    ssp.auto_save_reasons,
    ssp.can_undo_until
  FROM saved_speaker_profiles ssp
  WHERE ssp.user_id = p_user_id
    AND ssp.auto_saved_at IS NOT NULL
    AND DATE(ssp.auto_saved_at) = CURRENT_DATE
    AND ssp.deleted_at IS NULL
    AND ssp.undo_requested_at IS NULL
  ORDER BY ssp.auto_saved_at DESC;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON auto_save_events TO authenticated;

-- Add comments
COMMENT ON TABLE auto_save_events IS 'Tracks batch auto-save operations for notifications and feedback';
COMMENT ON COLUMN saved_speaker_profiles.auto_saved_at IS 'Timestamp when contact was auto-saved';
COMMENT ON COLUMN saved_speaker_profiles.auto_save_event_id IS 'Event ID from which this contact was auto-saved';
COMMENT ON COLUMN saved_speaker_profiles.auto_save_reasons IS 'Array of reasons why this speaker was auto-saved (e.g., ["target_title", "target_company"])';
COMMENT ON COLUMN saved_speaker_profiles.can_undo_until IS 'Timestamp until which user can undo auto-save (24 hours from auto_saved_at)';
COMMENT ON COLUMN saved_speaker_profiles.undo_requested_at IS 'Timestamp when user requested undo (marks contact for deletion)';

