/*
  # Fix Notification Trigger for Assigned Responsible

  ## Overview
  Updates the notification trigger to use `assigned_to_id` instead of the removed `responsible_id` field.

  ## Changes
  1. Drop and recreate `notify_responsible_assigned()` function
     - Change from `responsible_id` to `assigned_to_id`
     - Update to reflect current database schema
  
  2. Recreate the trigger to use the updated function

  ## Impact
  - Fixes error when assigning a responsible person to close reports
  - Notifications will now be sent correctly when someone is assigned
*/

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS on_responsible_assigned ON reports;
DROP FUNCTION IF EXISTS notify_responsible_assigned();

-- Create updated function using assigned_to_id
CREATE OR REPLACE FUNCTION notify_responsible_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.assigned_to_id IS DISTINCT FROM NEW.assigned_to_id AND NEW.assigned_to_id IS NOT NULL THEN
    INSERT INTO notification_queue (user_id, title, body, data)
    VALUES (
      NEW.assigned_to_id,
      'Reporte Asignado',
      'Se te ha asignado como responsable del cierre de un reporte: "' || COALESCE(SUBSTRING(NEW.description, 1, 50), 'Sin descripción') || '..."',
      jsonb_build_object(
        'reportId', NEW.id,
        'status', NEW.status,
        'url', '/gallery'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_responsible_assigned
  AFTER UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_responsible_assigned();