-- Add Competitor Feedback Tables
-- Migration: 20250225000001
-- Enhancement 1: User Feedback Mechanism for Match Accuracy

-- Table to store user feedback on competitor matches
CREATE TABLE IF NOT EXISTS competitor_match_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES collected_events(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  matched_name TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('speaker', 'sponsor', 'attendee', 'organizer')),
  is_correct BOOLEAN NOT NULL,
  user_correction TEXT,
  confidence_score DECIMAL(3,2),
  feedback_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_competitor_feedback_user ON competitor_match_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_competitor_feedback_competitor ON competitor_match_feedback(competitor_name);
CREATE INDEX IF NOT EXISTS idx_competitor_feedback_event ON competitor_match_feedback(event_id);
CREATE INDEX IF NOT EXISTS idx_competitor_feedback_correct ON competitor_match_feedback(is_correct) WHERE is_correct = false;

-- Table to track learned patterns (for ML improvement)
CREATE TABLE IF NOT EXISTS competitor_matching_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name TEXT NOT NULL,
  learned_pattern TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  feedback_count INTEGER DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competitor_name, learned_pattern, user_id)
);

CREATE INDEX IF NOT EXISTS idx_matching_rules_competitor ON competitor_matching_rules(competitor_name);
CREATE INDEX IF NOT EXISTS idx_matching_rules_user ON competitor_matching_rules(user_id);

-- Table for user-specific exclusions (competitors user marked as "not a match")
CREATE TABLE IF NOT EXISTS competitor_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  excluded_pattern TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, competitor_name, excluded_pattern)
);

CREATE INDEX IF NOT EXISTS idx_competitor_exclusions_user ON competitor_exclusions(user_id, competitor_name);

-- Add comments for documentation
COMMENT ON TABLE competitor_match_feedback IS 'User feedback on competitor matches to improve matching accuracy';
COMMENT ON TABLE competitor_matching_rules IS 'Learned patterns from user feedback to improve matching';
COMMENT ON TABLE competitor_exclusions IS 'User-specific exclusions for competitor matches';

