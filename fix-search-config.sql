-- Fix search configuration to use general instead of legal-compliance
-- Run this in your Supabase SQL Editor

-- First, deactivate the current legal-compliance configuration
UPDATE search_configurations 
SET is_active = false 
WHERE industry = 'legal-compliance' AND is_active = true;

-- Insert a new general configuration as active
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
  'General Business Events',
  'general',
  '(conference OR event OR summit OR workshop OR seminar OR meeting OR symposium OR forum OR exhibition OR trade show OR convention OR congress OR webinar OR meetup OR networking event OR masterclass OR roundtable OR panel discussion OR expo)',
  'reddit Mumsnet forum',
  '["business", "professional", "networking", "development", "technology", "innovation"]'::jsonb,
  '["professionals", "business leaders", "industry experts", "decision makers"]'::jsonb,
  '{
    "extraction": "Extract ALL speakers on the page(s). For each, return name, organization (org), title/role if present, and profile_url if linked. Look for sections labelled Speakers, Referenten, Referent:innen, Sprecher, Vortragende, Mitwirkende, Panel, Agenda/Programm/Fachprogramm. Do not invent names; only list people visible on the pages.",
    "normalization": "You are a data normalizer. Merge duplicate speakers across pages. Return clean JSON with fields: name, org, title, profile_url, source_url (one of the pages), confidence (0-1). Do not invent people. Keep only real names (≥2 tokens)."
  }'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Verify the change
SELECT id, name, industry, base_query, is_active 
FROM search_configurations 
WHERE is_active = true;
