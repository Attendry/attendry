-- Enhanced Speaker Profiles
-- Stores AI-enriched speaker information captured from EnhancedSpeakerCard flows

CREATE TABLE IF NOT EXISTS enhanced_speaker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  speaker_key TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  speaker_org TEXT,
  speaker_title TEXT,
  session_title TEXT,
  profile_url TEXT,
  raw_input JSONB NOT NULL,
  enhanced_data JSONB NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  last_enhanced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, speaker_key)
);

CREATE INDEX IF NOT EXISTS idx_enhanced_speaker_profiles_user_id ON enhanced_speaker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_speaker_profiles_speaker_key ON enhanced_speaker_profiles(speaker_key);

-- Ensure the updated_at trigger helper exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_enhanced_speaker_profiles_updated_at
    BEFORE UPDATE ON enhanced_speaker_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE enhanced_speaker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their enhanced speaker profiles" ON enhanced_speaker_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their enhanced speaker profiles" ON enhanced_speaker_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their enhanced speaker profiles" ON enhanced_speaker_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their enhanced speaker profiles" ON enhanced_speaker_profiles
  FOR DELETE USING (auth.uid() = user_id);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON enhanced_speaker_profiles TO authenticated;

