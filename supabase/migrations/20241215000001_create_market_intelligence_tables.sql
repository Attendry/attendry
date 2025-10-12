-- Market Intelligence Database Schema
-- Creates tables for accounts, speakers, and intelligence data

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  description TEXT,
  website_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT accounts_name_not_empty CHECK (length(trim(company_name)) > 0),
  CONSTRAINT accounts_domain_format CHECK (domain IS NULL OR domain ~ '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
);

-- Create account_speakers table
CREATE TABLE IF NOT EXISTS account_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  speaker_name TEXT NOT NULL,
  speaker_title TEXT,
  speaker_company TEXT,
  email TEXT,
  linkedin_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT account_speakers_name_not_empty CHECK (length(trim(speaker_name)) > 0),
  CONSTRAINT account_speakers_email_format CHECK (email IS NULL OR email ~ '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT account_speakers_linkedin_format CHECK (linkedin_url IS NULL OR linkedin_url ~ '^https?://(www\.)?linkedin\.com/'),
  UNIQUE(account_id, speaker_name)
);

-- Create account_intelligence_data table
CREATE TABLE IF NOT EXISTS account_intelligence_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL,
  title TEXT,
  content TEXT,
  source_url TEXT,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT account_intelligence_data_type_valid CHECK (data_type IN ('annual_report', 'intent_signal', 'competitor_analysis', 'event_participation', 'speaker_activity'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_created_by ON accounts(created_by);
CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(company_name);
CREATE INDEX IF NOT EXISTS idx_accounts_domain ON accounts(domain);
CREATE INDEX IF NOT EXISTS idx_accounts_industry ON accounts(industry);

CREATE INDEX IF NOT EXISTS idx_account_speakers_account_id ON account_speakers(account_id);
CREATE INDEX IF NOT EXISTS idx_account_speakers_name ON account_speakers(speaker_name);
CREATE INDEX IF NOT EXISTS idx_account_speakers_company ON account_speakers(speaker_company);

CREATE INDEX IF NOT EXISTS idx_account_intelligence_account_id ON account_intelligence_data(account_id);
CREATE INDEX IF NOT EXISTS idx_account_intelligence_data_type ON account_intelligence_data(data_type);
CREATE INDEX IF NOT EXISTS idx_account_intelligence_extracted_at ON account_intelligence_data(extracted_at);
CREATE INDEX IF NOT EXISTS idx_account_intelligence_confidence ON account_intelligence_data(confidence_score);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_accounts_updated_at 
    BEFORE UPDATE ON accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_speakers_updated_at 
    BEFORE UPDATE ON account_speakers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: Cache configuration for company intelligence is handled in the application code
-- The CACHE_CONFIGS.COMPANY_INTELLIGENCE is defined in src/lib/cache/unified-cache-service.ts

-- Create RPC functions for common operations

-- Function to get account with intelligence summary
CREATE OR REPLACE FUNCTION get_account_intelligence_summary(account_uuid UUID)
RETURNS TABLE (
  account_id UUID,
  company_name TEXT,
  account_domain TEXT,
  account_industry TEXT,
  total_speakers INTEGER,
  total_intelligence_data INTEGER,
  latest_activity TIMESTAMPTZ,
  confidence_avg DECIMAL(3,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.company_name,
    a.domain,
    a.industry,
    COALESCE(speaker_count.count, 0)::INTEGER as total_speakers,
    COALESCE(intel_count.count, 0)::INTEGER as total_intelligence_data,
    GREATEST(
      COALESCE(speaker_count.latest, a.created_at),
      COALESCE(intel_count.latest, a.created_at)
    ) as latest_activity,
    COALESCE(intel_count.avg_confidence, 0) as confidence_avg
  FROM accounts a
  LEFT JOIN (
    SELECT 
      account_id,
      COUNT(*) as count,
      MAX(created_at) as latest
    FROM account_speakers 
    WHERE account_id = account_uuid
    GROUP BY account_id
  ) speaker_count ON a.id = speaker_count.account_id
  LEFT JOIN (
    SELECT 
      account_id,
      COUNT(*) as count,
      MAX(extracted_at) as latest,
      AVG(confidence_score) as avg_confidence
    FROM account_intelligence_data 
    WHERE account_id = account_uuid
    GROUP BY account_id
  ) intel_count ON a.id = intel_count.account_id
  WHERE a.id = account_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search accounts
CREATE OR REPLACE FUNCTION search_accounts(
  search_term TEXT DEFAULT '',
  industry_filter TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  domain TEXT,
  industry TEXT,
  description TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.company_name,
    a.domain,
    a.industry,
    a.description,
    a.website_url,
    a.created_at,
    a.updated_at
  FROM accounts a
  WHERE 
    (search_term = '' OR 
     a.company_name ILIKE '%' || search_term || '%' OR 
     a.domain ILIKE '%' || search_term || '%' OR
     a.description ILIKE '%' || search_term || '%')
    AND (industry_filter IS NULL OR a.industry = industry_filter)
  ORDER BY a.updated_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get account speakers with event participation
CREATE OR REPLACE FUNCTION get_account_speakers_with_events(account_uuid UUID)
RETURNS TABLE (
  speaker_id UUID,
  speaker_name TEXT,
  speaker_title TEXT,
  speaker_company TEXT,
  email TEXT,
  linkedin_url TEXT,
  bio TEXT,
  total_events INTEGER,
  latest_event_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.speaker_name,
    s.speaker_title,
    s.speaker_company,
    s.email,
    s.linkedin_url,
    s.bio,
    COALESCE(event_count.count, 0)::INTEGER as total_events,
    event_count.latest_date as latest_event_date
  FROM account_speakers s
  LEFT JOIN (
    SELECT 
      speaker_name,
      COUNT(*) as count,
      MAX(starts_at::TIMESTAMPTZ) as latest_date
    FROM collected_events ce,
         jsonb_array_elements(ce.speakers) as speaker
    WHERE speaker->>'name' = s.speaker_name
      AND speaker->>'org' ILIKE '%' || (SELECT name FROM accounts WHERE id = account_uuid) || '%'
    GROUP BY speaker_name
  ) event_count ON s.speaker_name = event_count.speaker_name
  WHERE s.account_id = account_uuid
  ORDER BY s.speaker_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get intelligence data by type
CREATE OR REPLACE FUNCTION get_account_intelligence_by_type(
  account_uuid UUID,
  data_type_filter TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  data_type TEXT,
  title TEXT,
  content TEXT,
  source_url TEXT,
  extracted_at TIMESTAMPTZ,
  confidence_score DECIMAL(3,2),
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aid.id,
    aid.data_type,
    aid.title,
    aid.content,
    aid.source_url,
    aid.extracted_at,
    aid.confidence_score,
    aid.metadata
  FROM account_intelligence_data aid
  WHERE aid.account_id = account_uuid
    AND (data_type_filter IS NULL OR aid.data_type = data_type_filter)
  ORDER BY aid.extracted_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_intelligence_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own accounts" ON accounts
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own accounts" ON accounts
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own accounts" ON accounts
  FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Users can view speakers for their accounts" ON account_speakers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE accounts.id = account_speakers.account_id 
      AND accounts.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert speakers for their accounts" ON account_speakers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE accounts.id = account_speakers.account_id 
      AND accounts.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update speakers for their accounts" ON account_speakers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE accounts.id = account_speakers.account_id 
      AND accounts.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete speakers for their accounts" ON account_speakers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE accounts.id = account_speakers.account_id 
      AND accounts.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view intelligence data for their accounts" ON account_intelligence_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE accounts.id = account_intelligence_data.account_id 
      AND accounts.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert intelligence data for their accounts" ON account_intelligence_data
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE accounts.id = account_intelligence_data.account_id 
      AND accounts.created_by = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON accounts TO authenticated;
GRANT ALL ON account_speakers TO authenticated;
GRANT ALL ON account_intelligence_data TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_intelligence_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_accounts(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_speakers_with_events(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_intelligence_by_type(UUID, TEXT, INTEGER) TO authenticated;
