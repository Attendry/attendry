-- Create user_saved_views table for saving board view configurations
CREATE TABLE IF NOT EXISTS user_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  view_type TEXT NOT NULL CHECK (view_type IN ('kanban', 'list')),
  filters JSONB DEFAULT '{}',
  columns JSONB DEFAULT '[]',
  sort JSONB DEFAULT '{"field": "added", "direction": "desc"}',
  density TEXT DEFAULT 'comfortable' CHECK (density IN ('comfortable', 'compact')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_saved_views_user_id ON user_saved_views(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_views_user_type ON user_saved_views(user_id, view_type);
CREATE INDEX IF NOT EXISTS idx_user_saved_views_default ON user_saved_views(user_id, is_default) WHERE is_default = true;

-- Enable Row Level Security
ALTER TABLE user_saved_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/modify their own saved views
CREATE POLICY "user_saved_views read own" ON user_saved_views 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_saved_views insert own" ON user_saved_views 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_saved_views update own" ON user_saved_views 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_saved_views delete own" ON user_saved_views 
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_saved_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER update_user_saved_views_updated_at
  BEFORE UPDATE ON user_saved_views
  FOR EACH ROW
  EXECUTE FUNCTION update_user_saved_views_updated_at();

-- Function to ensure only one default view per user per view_type
CREATE OR REPLACE FUNCTION ensure_single_default_view()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other default views of the same type for this user
    UPDATE user_saved_views
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND view_type = NEW.view_type
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure single default view
CREATE TRIGGER ensure_single_default_view_trigger
  BEFORE INSERT OR UPDATE ON user_saved_views
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_view();

