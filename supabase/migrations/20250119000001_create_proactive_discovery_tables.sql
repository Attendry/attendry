-- Phase 0: Proactive Discovery Architecture - Core Tables
-- Migration: 20250119000001
-- Creates core tables for opportunity discovery system

-- Core table: User Opportunities (replaces ad-hoc search)
CREATE TABLE IF NOT EXISTS user_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES collected_events(id) ON DELETE CASCADE,
  
  -- Signal data
  target_accounts_attending INTEGER DEFAULT 0,
  icp_matches INTEGER DEFAULT 0,
  competitor_presence BOOLEAN DEFAULT false,
  account_connections JSONB DEFAULT '[]'::jsonb,
  
  -- Relevance
  relevance_score INTEGER NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 100),
  relevance_reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  signal_strength TEXT NOT NULL CHECK (signal_strength IN ('strong', 'medium', 'weak')),
  
  -- User engagement
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'saved', 'actioned', 'dismissed')),
  dismissal_reason TEXT CHECK (dismissal_reason IN ('not_icp', 'irrelevant_event', 'already_know', 'bad_match')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  actioned_at TIMESTAMPTZ,
  
  -- Metadata
  discovery_method TEXT CHECK (discovery_method IN ('profile_match', 'account_match', 'watchlist_match', 'smart_backfill')),
  last_enriched_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, event_id)
);

-- Performance indexes for user_opportunities
CREATE INDEX IF NOT EXISTS idx_user_opps_relevance ON user_opportunities(user_id, relevance_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_opps_status ON user_opportunities(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_opps_signals ON user_opportunities(user_id, signal_strength, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_opps_event ON user_opportunities(event_id);
CREATE INDEX IF NOT EXISTS idx_user_opps_created ON user_opportunities(created_at DESC);

-- RLS policies for user_opportunities
ALTER TABLE user_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own opportunities" ON user_opportunities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own opportunities" ON user_opportunities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own opportunities" ON user_opportunities
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own opportunities" ON user_opportunities
  FOR DELETE USING (auth.uid() = user_id);

-- Discovery profiles (defines what to look for)
CREATE TABLE IF NOT EXISTS user_discovery_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What to look for
  industries TEXT[] DEFAULT ARRAY[]::TEXT[],
  event_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  regions TEXT[] DEFAULT ARRAY[]::TEXT[],
  date_range_days INTEGER DEFAULT 90 CHECK (date_range_days > 0),
  
  -- Who to look for
  target_titles TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_companies TEXT[] DEFAULT ARRAY[]::TEXT[], -- The Watchlist
  competitors TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Discovery settings
  discovery_frequency TEXT DEFAULT 'daily' CHECK (discovery_frequency IN ('hourly', 'daily', 'weekly')),
  min_relevance_score INTEGER DEFAULT 50 CHECK (min_relevance_score >= 0 AND min_relevance_score <= 100),
  enable_critical_alerts BOOLEAN DEFAULT true,
  
  -- Last run
  last_discovery_run TIMESTAMPTZ,
  last_discovery_events_found INTEGER DEFAULT 0,
  last_discovery_opportunities_created INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Performance indexes for user_discovery_profiles
CREATE INDEX IF NOT EXISTS idx_discovery_profiles_user ON user_discovery_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_profiles_frequency ON user_discovery_profiles(discovery_frequency, last_discovery_run);

-- RLS policies for user_discovery_profiles
ALTER TABLE user_discovery_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own discovery profile" ON user_discovery_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own discovery profile" ON user_discovery_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discovery profile" ON user_discovery_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own discovery profile" ON user_discovery_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_discovery_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER update_user_discovery_profiles_updated_at
  BEFORE UPDATE ON user_discovery_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_discovery_profiles_updated_at();

-- Discovery run logs (track what was searched)
CREATE TABLE IF NOT EXISTS discovery_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES user_discovery_profiles(id) ON DELETE CASCADE,
  
  -- Run details
  run_at TIMESTAMPTZ DEFAULT NOW(),
  duration_ms INTEGER,
  
  -- Query used
  query_used TEXT,
  search_params JSONB,
  
  -- Results
  events_discovered INTEGER DEFAULT 0,
  opportunities_created INTEGER DEFAULT 0,
  opportunities_high_signal INTEGER DEFAULT 0,
  
  -- Performance
  api_calls INTEGER DEFAULT 0,
  cache_hit_rate DECIMAL(5,2),
  
  -- Status
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes for discovery_run_logs
CREATE INDEX IF NOT EXISTS idx_discovery_logs_user ON discovery_run_logs(user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_logs_profile ON discovery_run_logs(profile_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_logs_status ON discovery_run_logs(status, run_at DESC);

-- RLS policies for discovery_run_logs
ALTER TABLE discovery_run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own discovery logs" ON discovery_run_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert discovery logs" ON discovery_run_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Event lifecycle tracking (Gap 3 - Phase 1)
CREATE TABLE IF NOT EXISTS event_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES collected_events(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('speaker_added', 'speaker_removed', 'date_changed', 'venue_changed', 'description_changed')),
  old_value JSONB,
  new_value JSONB,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes for event_lifecycle_events
CREATE INDEX IF NOT EXISTS idx_lifecycle_events ON event_lifecycle_events(event_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_type ON event_lifecycle_events(event_type, detected_at DESC);

-- RLS policies for event_lifecycle_events (public read, service write)
ALTER TABLE event_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lifecycle events" ON event_lifecycle_events
  FOR SELECT USING (true);

CREATE POLICY "Service can insert lifecycle events" ON event_lifecycle_events
  FOR INSERT WITH CHECK (true);

