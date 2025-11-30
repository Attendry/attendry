-- Create saved_searches table for user-saved search queries
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT,
  filters JSONB DEFAULT '{}', -- { country, dateFrom, dateTo, keywords, etc. }
  is_pinned BOOLEAN DEFAULT false,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_pinned ON saved_searches(user_id, is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_updated ON saved_searches(user_id, updated_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/modify their own saved searches
CREATE POLICY "saved_searches read own" ON saved_searches 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "saved_searches insert own" ON saved_searches 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_searches update own" ON saved_searches 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "saved_searches delete own" ON saved_searches 
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_searches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_searches_updated_at();

