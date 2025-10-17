-- Create table for storing user search results and history
CREATE TABLE IF NOT EXISTS user_search_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Search parameters
  search_params JSONB NOT NULL, -- { keywords, country, from, to, timestamp }
  
  -- Search results
  results JSONB[] NOT NULL DEFAULT '{}', -- Array of event objects
  result_count INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  searched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'), -- Auto-cleanup after 7 days
  
  -- Performance tracking
  search_duration_ms INTEGER, -- How long the search took
  api_endpoint TEXT, -- Which API endpoint was used
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_search_results_user_id ON user_search_results(user_id);
CREATE INDEX IF NOT EXISTS idx_user_search_results_searched_at ON user_search_results(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_search_results_expires_at ON user_search_results(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_search_results_user_searched ON user_search_results(user_id, searched_at DESC);

-- Create index for search parameters (for finding similar searches)
CREATE INDEX IF NOT EXISTS idx_user_search_results_params ON user_search_results USING GIN(search_params);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_search_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_search_results_updated_at
    BEFORE UPDATE ON user_search_results
    FOR EACH ROW EXECUTE FUNCTION update_user_search_results_updated_at();

-- Enable Row Level Security
ALTER TABLE user_search_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own search results" ON user_search_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search results" ON user_search_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search results" ON user_search_results
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search results" ON user_search_results
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to clean up expired search results
CREATE OR REPLACE FUNCTION cleanup_expired_search_results()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_search_results 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to limit search history per user (keep only last 10)
CREATE OR REPLACE FUNCTION limit_user_search_history(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete all but the 10 most recent searches for this user
    WITH recent_searches AS (
        SELECT id 
        FROM user_search_results 
        WHERE user_id = p_user_id 
        ORDER BY searched_at DESC 
        LIMIT 10
    )
    DELETE FROM user_search_results 
    WHERE user_id = p_user_id 
    AND id NOT IN (SELECT id FROM recent_searches);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to save search results
CREATE OR REPLACE FUNCTION save_search_results(
    p_user_id UUID,
    p_search_params JSONB,
    p_results JSONB[],
    p_search_duration_ms INTEGER DEFAULT NULL,
    p_api_endpoint TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_result_count INTEGER;
BEGIN
    -- Get result count
    v_result_count := array_length(p_results, 1);
    IF v_result_count IS NULL THEN
        v_result_count := 0;
    END IF;
    
    -- Insert the search result
    INSERT INTO user_search_results (
        user_id,
        search_params,
        results,
        result_count,
        search_duration_ms,
        api_endpoint
    ) VALUES (
        p_user_id,
        p_search_params,
        p_results,
        v_result_count,
        p_search_duration_ms,
        p_api_endpoint
    ) RETURNING id INTO v_id;
    
    -- Clean up old searches for this user (keep only last 10)
    PERFORM limit_user_search_history(p_user_id);
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON user_search_results TO authenticated;
GRANT EXECUTE ON FUNCTION save_search_results TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_search_results TO authenticated;
GRANT EXECUTE ON FUNCTION limit_user_search_history TO authenticated;
