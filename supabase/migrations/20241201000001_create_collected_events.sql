-- Create table for storing collected events from comprehensive searches
CREATE TABLE IF NOT EXISTS collected_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Event details
  title TEXT NOT NULL,
  starts_at DATE,
  ends_at DATE,
  city TEXT,
  country TEXT,
  venue TEXT,
  organizer TEXT,
  
  -- Content
  description TEXT,
  topics TEXT[],
  speakers JSONB,
  sponsors JSONB,
  participating_organizations TEXT[],
  partners TEXT[],
  competitors TEXT[],
  
  -- Source information
  source_url TEXT NOT NULL,
  source_domain TEXT,
  extraction_method TEXT, -- 'firecrawl', 'regex', 'structured_data'
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  
  -- Collection metadata
  collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  collection_batch_id UUID,
  industry TEXT,
  search_terms TEXT[],
  
  -- Quality metrics
  data_completeness DECIMAL(3,2), -- 0.00 to 1.00
  last_verified_at TIMESTAMP WITH TIME ZONE,
  verification_status TEXT DEFAULT 'unverified', -- 'unverified', 'verified', 'outdated'
  
  -- Indexing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_collected_events_starts_at ON collected_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_collected_events_country ON collected_events(country);
CREATE INDEX IF NOT EXISTS idx_collected_events_industry ON collected_events(industry);
CREATE INDEX IF NOT EXISTS idx_collected_events_source_url ON collected_events(source_url);
CREATE INDEX IF NOT EXISTS idx_collected_events_collected_at ON collected_events(collected_at);
CREATE INDEX IF NOT EXISTS idx_collected_events_confidence ON collected_events(confidence);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_collected_events_date_range ON collected_events(starts_at, ends_at);

-- Create index for text search
CREATE INDEX IF NOT EXISTS idx_collected_events_title_search ON collected_events USING gin(to_tsvector('english', title));

-- Create table for tracking collection batches
CREATE TABLE IF NOT EXISTS collection_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Batch details
  industry TEXT NOT NULL,
  country TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Results
  events_found INTEGER DEFAULT 0,
  events_stored INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for collection batches
CREATE INDEX IF NOT EXISTS idx_collection_batches_industry_country ON collection_batches(industry, country);
CREATE INDEX IF NOT EXISTS idx_collection_batches_status ON collection_batches(status);
CREATE INDEX IF NOT EXISTS idx_collection_batches_started_at ON collection_batches(started_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_collected_events_updated_at 
    BEFORE UPDATE ON collected_events 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate data completeness
CREATE OR REPLACE FUNCTION calculate_data_completeness(event collected_events)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    total_fields INTEGER := 10; -- Total number of important fields
    filled_fields INTEGER := 0;
BEGIN
    -- Count filled fields
    IF event.title IS NOT NULL AND event.title != '' THEN filled_fields := filled_fields + 1; END IF;
    IF event.starts_at IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF event.ends_at IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF event.city IS NOT NULL AND event.city != '' THEN filled_fields := filled_fields + 1; END IF;
    IF event.country IS NOT NULL AND event.country != '' THEN filled_fields := filled_fields + 1; END IF;
    IF event.venue IS NOT NULL AND event.venue != '' THEN filled_fields := filled_fields + 1; END IF;
    IF event.organizer IS NOT NULL AND event.organizer != '' THEN filled_fields := filled_fields + 1; END IF;
    IF event.description IS NOT NULL AND event.description != '' THEN filled_fields := filled_fields + 1; END IF;
    IF event.topics IS NOT NULL AND array_length(event.topics, 1) > 0 THEN filled_fields := filled_fields + 1; END IF;
    IF event.speakers IS NOT NULL AND event.speakers != '[]'::jsonb THEN filled_fields := filled_fields + 1; END IF;
    
    RETURN ROUND(filled_fields::DECIMAL / total_fields, 2);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate data completeness
CREATE OR REPLACE FUNCTION trigger_calculate_data_completeness()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_completeness := calculate_data_completeness(NEW);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_data_completeness_trigger
    BEFORE INSERT OR UPDATE ON collected_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calculate_data_completeness();

-- Upsert event RPC used by /api/events/run persistence
CREATE OR REPLACE FUNCTION upsert_event(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Try update existing by source_url
  UPDATE collected_events AS ce
    SET title = COALESCE(p->>'title', ce.title),
        starts_at = COALESCE((p->>'starts_at')::date, ce.starts_at),
        ends_at = COALESCE((p->>'ends_at')::date, ce.ends_at),
        city = COALESCE(p->>'city', ce.city),
        country = COALESCE(p->>'country', ce.country),
        venue = COALESCE(p->>'venue', ce.venue),
        organizer = COALESCE(p->>'organizer', ce.organizer),
        topics = COALESCE(ARRAY(SELECT jsonb_array_elements_text(p->'topics')), ce.topics),
        speakers = COALESCE(p->'speakers', ce.speakers),
        sponsors = COALESCE(p->'sponsors', ce.sponsors),
        participating_organizations = COALESCE(ARRAY(SELECT jsonb_array_elements_text(p->'participating_organizations')), ce.participating_organizations),
        partners = COALESCE(ARRAY(SELECT jsonb_array_elements_text(p->'partners')), ce.partners),
        competitors = COALESCE(ARRAY(SELECT jsonb_array_elements_text(p->'competitors')), ce.competitors),
        confidence = COALESCE((p->>'confidence')::decimal, ce.confidence),
        updated_at = NOW()
  WHERE ce.source_url = p->>'source_url'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO collected_events (
      title, starts_at, ends_at, city, country, venue, organizer,
      topics, speakers, sponsors, participating_organizations, partners, competitors,
      source_url, source_domain, extraction_method, confidence
    ) VALUES (
      COALESCE(p->>'title','Event'),
      NULLIF(p->>'starts_at','')::date,
      NULLIF(p->>'ends_at','')::date,
      NULLIF(p->>'city',''),
      NULLIF(p->>'country',''),
      NULLIF(p->>'venue',''),
      NULLIF(p->>'organizer',''),
      ARRAY(SELECT jsonb_array_elements_text(p->'topics')),
      COALESCE(p->'speakers','[]'::jsonb),
      COALESCE(p->'sponsors','[]'::jsonb),
      ARRAY(SELECT jsonb_array_elements_text(p->'participating_organizations')),
      ARRAY(SELECT jsonb_array_elements_text(p->'partners')),
      ARRAY(SELECT jsonb_array_elements_text(p->'competitors')),
      p->>'source_url',
      split_part(replace(replace(p->>'source_url','https://',''),'http://',''), '/', 1),
      'run',
      NULLIF(p->>'confidence','')::decimal
    ) RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Create view for easy querying of high-quality events
CREATE OR REPLACE VIEW high_quality_events AS
SELECT 
    id,
    title,
    starts_at,
    ends_at,
    city,
    country,
    venue,
    organizer,
    source_url,
    confidence,
    data_completeness,
    collected_at
FROM collected_events
WHERE 
    confidence >= 0.7 
    AND data_completeness >= 0.6
    AND starts_at >= CURRENT_DATE
    AND starts_at <= CURRENT_DATE + INTERVAL '6 months'
ORDER BY 
    confidence DESC,
    data_completeness DESC,
    starts_at ASC;

-- Add RLS (Row Level Security) policies
ALTER TABLE collected_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_batches ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users
CREATE POLICY "Allow read access to collected_events" ON collected_events
    FOR SELECT USING (true);

CREATE POLICY "Allow read access to collection_batches" ON collection_batches
    FOR SELECT USING (true);

-- Allow insert/update for authenticated users (for admin operations)
CREATE POLICY "Allow insert for authenticated users" ON collected_events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users" ON collected_events
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated users" ON collection_batches
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update for authenticated users" ON collection_batches
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Watchlists table and RPC for user saves
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner UUID NOT NULL,
  kind TEXT NOT NULL,
  label TEXT,
  ref_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlists_owner_kind ON watchlists(owner, kind);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_watchlists_owner_kind_ref ON watchlists(owner, kind, ref_id);

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlists read own" ON watchlists FOR SELECT USING (auth.uid() = owner);
CREATE POLICY "watchlists insert own" ON watchlists FOR INSERT WITH CHECK (auth.uid() = owner);
CREATE POLICY "watchlists delete own" ON watchlists FOR DELETE USING (auth.uid() = owner);

CREATE OR REPLACE FUNCTION add_watchlist_item(p_kind TEXT, p_label TEXT, p_ref_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_owner UUID := auth.uid();
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO watchlists(owner, kind, label, ref_id)
  VALUES (v_owner, p_kind, NULLIF(p_label,''), p_ref_id)
  ON CONFLICT (owner, kind, ref_id) DO UPDATE
    SET label = EXCLUDED.label
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

