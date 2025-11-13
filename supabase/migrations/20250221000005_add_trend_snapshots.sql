-- PHASE 2 OPTIMIZATION: Trend Snapshot Rollups
-- Migration: 20250221000005
-- Enables time-series trend analysis with growth rate calculations

-- Trend snapshots table
CREATE TABLE IF NOT EXISTS trend_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Snapshot metadata
  snapshot_date DATE NOT NULL,
  time_window TEXT NOT NULL CHECK (time_window IN ('week', 'month', 'quarter', 'year')),
  taxonomy_version TEXT NOT NULL DEFAULT '1.0',
  
  -- Topic trends (normalized topics from taxonomy)
  topic_frequencies JSONB NOT NULL DEFAULT '{}', -- {topic_id: count, ...}
  topic_growth_rates JSONB DEFAULT '{}', -- {topic_id: growth_pct, ...}
  
  -- Sponsor trends
  sponsor_tiers JSONB DEFAULT '{}', -- {platinum: count, gold: count, silver: count, bronze: count, ...}
  sponsor_industries JSONB DEFAULT '{}', -- {industry: count, ...}
  
  -- Organization trends
  org_types JSONB DEFAULT '{}', -- {type: count, ...}
  org_sectors JSONB DEFAULT '{}', -- {sector: count, ...}
  
  -- Event trends
  event_count INTEGER DEFAULT 0,
  avg_attendees INTEGER, -- If available
  avg_speakers_per_event DECIMAL(5,2),
  
  -- Geographic trends
  top_cities JSONB DEFAULT '[]', -- [{city: string, count: number}, ...]
  top_countries JSONB DEFAULT '[]', -- [{country: string, count: number}, ...]
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate snapshots for same date/window
  UNIQUE(snapshot_date, time_window)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_date ON trend_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_window ON trend_snapshots(time_window, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_window_date ON trend_snapshots(time_window, snapshot_date DESC);

-- GIN index for JSONB queries (topic_frequencies, etc.)
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_topics ON trend_snapshots USING gin(topic_frequencies);
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_sponsors ON trend_snapshots USING gin(sponsor_tiers);

-- RLS policies
ALTER TABLE trend_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can view trend snapshots (public data)
CREATE POLICY "Users can view trend snapshots" ON trend_snapshots
  FOR SELECT USING (true);

-- Service can insert trend snapshots
CREATE POLICY "Service can insert trend snapshots" ON trend_snapshots
  FOR INSERT WITH CHECK (true);

-- Service can update trend snapshots
CREATE POLICY "Service can update trend snapshots" ON trend_snapshots
  FOR UPDATE USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON trend_snapshots TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE trend_snapshots IS 'PHASE 2: Time-series trend snapshots for topic, sponsor, and event trend analysis';
COMMENT ON COLUMN trend_snapshots.snapshot_date IS 'Date of the snapshot (typically end of time window)';
COMMENT ON COLUMN trend_snapshots.time_window IS 'Time window: week, month, quarter, or year';
COMMENT ON COLUMN trend_snapshots.taxonomy_version IS 'Version of topic taxonomy used (e.g., "1.0")';
COMMENT ON COLUMN trend_snapshots.topic_frequencies IS 'JSONB object: {topic_id: count} for normalized topics';
COMMENT ON COLUMN trend_snapshots.topic_growth_rates IS 'JSONB object: {topic_id: growth_percentage} compared to previous period';
COMMENT ON COLUMN trend_snapshots.sponsor_tiers IS 'JSONB object: {tier: count} for sponsor tier distribution';

