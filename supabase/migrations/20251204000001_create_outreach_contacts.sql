-- Create Outreach Contacts table
-- Stores contacts for the Outreach Orbit module

CREATE TABLE IF NOT EXISTS outreach_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core Identity
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT,
  
  -- Status & Workflow
  status TEXT NOT NULL CHECK (status IN (
    'NOT_STARTED', 'RESEARCHING', 'DRAFTING', 'READY_TO_SEND', 
    'SENT', 'REPLIED', 'CLOSED'
  )),
  outreach_step INTEGER DEFAULT 0,
  archived BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_contacted_date TIMESTAMPTZ,
  last_completed_date TIMESTAMPTZ, -- For weekly goal tracking
  reminder_date TIMESTAMPTZ,
  
  -- Preferences
  preferred_language TEXT DEFAULT 'English' CHECK (preferred_language IN ('English', 'German')),
  preferred_tone TEXT DEFAULT 'Formal' CHECK (preferred_tone IN ('Formal', 'Informal')),
  preferred_type TEXT DEFAULT 'Email' CHECK (preferred_type IN ('Email', 'LinkedIn', 'Follow-up')),
  
  -- Content & Research
  notes TEXT,
  background_info TEXT,
  grounding_links JSONB DEFAULT '[]'::jsonb, -- Array of {title, url}
  last_research_date TIMESTAMPTZ,
  
  -- AI Generated Content
  linkedin_bio TEXT,
  email_draft TEXT,
  specific_goal TEXT,
  
  -- Monitoring
  monitor_updates BOOLEAN DEFAULT true,
  has_new_intel BOOLEAN DEFAULT false,
  new_intel_summary TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_user_id ON outreach_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_status ON outreach_contacts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_archived ON outreach_contacts(user_id, archived);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_reminders ON outreach_contacts(user_id, reminder_date) WHERE reminder_date IS NOT NULL;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_outreach_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_outreach_contacts_updated_at
  BEFORE UPDATE ON outreach_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_outreach_contacts_updated_at();

-- Row Level Security (RLS)
ALTER TABLE outreach_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outreach contacts"
  ON outreach_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own outreach contacts"
  ON outreach_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own outreach contacts"
  ON outreach_contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own outreach contacts"
  ON outreach_contacts FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON outreach_contacts TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

