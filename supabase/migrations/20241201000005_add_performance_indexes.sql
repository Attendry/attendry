-- Add performance indexes for frequently queried columns
-- This migration adds indexes to improve query performance across the application

-- Indexes for collected_events table
CREATE INDEX IF NOT EXISTS idx_collected_events_country ON collected_events(country);
CREATE INDEX IF NOT EXISTS idx_collected_events_starts_at ON collected_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_collected_events_collected_at ON collected_events(collected_at);
CREATE INDEX IF NOT EXISTS idx_collected_events_confidence ON collected_events(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_collected_events_industry ON collected_events(industry);
CREATE INDEX IF NOT EXISTS idx_collected_events_source_domain ON collected_events(source_domain);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_collected_events_country_date ON collected_events(country, starts_at);
CREATE INDEX IF NOT EXISTS idx_collected_events_industry_date ON collected_events(industry, starts_at);
CREATE INDEX IF NOT EXISTS idx_collected_events_collected_recent ON collected_events(collected_at DESC);

-- Full-text search indexes (using simple text search instead of to_tsvector)
CREATE INDEX IF NOT EXISTS idx_collected_events_title_text ON collected_events(title);
CREATE INDEX IF NOT EXISTS idx_collected_events_description_text ON collected_events(description);

-- Indexes for search_cache table
CREATE INDEX IF NOT EXISTS idx_search_cache_ttl_at ON search_cache(ttl_at);
CREATE INDEX IF NOT EXISTS idx_search_cache_provider ON search_cache(provider);
CREATE INDEX IF NOT EXISTS idx_search_cache_created_at ON search_cache(created_at);

-- Indexes for watchlists table
CREATE INDEX IF NOT EXISTS idx_watchlists_owner ON watchlists(owner);
CREATE INDEX IF NOT EXISTS idx_watchlists_kind ON watchlists(kind);
CREATE INDEX IF NOT EXISTS idx_watchlists_ref_id ON watchlists(ref_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_owner_kind ON watchlists(owner, kind);

-- Indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_use_in_basic_search ON profiles(use_in_basic_search) WHERE use_in_basic_search = true;

-- Indexes for search_configurations table
CREATE INDEX IF NOT EXISTS idx_search_configurations_industry ON search_configurations(industry);
CREATE INDEX IF NOT EXISTS idx_search_configurations_is_active ON search_configurations(is_active) WHERE is_active = true;

-- Indexes for collection_batches table
CREATE INDEX IF NOT EXISTS idx_collection_batches_status ON collection_batches(status);
CREATE INDEX IF NOT EXISTS idx_collection_batches_industry_country ON collection_batches(industry, country);
CREATE INDEX IF NOT EXISTS idx_collection_batches_created_at ON collection_batches(created_at DESC);

-- Add partial indexes for better performance on filtered queries (using simple conditions)
CREATE INDEX IF NOT EXISTS idx_collected_events_verified ON collected_events(verification_status);
CREATE INDEX IF NOT EXISTS idx_collected_events_high_confidence ON collected_events(confidence);

-- Add indexes for array columns (topics, search_terms) - using btree for safety
CREATE INDEX IF NOT EXISTS idx_collected_events_topics ON collected_events(topics);
CREATE INDEX IF NOT EXISTS idx_collected_events_search_terms ON collected_events(search_terms);

-- Add indexes for JSONB columns - using btree for safety
CREATE INDEX IF NOT EXISTS idx_collected_events_speakers ON collected_events(speakers);
CREATE INDEX IF NOT EXISTS idx_collected_events_sponsors ON collected_events(sponsors);

-- Add statistics for better query planning
ANALYZE collected_events;
ANALYZE search_cache;
ANALYZE watchlists;
ANALYZE profiles;
ANALYZE search_configurations;
ANALYZE collection_batches;
