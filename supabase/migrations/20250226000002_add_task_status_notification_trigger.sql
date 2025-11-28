-- ============================================================================
-- Task Status Change Notification Trigger
-- ============================================================================
-- Optional: This trigger sends PostgreSQL notifications when task status
-- changes to 'completed' or 'failed'. This can be used for additional
-- notification mechanisms beyond Supabase real-time subscriptions.
--
-- Note: This is optional and not required for the real-time subscription
-- feature to work. Supabase real-time subscriptions handle updates directly.
-- ============================================================================

-- Function to notify on task completion
CREATE OR REPLACE FUNCTION notify_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify on status changes to completed or failed
  IF NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status THEN
    PERFORM pg_notify(
      'task_status_change',
      json_build_object(
        'task_id', NEW.id,
        'agent_id', NEW.agent_id,
        'status', NEW.status,
        'contact_id', NEW.input_data->>'contactId',
        'task_type', NEW.task_type,
        'completed_at', NEW.completed_at
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS task_status_change_trigger ON agent_tasks;
CREATE TRIGGER task_status_change_trigger
  AFTER UPDATE OF status ON agent_tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_task_status_change();

-- Add comment
COMMENT ON FUNCTION notify_task_status_change() IS 
  'Sends PostgreSQL notification when task status changes to completed or failed';

