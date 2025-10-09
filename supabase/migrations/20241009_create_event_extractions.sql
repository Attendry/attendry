CREATE TABLE IF NOT EXISTS event_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  event_date DATE,
  country TEXT,
  locality TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_extractions_url_date UNIQUE (normalized_url, event_date)
);

CREATE INDEX IF NOT EXISTS event_extractions_url_idx
  ON event_extractions (normalized_url);
