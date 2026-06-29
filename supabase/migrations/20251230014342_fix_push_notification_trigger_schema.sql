/*
  # Fix Push Notification Trigger Schema Reference

  1. Changes
    - Update trigger function to use correct schema for pg_net
    - Change from extensions.net.http_post to net.http_post
*/

CREATE OR REPLACE FUNCTION trigger_send_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_function_url text;
  v_request_id bigint;
BEGIN
  v_function_url := 'https://vrkjelaleltfrinogdzv.supabase.co/functions/v1/send-push-notification';

  SELECT INTO v_request_id net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'notificationId', NEW.id
    )
  );

  RETURN NEW;
END;
$$;