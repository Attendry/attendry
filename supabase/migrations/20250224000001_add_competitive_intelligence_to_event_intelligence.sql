-- Add Competitive Intelligence fields to Event Intelligence
-- Migration: 20250224000001
-- Phase 2C: Competitive Intelligence

-- Add competitive_context field (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_intelligence'
    AND column_name = 'competitive_context'
  ) THEN
    ALTER TABLE event_intelligence
    ADD COLUMN competitive_context JSONB;
  END IF;
END $$;

-- Add competitive_alerts field (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_intelligence'
    AND column_name = 'competitive_alerts'
  ) THEN
    ALTER TABLE event_intelligence
    ADD COLUMN competitive_alerts JSONB;
  END IF;
END $$;

-- Add GIN index for competitive_context queries
CREATE INDEX IF NOT EXISTS idx_event_intelligence_competitive_context 
ON event_intelligence USING GIN (competitive_context);

-- Add GIN index for competitive_alerts queries
CREATE INDEX IF NOT EXISTS idx_event_intelligence_competitive_alerts 
ON event_intelligence USING GIN (competitive_alerts);

-- Add comments for documentation
COMMENT ON COLUMN event_intelligence.competitive_context IS 'Phase 2C: Competitive intelligence context including competitor matches, gaps, and activity comparison';
COMMENT ON COLUMN event_intelligence.competitive_alerts IS 'Phase 2C: Competitive alerts generated for high-value events, activity spikes, and competitive gaps';

