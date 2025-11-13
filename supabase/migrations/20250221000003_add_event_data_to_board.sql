-- Add event_data column to store full event information
ALTER TABLE user_event_board 
ADD COLUMN IF NOT EXISTS event_data JSONB;

-- Create index for event_data queries
CREATE INDEX IF NOT EXISTS idx_user_event_board_event_data ON user_event_board USING GIN (event_data);

