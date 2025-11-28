-- Contact Research and Preferences Enhancement
-- Migration: 20250226000001
-- Adds persistent contact research, monitoring, and preferences to saved_speaker_profiles

-- ============================================================================
-- Contact Research Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS contact_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES saved_speaker_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Research data
  background_info TEXT,
  grounding_links JSONB DEFAULT '[]'::jsonb, -- Array of {title: string, url: string}
  last_research_date TIMESTAMPTZ,
  
  -- Update monitoring
  has_new_intel BOOLEAN DEFAULT false,
  new_intel_summary TEXT,
  last_checked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One research record per contact (upsert pattern)
  UNIQUE(contact_id)
);

-- Indexes for contact_research
CREATE INDEX IF NOT EXISTS idx_contact_research_contact_id ON contact_research(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_research_user_id ON contact_research(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_research_new_intel ON contact_research(user_id, has_new_intel) WHERE has_new_intel = true;
CREATE INDEX IF NOT EXISTS idx_contact_research_last_checked ON contact_research(last_checked_at DESC);

-- RLS policies for contact_research
ALTER TABLE contact_research ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contact research" ON contact_research
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contact research" ON contact_research
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contact research" ON contact_research
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contact research" ON contact_research
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Add Preferences and Monitoring Columns to saved_speaker_profiles
-- ============================================================================
ALTER TABLE saved_speaker_profiles 
  ADD COLUMN IF NOT EXISTS preferred_language TEXT CHECK (preferred_language IN ('English', 'German')),
  ADD COLUMN IF NOT EXISTS preferred_tone TEXT CHECK (preferred_tone IN ('Formal', 'Informal')),
  ADD COLUMN IF NOT EXISTS preferred_channel TEXT CHECK (preferred_channel IN ('email', 'linkedin', 'other')),
  ADD COLUMN IF NOT EXISTS reminder_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monitor_updates BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_contacted_date TIMESTAMPTZ;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_saved_profiles_archived ON saved_speaker_profiles(user_id, archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_saved_profiles_monitor ON saved_speaker_profiles(user_id, monitor_updates) WHERE monitor_updates = true;
CREATE INDEX IF NOT EXISTS idx_saved_profiles_reminder ON saved_speaker_profiles(user_id, reminder_date) WHERE reminder_date IS NOT NULL;

-- ============================================================================
-- Update Trigger for contact_research
-- ============================================================================
-- Create a specific function for contact_research that sets updated_at (not last_updated)
CREATE OR REPLACE FUNCTION update_contact_research_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_research_updated_at
  BEFORE UPDATE ON contact_research
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_research_updated_at();

-- ============================================================================
-- Helper Function: Get contacts needing follow-up
-- ============================================================================
CREATE OR REPLACE FUNCTION get_contacts_needing_followup(p_user_id UUID)
RETURNS TABLE (
  contact_id UUID,
  name TEXT,
  company TEXT,
  reminder_date TIMESTAMPTZ,
  days_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ssp.id,
    ssp.speaker_data->>'name' AS name,
    ssp.speaker_data->>'org' AS company,
    ssp.reminder_date,
    EXTRACT(DAY FROM (NOW() - ssp.reminder_date))::INTEGER AS days_overdue
  FROM saved_speaker_profiles ssp
  WHERE ssp.user_id = p_user_id
    AND ssp.archived = false
    AND ssp.reminder_date IS NOT NULL
    AND ssp.reminder_date <= NOW()
  ORDER BY ssp.reminder_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper Function: Get contacts with new intel
-- ============================================================================
CREATE OR REPLACE FUNCTION get_contacts_with_new_intel(p_user_id UUID)
RETURNS TABLE (
  contact_id UUID,
  name TEXT,
  company TEXT,
  new_intel_summary TEXT,
  last_checked_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ssp.id,
    ssp.speaker_data->>'name' AS name,
    ssp.speaker_data->>'org' AS company,
    cr.new_intel_summary,
    cr.last_checked_at
  FROM saved_speaker_profiles ssp
  INNER JOIN contact_research cr ON cr.contact_id = ssp.id
  WHERE ssp.user_id = p_user_id
    AND ssp.archived = false
    AND cr.has_new_intel = true
  ORDER BY cr.last_checked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON contact_research TO authenticated;
GRANT EXECUTE ON FUNCTION get_contacts_needing_followup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_contacts_with_new_intel(UUID) TO authenticated;

