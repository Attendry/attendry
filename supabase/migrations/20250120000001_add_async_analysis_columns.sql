-- Add columns for async analysis results to collected_events table
ALTER TABLE collected_events 
ADD COLUMN IF NOT EXISTS enhanced_speakers JSONB,
ADD COLUMN IF NOT EXISTS analysis_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS speakers_found INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS crawl_stats JSONB;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_collected_events_analysis_completed ON collected_events(analysis_completed);
CREATE INDEX IF NOT EXISTS idx_collected_events_speakers_found ON collected_events(speakers_found);

-- Add comment to document the new columns
COMMENT ON COLUMN collected_events.enhanced_speakers IS 'Enhanced speaker data from deep crawling and AI analysis';
COMMENT ON COLUMN collected_events.analysis_completed IS 'Whether async analysis has been completed for this event';
COMMENT ON COLUMN collected_events.speakers_found IS 'Number of speakers found during analysis';
COMMENT ON COLUMN collected_events.crawl_stats IS 'Statistics from the crawling process (pages crawled, content length, etc.)';
