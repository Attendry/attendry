-- Create cache_entries table for L3 database caching
CREATE TABLE IF NOT EXISTS cache_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key VARCHAR(500) NOT NULL UNIQUE,
    cache_data TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    dependencies JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_entries_dependencies ON cache_entries USING GIN(dependencies);
CREATE INDEX IF NOT EXISTS idx_cache_entries_created_at ON cache_entries(created_at);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_cache_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_cache_entries_updated_at_trigger
    BEFORE UPDATE ON cache_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_cache_entries_updated_at();

-- Create function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache_entries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_entries 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired entries (if pg_cron is available)
-- This would be run every hour to clean up expired cache entries
-- SELECT cron.schedule('cleanup-expired-cache', '0 * * * *', 'SELECT cleanup_expired_cache_entries();');

-- Add comments for documentation
COMMENT ON TABLE cache_entries IS 'L3 database cache for storing search results, analysis data, and other cached information';
COMMENT ON COLUMN cache_entries.cache_key IS 'Unique cache key identifier';
COMMENT ON COLUMN cache_entries.cache_data IS 'Serialized cache data (JSON)';
COMMENT ON COLUMN cache_entries.expires_at IS 'Cache expiration timestamp';
COMMENT ON COLUMN cache_entries.dependencies IS 'Array of cache keys this entry depends on';
COMMENT ON COLUMN cache_entries.created_at IS 'When the cache entry was created';
COMMENT ON COLUMN cache_entries.updated_at IS 'When the cache entry was last updated';
