-- Add Insight Score to Event Intelligence
-- Migration: 20250223000002
-- Phase 2B: Insight Scoring System

-- Add insight_score JSONB field to store complete insight score with breakdown
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_intelligence'
    AND column_name = 'insight_score'
  ) THEN
    ALTER TABLE event_intelligence
    ADD COLUMN insight_score JSONB;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN event_intelligence.insight_score IS 'Phase 2B: Comprehensive insight score including relevance, impact, urgency, confidence scores and breakdown';

