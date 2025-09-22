-- Setup script for search result persistence
-- Run this in your Supabase SQL Editor

-- Create search_sessions table
CREATE TABLE IF NOT EXISTS search_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  country TEXT,
  provider TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create search_results table
CREATE TABLE IF NOT EXISTS search_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES search_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_sessions_created_at ON search_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_search_sessions_query ON search_sessions(query);
CREATE INDEX IF NOT EXISTS idx_search_results_session_id ON search_results(session_id);
CREATE INDEX IF NOT EXISTS idx_search_results_created_at ON search_results(created_at);

-- Add RLS policies
ALTER TABLE search_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read search sessions
CREATE POLICY "Allow authenticated users to read search sessions" ON search_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert search sessions
CREATE POLICY "Allow authenticated users to insert search sessions" ON search_sessions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to read search results
CREATE POLICY "Allow authenticated users to read search results" ON search_results
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert search results
CREATE POLICY "Allow authenticated users to insert search results" ON search_results
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
