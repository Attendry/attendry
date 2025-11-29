-- GDPR Compliance Features
-- Adds consent tracking, data deletion audit, and data export functionality

-- Add consent and data source tracking to saved_speaker_profiles
ALTER TABLE saved_speaker_profiles
ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'manual' CHECK (data_source IN ('manual', 'auto_save', 'import')),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Add consent tracking to user_discovery_profiles
ALTER TABLE user_discovery_profiles
ADD COLUMN IF NOT EXISTS auto_save_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_save_consent_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_save_consent_version TEXT, -- Track which version of consent they agreed to
ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_policy_accepted_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS privacy_policy_version TEXT;

-- Create audit log table for GDPR compliance
CREATE TABLE IF NOT EXISTS data_access_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'view', 'export', 'delete', 'consent_given', 'consent_withdrawn'
  resource_type TEXT NOT NULL, -- 'contact', 'profile', 'research', 'all'
  resource_id UUID, -- ID of the resource (if applicable)
  details JSONB DEFAULT '{}', -- Additional context (what was accessed, etc.)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_data_audit_user ON data_access_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_audit_action ON data_access_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_audit_resource ON data_access_audit_log(resource_type, resource_id);

-- RLS policies for audit log
ALTER TABLE data_access_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit log" ON data_access_audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert audit log" ON data_access_audit_log
  FOR INSERT WITH CHECK (true);

-- Create data export requests table (for tracking export requests)
CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  format TEXT DEFAULT 'json' CHECK (format IN ('json', 'csv')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  file_url TEXT, -- URL to exported data file (stored in storage)
  expires_at TIMESTAMPTZ, -- Export files expire after 7 days
  error_message TEXT
);

-- Indexes for export requests
CREATE INDEX IF NOT EXISTS idx_export_requests_user ON data_export_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_requests_status ON data_export_requests(status, requested_at DESC);

-- RLS policies for export requests
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own export requests" ON data_export_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage export requests" ON data_export_requests
  FOR ALL USING (true);

-- Function to log data access
CREATE OR REPLACE FUNCTION log_data_access(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::JSONB,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO data_access_audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  )
  VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Function to soft delete contact (GDPR compliant)
CREATE OR REPLACE FUNCTION soft_delete_contact(
  p_contact_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT 'user_request'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update contact to mark as deleted
  UPDATE saved_speaker_profiles
  SET 
    deleted_at = NOW(),
    deletion_reason = p_reason,
    archived = true,
    monitor_updates = false
  WHERE id = p_contact_id
    AND user_id = p_user_id;
  
  -- Log the deletion
  PERFORM log_data_access(
    p_user_id,
    'delete',
    'contact',
    p_contact_id,
    jsonb_build_object('reason', p_reason, 'deleted_at', NOW())
  );
  
  RETURN TRUE;
END;
$$;

-- Function to get user's data summary for export
CREATE OR REPLACE FUNCTION get_user_data_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  summary JSONB;
BEGIN
  SELECT jsonb_build_object(
    'contacts', (
      SELECT COUNT(*) FROM saved_speaker_profiles
      WHERE user_id = p_user_id AND deleted_at IS NULL
    ),
    'archived_contacts', (
      SELECT COUNT(*) FROM saved_speaker_profiles
      WHERE user_id = p_user_id AND archived = true AND deleted_at IS NULL
    ),
    'deleted_contacts', (
      SELECT COUNT(*) FROM saved_speaker_profiles
      WHERE user_id = p_user_id AND deleted_at IS NOT NULL
    ),
    'research_records', (
      SELECT COUNT(*) FROM contact_research
      WHERE user_id = p_user_id
    ),
    'events', (
      SELECT COUNT(*) FROM collected_events
      WHERE user_id = p_user_id
    ),
    'exported_at', NOW()
  ) INTO summary;
  
  RETURN summary;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT ON data_access_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON data_export_requests TO authenticated;

-- Add comments
COMMENT ON TABLE data_access_audit_log IS 'GDPR audit log for data access, deletion, and consent changes';
COMMENT ON TABLE data_export_requests IS 'Tracks user data export requests for GDPR compliance';
COMMENT ON COLUMN saved_speaker_profiles.consent_given IS 'Whether user gave consent for this contact (required for auto-saved contacts)';
COMMENT ON COLUMN saved_speaker_profiles.data_source IS 'How this contact was created: manual, auto_save, or import';
COMMENT ON COLUMN saved_speaker_profiles.deleted_at IS 'Soft delete timestamp (GDPR Right to be Forgotten)';

