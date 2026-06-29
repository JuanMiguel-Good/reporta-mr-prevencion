/*
  # Configure Daily Reminders Cron Job

  1. Purpose
    - Enable pg_cron extension for scheduled tasks
    - Schedule daily execution of reminder functions
    - Runs at 8:00 AM Peru time (UTC-5) every day

  2. What it does
    - Calls the send-daily-reminders edge function daily
    - Sends pending assignment reminders (day 2, then every 2 days)
    - Sends deadline reminders (3 days before, 1 day before, same day, then every 2 days after)
    - Processes email queue automatically

  3. Schedule
    - Runs at 08:00 AM Peru time (13:00 UTC)
    - Every day without exceptions
*/

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule any existing reminder jobs to avoid duplicates
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('send-daily-reminders', 'process-email-queue-hourly');

-- Schedule daily reminders at 8:00 AM Peru time (13:00 UTC)
-- This calls our edge function which handles all reminder logic
SELECT cron.schedule(
  'send-daily-reminders',
  '0 13 * * *', -- 13:00 UTC = 08:00 Peru time
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-daily-reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Schedule email queue processing every hour
SELECT cron.schedule(
  'process-email-queue-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Store Supabase settings if not already set
DO $$
BEGIN
  -- These will be used by cron jobs
  -- In Supabase hosted projects, these are automatically available
  IF current_setting('app.settings.supabase_url', true) IS NULL THEN
    PERFORM set_config('app.settings.supabase_url', current_setting('SUPABASE_URL', true), false);
  END IF;
  
  IF current_setting('app.settings.supabase_service_role_key', true) IS NULL THEN
    PERFORM set_config('app.settings.supabase_service_role_key', current_setting('SUPABASE_SERVICE_ROLE_KEY', true), false);
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- Settings will be configured by Supabase platform
    NULL;
END $$;