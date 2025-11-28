-- Migration to enable real-time replication on agent_tasks table
-- This allows Supabase real-time subscriptions to work for task status updates
-- 
-- Note: This migration adds the table to the supabase_realtime publication
-- If you're running this manually, you can also enable it via Supabase Dashboard:
-- Database → Replication → Enable for agent_tasks table

-- Check if the publication exists (it should by default in Supabase)
DO $$
BEGIN
  -- Add agent_tasks to the realtime publication if not already added
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'agent_tasks'
  ) THEN
    -- This requires superuser privileges, so it may need to be run manually
    -- or via Supabase Dashboard
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;
    
    RAISE NOTICE 'Added agent_tasks to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'agent_tasks is already in supabase_realtime publication';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Insufficient privileges to add table to publication. Please enable real-time via Supabase Dashboard: Database → Replication → Enable for agent_tasks';
  WHEN OTHERS THEN
    RAISE WARNING 'Error enabling real-time: %', SQLERRM;
END $$;

-- Verify RLS policies allow real-time subscriptions
-- Users should be able to SELECT their own agent tasks (which is required for real-time)
-- This should already be covered by existing RLS policies from migration 20250121000001
-- But we'll add a comment for documentation

COMMENT ON TABLE agent_tasks IS 
  'Agent tasks table with real-time replication enabled. Users can subscribe to changes via Supabase real-time subscriptions. RLS policies ensure users only see their own agent tasks.';

-- Add helpful comment for developers
COMMENT ON COLUMN agent_tasks.status IS 
  'Task status: pending, in_progress, completed, failed, cancelled. Real-time subscriptions will notify on status changes.';

