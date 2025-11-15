-- PHASE 2 OPTIMIZATION: Performance Indexes
-- Migration: 20250225000001
-- Adds indexes for improved query performance on cache and extraction tables

-- Index for search_cache: Composite index on cache_key and ttl_at for efficient cache lookups
-- This improves cache hit performance and TTL-based cleanup queries
CREATE INDEX IF NOT EXISTS idx_search_cache_key_ttl ON search_cache(cache_key, ttl_at);

-- Note: idx_search_cache_key already exists from 20241201000003_create_search_cache.sql
-- This composite index is optimized for queries that filter by both cache_key and ttl_at

-- Index for ai_decisions table (if it exists)
-- This table may not exist yet, so we'll create the index conditionally
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_decisions') THEN
    CREATE INDEX IF NOT EXISTS idx_ai_decisions_hash ON ai_decisions(item_hash);
    RAISE NOTICE 'Created index idx_ai_decisions_hash on ai_decisions';
  ELSE
    RAISE NOTICE 'Table ai_decisions does not exist, skipping index creation';
  END IF;
END $$;

-- Index for url_extractions table (if it exists)
-- This table may not exist yet, so we'll create the index conditionally
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'url_extractions') THEN
    CREATE INDEX IF NOT EXISTS idx_url_extractions_normalized ON url_extractions(url_normalized);
    RAISE NOTICE 'Created index idx_url_extractions_normalized on url_extractions';
  ELSE
    RAISE NOTICE 'Table url_extractions does not exist, skipping index creation';
  END IF;
END $$;

-- Index for extracted_metadata table (if it exists)
-- This table may be created in the future for caching extracted metadata
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extracted_metadata') THEN
    CREATE INDEX IF NOT EXISTS idx_extracted_metadata_url_hash ON extracted_metadata(url_hash, expires_at);
    RAISE NOTICE 'Created index idx_extracted_metadata_url_hash on extracted_metadata';
  ELSE
    RAISE NOTICE 'Table extracted_metadata does not exist, skipping index creation';
  END IF;
END $$;

-- Update statistics for better query planning
ANALYZE search_cache;

-- If tables exist, analyze them too
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_decisions') THEN
    ANALYZE ai_decisions;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'url_extractions') THEN
    ANALYZE url_extractions;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extracted_metadata') THEN
    ANALYZE extracted_metadata;
  END IF;
END $$;

