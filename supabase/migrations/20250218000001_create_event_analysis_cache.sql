-- Create event analysis cache table
CREATE TABLE IF NOT EXISTS event_analysis_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url_hash TEXT NOT NULL UNIQUE,
  event_url TEXT NOT NULL,
  analysis_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_analysis_cache_url_hash ON event_analysis_cache(url_hash);
CREATE INDEX IF NOT EXISTS idx_event_analysis_cache_created_at ON event_analysis_cache(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_analysis_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_event_analysis_cache_updated_at_trigger
  BEFORE UPDATE ON event_analysis_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_event_analysis_cache_updated_at();

-- Add RLS policies
ALTER TABLE event_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read cache
CREATE POLICY "Allow authenticated users to read event analysis cache" ON event_analysis_cache
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update cache
CREATE POLICY "Allow authenticated users to manage event analysis cache" ON event_analysis_cache
  FOR ALL USING (auth.role() = 'authenticated');
