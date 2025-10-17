-- Add support for companies in watchlist
-- This migration extends the existing watchlists table to better support company tracking

-- Add a new column to distinguish between different types of companies
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT 'general' CHECK (company_type IN ('general', 'competitor', 'partner', 'customer', 'prospect'));

-- Add a column to store additional metadata for companies
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create an index for company type filtering
CREATE INDEX IF NOT EXISTS idx_watchlists_company_type ON watchlists(company_type) WHERE kind = 'company';

-- Create an index for metadata queries
CREATE INDEX IF NOT EXISTS idx_watchlists_metadata ON watchlists USING GIN(metadata) WHERE kind = 'company';

-- Update the existing add_watchlist_item function to support companies
CREATE OR REPLACE FUNCTION add_watchlist_item(
    p_kind TEXT, 
    p_label TEXT, 
    p_ref_id TEXT,
    p_company_type TEXT DEFAULT 'general',
    p_metadata JSONB DEFAULT '{}'
)
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

  -- Validate company_type if kind is 'company'
  IF p_kind = 'company' AND p_company_type NOT IN ('general', 'competitor', 'partner', 'customer', 'prospect') THEN
    RAISE EXCEPTION 'invalid company_type for company kind';
  END IF;

  INSERT INTO watchlists(owner, kind, label, ref_id, company_type, metadata)
  VALUES (v_owner, p_kind, NULLIF(p_label,''), p_ref_id, 
          CASE WHEN p_kind = 'company' THEN p_company_type ELSE 'general' END,
          CASE WHEN p_kind = 'company' THEN p_metadata ELSE '{}' END)
  ON CONFLICT (owner, kind, ref_id) DO UPDATE
    SET label = EXCLUDED.label,
        company_type = EXCLUDED.company_type,
        metadata = EXCLUDED.metadata
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Create a function to get watchlist items by type
CREATE OR REPLACE FUNCTION get_watchlist_by_type(p_kind TEXT, p_company_type TEXT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    owner UUID,
    kind TEXT,
    label TEXT,
    ref_id TEXT,
    company_type TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT w.id, w.owner, w.kind, w.label, w.ref_id, w.company_type, w.metadata, w.created_at
  FROM watchlists w
  WHERE w.owner = auth.uid()
    AND w.kind = p_kind
    AND (p_company_type IS NULL OR w.company_type = p_company_type)
  ORDER BY w.created_at DESC;
END;
$$;

-- Create a function to get watchlist summary
CREATE OR REPLACE FUNCTION get_watchlist_summary()
RETURNS TABLE (
    total_items INTEGER,
    attendees_count INTEGER,
    companies_count INTEGER,
    competitors_count INTEGER,
    partners_count INTEGER,
    customers_count INTEGER,
    prospects_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_items,
    COUNT(*) FILTER (WHERE kind = 'attendee')::INTEGER as attendees_count,
    COUNT(*) FILTER (WHERE kind = 'company')::INTEGER as companies_count,
    COUNT(*) FILTER (WHERE kind = 'company' AND company_type = 'competitor')::INTEGER as competitors_count,
    COUNT(*) FILTER (WHERE kind = 'company' AND company_type = 'partner')::INTEGER as partners_count,
    COUNT(*) FILTER (WHERE kind = 'company' AND company_type = 'customer')::INTEGER as customers_count,
    COUNT(*) FILTER (WHERE kind = 'company' AND company_type = 'prospect')::INTEGER as prospects_count
  FROM watchlists
  WHERE owner = auth.uid();
END;
$$;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION get_watchlist_by_type TO authenticated;
GRANT EXECUTE ON FUNCTION get_watchlist_summary TO authenticated;
