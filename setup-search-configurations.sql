-- Setup script for search_configurations table and RPC function
-- Run this in your Supabase SQL Editor

-- Drop existing table if it exists (to ensure clean setup)
DROP TABLE IF EXISTS search_configurations CASCADE;

-- Create search_configurations table
CREATE TABLE search_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  base_query TEXT NOT NULL,
  exclude_terms TEXT,
  industry_terms JSONB DEFAULT '[]'::jsonb,
  icp_terms JSONB DEFAULT '[]'::jsonb,
  speaker_prompts JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for industry lookups
CREATE INDEX idx_search_configurations_industry ON search_configurations(industry);

-- Create index for active configurations
CREATE INDEX idx_search_configurations_active ON search_configurations(is_active) WHERE is_active = true;

-- Add RLS policies
ALTER TABLE search_configurations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read configurations
CREATE POLICY "Allow authenticated users to read search configurations" ON search_configurations
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert configurations
CREATE POLICY "Allow authenticated users to insert search configurations" ON search_configurations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update configurations
CREATE POLICY "Allow authenticated users to update search configurations" ON search_configurations
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Insert default configuration
INSERT INTO search_configurations (
  name,
  industry,
  base_query,
  exclude_terms,
  industry_terms,
  icp_terms,
  speaker_prompts,
  is_active
) VALUES (
  'Default Legal & Compliance',
  'legal-compliance',
  '(legal OR compliance OR investigation OR "e-discovery" OR ediscovery OR "legal tech" OR "legal technology" OR "regulatory" OR "governance" OR "risk management" OR "audit" OR "whistleblowing" OR "data protection" OR "GDPR" OR "privacy" OR "cybersecurity" OR "regtech" OR "ESG") (conference OR summit OR forum OR "trade show" OR exhibition OR convention OR "industry event" OR "business event" OR konferenz OR kongress OR symposium OR veranstaltung OR workshop OR seminar OR webinar OR "training" OR "certification") (2025 OR "next year" OR upcoming OR "this year" OR "25. September" OR "September 2025" OR "Oktober 2025" OR "November 2025" OR "Dezember 2025" OR "Q1 2025" OR "Q2 2025" OR "Q3 2025" OR "Q4 2025")',
  'reddit Mumsnet "legal advice" forum',
  '["compliance", "investigations", "regtech", "ESG", "sanctions", "governance", "legal ops", "risk", "audit", "whistleblow"]'::jsonb,
  '["general counsel", "chief compliance officer", "investigations lead", "compliance manager", "legal operations"]'::jsonb,
  '{
    "extraction": "Extract ALL speakers on the page(s). For each, return name, organization (org), title/role if present, and profile_url if linked. Look for sections labelled Speakers, Referenten, Referent:innen, Sprecher, Vortragende, Mitwirkende, Panel, Agenda/Programm/Fachprogramm. Do not invent names; only list people visible on the pages.",
    "normalization": "You are a data normalizer. Merge duplicate speakers across pages. Return clean JSON with fields: name, org, title, profile_url, source_url (one of the pages), confidence (0-1). Do not invent people. Keep only real names (≥2 tokens)."
  }'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Create RPC function for upserting search configuration with text parameters
CREATE OR REPLACE FUNCTION upsert_search_configuration_text(
  p_name TEXT,
  p_industry TEXT DEFAULT NULL,
  p_base_search_query TEXT DEFAULT NULL,
  p_exclude_terms_text TEXT DEFAULT '',
  p_industry_terms_text TEXT DEFAULT '',
  p_icp_terms_text TEXT DEFAULT '',
  p_speaker_prompts_text TEXT DEFAULT '',
  p_normalization_prompts_text TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_industry_terms JSONB;
  v_icp_terms JSONB;
  v_speaker_prompts JSONB;
BEGIN
  -- Parse text fields into JSONB arrays/objects
  v_industry_terms := CASE 
    WHEN p_industry_terms_text = '' THEN '[]'::jsonb
    ELSE ('["' || array_to_string(string_to_array(p_industry_terms_text, E'\n'), '","') || '"]')::jsonb
  END;
  
  v_icp_terms := CASE 
    WHEN p_icp_terms_text = '' THEN '[]'::jsonb
    ELSE ('["' || array_to_string(string_to_array(p_icp_terms_text, E'\n'), '","') || '"]')::jsonb
  END;
  
  v_speaker_prompts := jsonb_build_object(
    'extraction', p_speaker_prompts_text,
    'normalization', p_normalization_prompts_text
  );

  -- Deactivate current active configuration
  UPDATE search_configurations 
  SET is_active = false 
  WHERE is_active = true;

  -- Insert new configuration
  INSERT INTO search_configurations (
    name,
    industry,
    base_query,
    exclude_terms,
    industry_terms,
    icp_terms,
    speaker_prompts,
    is_active
  ) VALUES (
    p_name,
    COALESCE(p_industry, 'general'),
    COALESCE(p_base_search_query, '(conference OR summit OR "business event")'),
    p_exclude_terms_text,
    v_industry_terms,
    v_icp_terms,
    v_speaker_prompts,
    true
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
