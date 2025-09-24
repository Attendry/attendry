-- Create search_cache table for caching search results
CREATE TABLE IF NOT EXISTS search_cache (
  id BIGSERIAL PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  schema_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ttl_at TIMESTAMPTZ NOT NULL
);

-- Create index for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_search_cache_key ON search_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_search_cache_ttl ON search_cache(ttl_at);

-- Note: TTL cleanup index removed due to NOW() not being immutable
-- Cleanup will be handled by the cron job using WHERE ttl_at < NOW()

-- Add RLS (Row Level Security) policies
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage cache (for cron jobs and API)
CREATE POLICY "Service role can manage search cache" ON search_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read cache
CREATE POLICY "Authenticated users can read search cache" ON search_cache
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to write cache (for API endpoints)
CREATE POLICY "Authenticated users can write search cache" ON search_cache
  FOR INSERT USING (auth.role() = 'authenticated');

-- Allow authenticated users to update cache
CREATE POLICY "Authenticated users can update search cache" ON search_cache
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete cache (for cleanup)
CREATE POLICY "Authenticated users can delete search cache" ON search_cache
  FOR DELETE USING (auth.role() = 'authenticated');
