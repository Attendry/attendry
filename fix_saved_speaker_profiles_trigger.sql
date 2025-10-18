-- Fix saved_speaker_profiles trigger to use correct field name
-- This migration fixes the trigger that was trying to update 'updated_at' 
-- when the table actually has 'last_updated' field

-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS update_saved_speaker_profiles_updated_at ON saved_speaker_profiles;

-- Update the trigger function to use the correct field name
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger with the correct field reference
CREATE TRIGGER update_saved_speaker_profiles_updated_at
    BEFORE UPDATE ON saved_speaker_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify the table structure (optional - for confirmation)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'saved_speaker_profiles' 
-- ORDER BY ordinal_position;
