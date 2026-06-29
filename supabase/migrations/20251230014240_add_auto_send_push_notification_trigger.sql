/*
  # Add Automatic Push Notification Sending

  1. Changes
    - Create trigger to automatically call edge function when notification is queued
    - Use pg_net extension to make HTTP requests to edge function
    - Ensure notifications are sent immediately after being queued

  2. Security
    - Function runs with SECURITY DEFINER to have proper permissions
    - Only triggers on INSERT to notification_queue with status 'pending'
*/

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION trigger_send_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_function_url text;
  v_service_role_key text;
  v_request_id bigint;
BEGIN
  v_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification';
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  IF v_function_url IS NULL OR v_service_role_key IS NULL THEN
    v_function_url := 'https://vrkjelaleltfrinogdzv.supabase.co/functions/v1/send-push-notification';
  END IF;

  SELECT INTO v_request_id extensions.net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role_key, '')
    ),
    body := jsonb_build_object(
      'notificationId', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_send_push_notification ON notification_queue;

CREATE TRIGGER auto_send_push_notification
  AFTER INSERT ON notification_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_send_push_notification();