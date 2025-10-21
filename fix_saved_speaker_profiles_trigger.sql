-- Fix the saved_speaker_profiles trigger to handle the correct field name
-- The error occurs because the trigger is trying to update a field that doesn't exist in the context

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS update_saved_speaker_profiles_updated_at ON saved_speaker_profiles;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Create a specific function for saved_speaker_profiles
CREATE OR REPLACE FUNCTION update_saved_speaker_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger only for UPDATE operations
CREATE TRIGGER update_saved_speaker_profiles_updated_at
    BEFORE UPDATE ON saved_speaker_profiles
    FOR EACH ROW EXECUTE FUNCTION update_saved_speaker_profiles_updated_at();

-- Also create a separate function for enhanced_speaker_profiles if needed
CREATE OR REPLACE FUNCTION update_enhanced_speaker_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Update the enhanced_speaker_profiles trigger
DROP TRIGGER IF EXISTS update_enhanced_speaker_profiles_updated_at ON enhanced_speaker_profiles;
CREATE TRIGGER update_enhanced_speaker_profiles_updated_at
    BEFORE UPDATE ON enhanced_speaker_profiles
    FOR EACH ROW EXECUTE FUNCTION update_enhanced_speaker_profiles_updated_at();