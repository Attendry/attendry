-- Fix authentication and RLS policies
-- This migration addresses the magic link authentication issues

-- First, let's check if search_sessions table exists and fix its policies
-- Allow unauthenticated users to insert search sessions (for the system to work)
DROP POLICY IF EXISTS "Allow authenticated users to insert search sessions" ON search_sessions;
CREATE POLICY "Allow anyone to insert search sessions" ON search_sessions
  FOR INSERT WITH CHECK (true);

-- Allow anyone to read search sessions (for debugging)
DROP POLICY IF EXISTS "Allow authenticated users to read search sessions" ON search_sessions;
CREATE POLICY "Allow anyone to read search sessions" ON search_sessions
  FOR SELECT USING (true);

-- Fix search_results policies as well
DROP POLICY IF EXISTS "Allow authenticated users to insert search results" ON search_results;
CREATE POLICY "Allow anyone to insert search results" ON search_results
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to read search results" ON search_results;
CREATE POLICY "Allow anyone to read search results" ON search_results
  FOR SELECT USING (true);

-- Update search_configurations to allow unauthenticated access for default config
DROP POLICY IF EXISTS "Allow authenticated users to read search configurations" ON search_configurations;
CREATE POLICY "Allow anyone to read search configurations" ON search_configurations
  FOR SELECT USING (true);

-- Keep insert/update restricted to authenticated users for admin operations
DROP POLICY IF EXISTS "Allow authenticated users to insert search configurations" ON search_configurations;
CREATE POLICY "Allow authenticated users to insert search configurations" ON search_configurations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to update search configurations" ON search_configurations;
CREATE POLICY "Allow authenticated users to update search configurations" ON search_configurations
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Create a function to handle magic link authentication issues
CREATE OR REPLACE FUNCTION handle_auth_errors()
RETURNS TRIGGER AS $$
BEGIN
  -- Log authentication attempts for debugging
  INSERT INTO search_sessions (query, provider, result_count)
  VALUES ('auth_debug', 'system', 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add a comment explaining the auth setup
COMMENT ON TABLE search_sessions IS 'Search sessions table - allows unauthenticated access for system functionality';
COMMENT ON TABLE search_configurations IS 'Search configurations - read access for all, write access for authenticated users only';
