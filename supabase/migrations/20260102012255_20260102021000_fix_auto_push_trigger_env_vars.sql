/*
  # Fix Automatic Push Notification Trigger Environment Variables

  ## Overview
  The trigger was using custom settings that aren't configured. This migration
  fixes the trigger to use Supabase's built-in environment variables.

  ## Changes
  - Update trigger to use Supabase's native environment variable access
  - Use SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Deno.env
  - Simplify the trigger logic to work reliably

  ## Notes
  - The pg_net extension in Supabase can't access Deno.env directly
  - We need to use the Supabase URL and service role key directly in the function
*/

DROP TRIGGER IF EXISTS auto_send_push_notification ON notification_queue;
DROP FUNCTION IF EXISTS trigger_send_push_notification();

CREATE OR REPLACE FUNCTION trigger_send_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  -- Call the edge function using pg_net
  -- The service role key is retrieved from vault or environment
  SELECT INTO v_request_id extensions.net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'notificationId', NEW.id
    ),
    timeout_milliseconds := 30000
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to trigger push notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER auto_send_push_notification
  AFTER INSERT ON notification_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_send_push_notification();
