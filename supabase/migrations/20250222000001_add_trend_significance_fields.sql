-- Add Statistical Significance Fields to Trend Analysis Cache
-- Migration: 20250222000001
-- Phase 1A: Statistical Significance Testing

-- Add significance fields to trend_analysis_cache
ALTER TABLE trend_analysis_cache
  ADD COLUMN IF NOT EXISTS significance_scores JSONB, -- Store significance scores per category/topic
  ADD COLUMN IF NOT EXISTS confidence_intervals JSONB, -- Store confidence intervals for growth rates
  ADD COLUMN IF NOT EXISTS statistical_metadata JSONB; -- Store p-values, test types, etc.

-- Add index for querying by significance (if needed in future)
-- Note: JSONB columns are already indexed with GIN, but we can add a specific index if needed
CREATE INDEX IF NOT EXISTS idx_trend_analysis_significance 
  ON trend_analysis_cache USING GIN (significance_scores);

-- Add comments for documentation
COMMENT ON COLUMN trend_analysis_cache.significance_scores IS 'Statistical significance scores (0-1) for each trend category/topic';
COMMENT ON COLUMN trend_analysis_cache.confidence_intervals IS 'Confidence intervals for growth rates and trend metrics';
COMMENT ON COLUMN trend_analysis_cache.statistical_metadata IS 'Additional statistical metadata (p-values, test types, degrees of freedom)';

