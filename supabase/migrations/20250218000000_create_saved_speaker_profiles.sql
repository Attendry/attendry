-- Saved Speaker Profiles
-- Stores user-saved speaker profiles for outreach and relationship management

CREATE TABLE IF NOT EXISTS saved_speaker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  speaker_data JSONB NOT NULL,
  enhanced_data JSONB NOT NULL,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  outreach_status TEXT DEFAULT 'not_started' CHECK (outreach_status IN ('not_started', 'contacted', 'responded', 'meeting_scheduled')),
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint to prevent duplicate profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_speaker_profiles_unique 
ON saved_speaker_profiles(user_id, (speaker_data->>'name'), (speaker_data->>'org'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_saved_speaker_profiles_user_id ON saved_speaker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_speaker_profiles_outreach_status ON saved_speaker_profiles(outreach_status);
CREATE INDEX IF NOT EXISTS idx_saved_speaker_profiles_saved_at ON saved_speaker_profiles(saved_at);
CREATE INDEX IF NOT EXISTS idx_saved_speaker_profiles_tags ON saved_speaker_profiles USING GIN(tags);

-- Ensure the updated_at trigger helper exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saved_speaker_profiles_updated_at
    BEFORE UPDATE ON saved_speaker_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE saved_speaker_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their saved speaker profiles" ON saved_speaker_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their saved speaker profiles" ON saved_speaker_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved speaker profiles" ON saved_speaker_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved speaker profiles" ON saved_speaker_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON saved_speaker_profiles TO authenticated;
