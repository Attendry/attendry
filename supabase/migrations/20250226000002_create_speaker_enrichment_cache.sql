-- Speaker Enrichment Cache
-- Global cache for speaker enrichment data to reduce API costs
-- Cache key: normalized name + normalized org (shared across all users)
-- TTL: 30 days

CREATE TABLE IF NOT EXISTS speaker_enrichment_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL, -- Normalized: name|org
  normalized_name TEXT NOT NULL,
  normalized_org TEXT,
  speaker_name TEXT NOT NULL, -- Original name for reference
  speaker_org TEXT, -- Original org for reference
  enhanced_data JSONB NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Track cache hits for analytics
  cache_hits INT DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_speaker_cache_key ON speaker_enrichment_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_speaker_cache_expires ON speaker_enrichment_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_speaker_cache_normalized_name ON speaker_enrichment_cache(normalized_name);
CREATE INDEX IF NOT EXISTS idx_speaker_cache_normalized_org ON speaker_enrichment_cache(normalized_org) WHERE normalized_org IS NOT NULL;

-- Composite index for name+org lookup
CREATE INDEX IF NOT EXISTS idx_speaker_cache_name_org ON speaker_enrichment_cache(normalized_name, normalized_org);

-- Function to update last_accessed_at and increment cache_hits
CREATE OR REPLACE FUNCTION update_speaker_cache_access()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_accessed_at = NOW();
  NEW.cache_hits = OLD.cache_hits + 1;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update access tracking on SELECT (via UPDATE)
-- Note: We'll handle this in application code for better control

-- Updated_at trigger
CREATE TRIGGER update_speaker_enrichment_cache_updated_at
  BEFORE UPDATE ON speaker_enrichment_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_speaker_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM speaker_enrichment_cache
  WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- Enable Row Level Security
ALTER TABLE speaker_enrichment_cache ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read from cache (global read access)
CREATE POLICY "Anyone can read speaker enrichment cache" ON speaker_enrichment_cache
  FOR SELECT USING (true);

-- Policy: Authenticated users can insert/update cache entries (for API routes)
-- Note: API routes run with service role, but this allows authenticated users too
CREATE POLICY "Authenticated users can manage cache" ON speaker_enrichment_cache
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON speaker_enrichment_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON speaker_enrichment_cache TO service_role;

-- Add comment
COMMENT ON TABLE speaker_enrichment_cache IS 'Global cache for speaker enrichment data. Reduces API costs by caching enriched speaker profiles for 30 days. Cache key is normalized name + org.';

