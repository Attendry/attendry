-- Optimize Competitor Queries
-- Migration: 20250225000002
-- Enhancement 2: Query Optimization for Large Competitor Lists

-- Indexes for faster competitor searches in JSONB fields
-- GIN (Generalized Inverted Index) indexes for JSONB array/object searches

-- Index for speakers.org field (JSONB)
CREATE INDEX IF NOT EXISTS idx_events_speakers_org_gin 
ON collected_events USING GIN (
  (speakers::jsonb -> 'org')
);

-- Index for sponsors.name field (JSONB)
CREATE INDEX IF NOT EXISTS idx_events_sponsors_name_gin 
ON collected_events USING GIN (
  (sponsors::jsonb -> 'name')
);

-- Index for participating_organizations array
CREATE INDEX IF NOT EXISTS idx_events_participating_orgs_gin 
ON collected_events USING GIN (participating_organizations);

-- Index for date range queries (for activity comparison)
CREATE INDEX IF NOT EXISTS idx_events_starts_at 
ON collected_events(starts_at) 
WHERE starts_at IS NOT NULL;

-- Note: Composite GIN index with date not possible (GIN only for arrays/JSONB)
-- Use separate indexes above for participating_organizations and starts_at

-- Index for organizer field (text search)
CREATE INDEX IF NOT EXISTS idx_events_organizer 
ON collected_events(organizer) 
WHERE organizer IS NOT NULL;

-- Index for user_event_board queries (for activity comparison)
CREATE INDEX IF NOT EXISTS idx_user_event_board_user_id 
ON user_event_board(user_id);

CREATE INDEX IF NOT EXISTS idx_user_event_board_event_id 
ON user_event_board(event_id);

CREATE INDEX IF NOT EXISTS idx_user_event_board_user_event 
ON user_event_board(user_id, event_id);

-- Add comments for documentation
COMMENT ON INDEX idx_events_speakers_org_gin IS 'GIN index for fast searches on speaker organizations';
COMMENT ON INDEX idx_events_sponsors_name_gin IS 'GIN index for fast searches on sponsor names';
COMMENT ON INDEX idx_events_participating_orgs_gin IS 'GIN index for fast searches on participating organizations array';
COMMENT ON INDEX idx_events_starts_at IS 'Index for date range queries in activity comparison';

