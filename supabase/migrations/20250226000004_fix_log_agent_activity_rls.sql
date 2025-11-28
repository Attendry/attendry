-- Migration: 20250226000004
-- Fix RLS policy for log_agent_activity function
-- The function needs SECURITY DEFINER to bypass RLS when called from server context

-- ============================================================================
-- Fix log_agent_activity function to work with RLS
-- ============================================================================

-- Drop and recreate function with SECURITY DEFINER
DROP FUNCTION IF EXISTS log_agent_activity(UUID, UUID, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION log_agent_activity(
  p_agent_id UUID,
  p_task_id UUID,
  p_action_type TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Allows function to bypass RLS
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
BEGIN
  -- Verify agent exists and get user_id for validation
  SELECT user_id INTO v_user_id
  FROM ai_agents
  WHERE id = p_agent_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Agent not found: %', p_agent_id;
  END IF;
  
  -- Insert activity log (RLS will be bypassed due to SECURITY DEFINER)
  INSERT INTO agent_activity_log (agent_id, task_id, action_type, description, metadata)
  VALUES (p_agent_id, p_task_id, p_action_type, p_description, p_metadata)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION log_agent_activity(UUID, UUID, TEXT, TEXT, JSONB) IS 
  'Logs agent activity. Uses SECURITY DEFINER to bypass RLS when called from server context.';

