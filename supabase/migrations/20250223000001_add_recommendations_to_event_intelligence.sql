-- Add Recommendations and Phase 1B fields to Event Intelligence
-- Migration: 20250223000001
-- Phase 1B: Opportunity Scoring and Urgency Indicators
-- Phase 2A: Recommendations Engine

-- Add Phase 1B fields (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_intelligence'
    AND column_name = 'opportunity_score'
  ) THEN
    ALTER TABLE event_intelligence
    ADD COLUMN opportunity_score JSONB;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_intelligence'
    AND column_name = 'urgency_indicators'
  ) THEN
    ALTER TABLE event_intelligence
    ADD COLUMN urgency_indicators JSONB;
  END IF;
END $$;

-- Add Phase 2A: Recommendations field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_intelligence'
    AND column_name = 'recommendations'
  ) THEN
    ALTER TABLE event_intelligence
    ADD COLUMN recommendations JSONB;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN event_intelligence.opportunity_score IS 'Phase 1B: Quantified opportunity scoring including ICP match, attendee quality, ROI estimate';
COMMENT ON COLUMN event_intelligence.urgency_indicators IS 'Phase 1B: Urgency indicators including deadlines, early bird pricing, and recommended action timing';
COMMENT ON COLUMN event_intelligence.recommendations IS 'Phase 2A: Actionable recommendations generated from event intelligence (immediate, strategic, research)';

