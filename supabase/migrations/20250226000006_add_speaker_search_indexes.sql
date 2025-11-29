-- Full-Text Search Indexes for Speaker Search
-- Enables fast full-text search across speaker tables

-- Full-text search on speaker_event_history
CREATE INDEX IF NOT EXISTS idx_speaker_history_name_fts ON speaker_event_history 
  USING gin(to_tsvector('english', 
    COALESCE(speaker_name, '') || ' ' || 
    COALESCE(speaker_org, '') || ' ' || 
    COALESCE(speaker_title, '') || ' ' || 
    COALESCE(talk_title, '') || ' ' || 
    COALESCE(session_name, '') || ' ' || 
    COALESCE(speech_title, '')
  ));

-- Full-text search on saved_speaker_profiles (JSONB fields)
CREATE INDEX IF NOT EXISTS idx_saved_profiles_name_fts ON saved_speaker_profiles 
  USING gin(to_tsvector('english', 
    COALESCE(speaker_data->>'name', '') || ' ' || 
    COALESCE(speaker_data->>'org', '') || ' ' || 
    COALESCE(speaker_data->>'title', '') || ' ' || 
    COALESCE(enhanced_data->>'bio', '') || ' ' ||
    COALESCE(enhanced_data->>'expertise_areas', '[]') || ' ' ||
    COALESCE(notes, '')
  ));

-- Full-text search on enhanced_speaker_profiles
CREATE INDEX IF NOT EXISTS idx_enhanced_profiles_name_fts ON enhanced_speaker_profiles 
  USING gin(to_tsvector('english', 
    COALESCE(speaker_name, '') || ' ' || 
    COALESCE(speaker_org, '') || ' ' || 
    COALESCE(speaker_title, '') || ' ' || 
    COALESCE(session_title, '') || ' ' ||
    COALESCE(enhanced_data->>'bio', '') || ' ' ||
    COALESCE(enhanced_data->>'expertise_areas', '[]')
  ));

-- Full-text search on account_speakers
CREATE INDEX IF NOT EXISTS idx_account_speakers_name_fts ON account_speakers 
  USING gin(to_tsvector('english', 
    COALESCE(speaker_name, '') || ' ' || 
    COALESCE(speaker_company, '') || ' ' || 
    COALESCE(speaker_title, '') || ' ' ||
    COALESCE(bio, '')
  ));

-- Add comments
COMMENT ON INDEX idx_speaker_history_name_fts IS 'Full-text search index for speaker_event_history (name, org, title, talk titles)';
COMMENT ON INDEX idx_saved_profiles_name_fts IS 'Full-text search index for saved_speaker_profiles (JSONB name, org, bio, expertise)';
COMMENT ON INDEX idx_enhanced_profiles_name_fts IS 'Full-text search index for enhanced_speaker_profiles (name, org, bio, expertise)';
COMMENT ON INDEX idx_account_speakers_name_fts IS 'Full-text search index for account_speakers (name, company, title, bio)';

