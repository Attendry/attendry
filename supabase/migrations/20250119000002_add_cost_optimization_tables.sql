-- Phase 1: Cost Optimization Tables (V2 - Gap 8)
-- Migration: 20250119000002
-- Creates shared query cache and cost tracking for discovery runs

-- Cost tracking table
CREATE TABLE IF NOT EXISTS discovery_cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  discovery_run_id UUID REFERENCES discovery_run_logs(id) ON DELETE SET NULL,
  api_calls INTEGER DEFAULT 0,
  cost_estimate DECIMAL(10,2) DEFAULT 0, -- Estimated cost in USD
  cache_hits INTEGER DEFAULT 0,
  cache_savings DECIMAL(10,2) DEFAULT 0, -- Estimated savings from cache hits
  run_date DATE DEFAULT CURRENT_DATE
);

-- Performance indexes for cost tracking
CREATE INDEX IF NOT EXISTS idx_cost_tracking_date ON discovery_cost_tracking(run_date, user_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_user ON discovery_cost_tracking(user_id, run_date DESC);

-- RLS policies for cost tracking
ALTER TABLE discovery_cost_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cost tracking" ON discovery_cost_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert cost tracking" ON discovery_cost_tracking
  FOR INSERT WITH CHECK (true);

-- Shared query cache (multi-user cache for cost optimization)
CREATE TABLE IF NOT EXISTS shared_query_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL, -- Hash of query + region
  query_text TEXT NOT NULL,
  region TEXT,
  results JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0,
  UNIQUE(query_hash, region)
);

-- Performance indexes for shared cache
CREATE INDEX IF NOT EXISTS idx_shared_cache_expires ON shared_query_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_shared_cache_hash ON shared_query_cache(query_hash, region);
CREATE INDEX IF NOT EXISTS idx_shared_cache_hits ON shared_query_cache(hit_count DESC);

-- RLS policies for shared cache (public read, service write)
ALTER TABLE shared_query_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared cache" ON shared_query_cache
  FOR SELECT USING (true);

CREATE POLICY "Service can insert shared cache" ON shared_query_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update shared cache" ON shared_query_cache
  FOR UPDATE USING (true);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM shared_query_cache
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

