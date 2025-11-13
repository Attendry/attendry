-- Create user_event_board table for Kanban board feature
CREATE TABLE IF NOT EXISTS user_event_board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES collected_events(id) ON DELETE SET NULL,
  event_url TEXT NOT NULL, -- Fallback if event not in collected_events
  column_status TEXT NOT NULL DEFAULT 'interested', -- 'interested', 'researching', 'attending', 'follow-up', 'archived'
  position INTEGER DEFAULT 0, -- For ordering within column
  notes TEXT,
  tags TEXT[],
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_url)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_event_board_user_status ON user_event_board(user_id, column_status);
CREATE INDEX IF NOT EXISTS idx_user_event_board_user_id ON user_event_board(user_id);
CREATE INDEX IF NOT EXISTS idx_user_event_board_event_id ON user_event_board(event_id);

-- Enable Row Level Security
ALTER TABLE user_event_board ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/modify their own board items
CREATE POLICY "user_event_board read own" ON user_event_board 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_event_board insert own" ON user_event_board 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_event_board update own" ON user_event_board 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_event_board delete own" ON user_event_board 
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_event_board_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER update_user_event_board_updated_at
  BEFORE UPDATE ON user_event_board
  FOR EACH ROW
  EXECUTE FUNCTION update_user_event_board_updated_at();

