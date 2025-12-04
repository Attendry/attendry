-- Add Outreach Orbit fields to saved_speaker_profiles
-- Migration: 20251204000002
-- Adds fields needed for Outreach Orbit module integration

ALTER TABLE saved_speaker_profiles 
  ADD COLUMN IF NOT EXISTS outreach_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_completed_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_draft TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_bio TEXT,
  ADD COLUMN IF NOT EXISTS specific_goal TEXT;

-- Update outreach_status to support Outreach Orbit statuses
-- Note: We'll keep the existing enum but map Outreach Orbit statuses to it
-- Outreach Orbit uses: NOT_STARTED, RESEARCHING, DRAFTING, READY_TO_SEND, SENT, REPLIED, CLOSED
-- Existing uses: not_started, contacted, responded, meeting_scheduled
-- We'll map: NOT_STARTED -> not_started, SENT -> contacted, REPLIED -> responded, etc.

-- Add index for outreach_step
CREATE INDEX IF NOT EXISTS idx_saved_profiles_outreach_step ON saved_speaker_profiles(user_id, outreach_step);

-- Add index for last_completed_date (for weekly goal tracking)
CREATE INDEX IF NOT EXISTS idx_saved_profiles_last_completed ON saved_speaker_profiles(user_id, last_completed_date) WHERE last_completed_date IS NOT NULL;

