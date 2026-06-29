/*
  # Simplify Automatic Push Notification Trigger

  ## Overview
  Since the send-push-notification edge function has JWT verification disabled,
  we can call it directly without authorization headers.

  ## Changes
  - Remove dependency on database settings that can't be configured
  - Use the correct Supabase URL directly
  - Remove Authorization header since the edge function doesn't require it
  - Add better error handling

  ## Security
  - The edge function itself handles all security by using the service role key
  - No sensitive data is exposed in the trigger
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
  v_supabase_url text := 'https://yrkjelaleitrfinopdzy.supabase.co';
BEGIN
  -- Call the edge function using pg_net
  -- No authorization needed as the edge function has verifyJWT: false
  -- and uses service role key internally
  SELECT INTO v_request_id extensions.net.http_post(
    url := v_supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'notificationId', NEW.id
    ),
    timeout_milliseconds := 30000
  );

  -- Log the request ID for debugging
  RAISE LOG 'Push notification HTTP request ID: %', v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to trigger push notification for ID %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER auto_send_push_notification
  AFTER INSERT ON notification_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_send_push_notification();
