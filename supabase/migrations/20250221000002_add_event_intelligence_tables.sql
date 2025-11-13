-- Add Event Intelligence and Trend Analysis Cache Tables
-- Migration: 20250221000002

-- Event intelligence table (references collected_events)
CREATE TABLE IF NOT EXISTS event_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES collected_events(id) ON DELETE CASCADE,
  discussions JSONB,
  sponsors JSONB,
  location JSONB,
  outreach JSONB,
  confidence DECIMAL(3,2),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  user_profile_hash TEXT, -- Hash of user profile for personalized insights
  UNIQUE(event_id, user_profile_hash) -- Allow different insights per user profile
);

-- Trend analysis cache
CREATE TABLE IF NOT EXISTS trend_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE, -- Format: "trends:{timeWindow}:{userProfileHash}"
  time_window TEXT NOT NULL,
  user_profile_hash TEXT, -- NULL for global trends
  category TEXT,
  hot_topics JSONB,
  emerging_themes JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_intelligence_event_id ON event_intelligence(event_id);
CREATE INDEX IF NOT EXISTS idx_event_intelligence_expires_at ON event_intelligence(expires_at);
CREATE INDEX IF NOT EXISTS idx_event_intelligence_user_hash ON event_intelligence(user_profile_hash);
CREATE INDEX IF NOT EXISTS idx_trend_analysis_cache_key ON trend_analysis_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_trend_analysis_window ON trend_analysis_cache(time_window, user_profile_hash);
CREATE INDEX IF NOT EXISTS idx_trend_analysis_expires_at ON trend_analysis_cache(expires_at);

-- RLS policies
ALTER TABLE event_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Users can view event intelligence (events are public, intelligence can be shared)
CREATE POLICY "Users can view event intelligence" ON event_intelligence
  FOR SELECT USING (true);

-- Users can insert their own event intelligence (for caching)
CREATE POLICY "Users can insert event intelligence" ON event_intelligence
  FOR INSERT WITH CHECK (true);

-- Users can view trend analysis
CREATE POLICY "Users can view trend analysis" ON trend_analysis_cache
  FOR SELECT USING (true);

-- Users can insert trend analysis cache
CREATE POLICY "Users can insert trend analysis cache" ON trend_analysis_cache
  FOR INSERT WITH CHECK (true);

-- Intelligence queue table for background processing
CREATE TABLE IF NOT EXISTS intelligence_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_intelligence_queue_status ON intelligence_queue(status);
CREATE INDEX IF NOT EXISTS idx_intelligence_queue_priority ON intelligence_queue(priority DESC, queued_at ASC);
CREATE INDEX IF NOT EXISTS idx_intelligence_queue_event_id ON intelligence_queue(event_id);

-- RLS for intelligence_queue
ALTER TABLE intelligence_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view intelligence queue" ON intelligence_queue
  FOR SELECT USING (true);

CREATE POLICY "Service can manage intelligence queue" ON intelligence_queue
  FOR ALL USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON event_intelligence TO authenticated;
GRANT SELECT, INSERT, UPDATE ON trend_analysis_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE ON intelligence_queue TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE event_intelligence IS 'Pre-computed event intelligence including discussions, sponsors, location, and outreach recommendations';
COMMENT ON TABLE trend_analysis_cache IS 'Cached trend analysis results with hot topics and emerging themes';
COMMENT ON TABLE intelligence_queue IS 'Queue for background intelligence generation';
COMMENT ON COLUMN event_intelligence.user_profile_hash IS 'Hash of user profile for personalized insights (NULL for general insights)';
COMMENT ON COLUMN trend_analysis_cache.cache_key IS 'Unique cache key: trends:{timeWindow}:{userProfileHash}';

