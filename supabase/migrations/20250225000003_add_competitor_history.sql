-- Add Competitor History Tables
-- Migration: 20250225000003
-- Enhancement 3: Historical Competitor Tracking

-- Table to store historical competitor activity snapshots
CREATE TABLE IF NOT EXISTS competitor_activity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
  
  -- Activity metrics
  event_count INTEGER DEFAULT 0,
  speaker_count INTEGER DEFAULT 0,
  sponsor_count INTEGER DEFAULT 0,
  attendee_count INTEGER DEFAULT 0,
  
  -- Event details (JSONB for flexibility)
  events JSONB, -- Array of event IDs or summaries
  top_events JSONB, -- Top 10 events by opportunity score
  
  -- Trends
  growth_rate DECIMAL(5,2), -- Percentage change from previous period
  activity_score DECIMAL(5,2), -- Calculated activity score
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, competitor_name, snapshot_date, period_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_user_competitor ON competitor_activity_snapshots(user_id, competitor_name);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON competitor_activity_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_period ON competitor_activity_snapshots(period_type);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date ON competitor_activity_snapshots(user_id, snapshot_date);

-- Table for trend analysis
CREATE TABLE IF NOT EXISTS competitor_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  trend_type TEXT NOT NULL CHECK (trend_type IN ('growth', 'decline', 'spike', 'stable')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metric TEXT NOT NULL, -- 'event_count', 'activity_score', etc.
  value DECIMAL(10,2) NOT NULL,
  change_percentage DECIMAL(5,2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, competitor_name, trend_type, period_start, period_end, metric)
);

CREATE INDEX IF NOT EXISTS idx_trends_user_competitor ON competitor_trends(user_id, competitor_name);
CREATE INDEX IF NOT EXISTS idx_trends_period ON competitor_trends(period_start, period_end);

-- Add comments
COMMENT ON TABLE competitor_activity_snapshots IS 'Historical snapshots of competitor activity for trend analysis';
COMMENT ON TABLE competitor_trends IS 'Identified trends in competitor activity over time';

