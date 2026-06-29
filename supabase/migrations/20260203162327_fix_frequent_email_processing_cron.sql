/*
  # Fix Frequent Email Processing Cron Job

  1. Purpose
    - Update the frequent cron job (every 5 minutes) to use Edge Function
    - Ensure emails are processed quickly after being queued
    - Fix issue where SQL function couldn't find Supabase settings

  2. Changes
    - Remove old frequent cron job that calls SQL function
    - Create new frequent cron job that calls Edge Function
    - Uses same pattern as hourly job with embedded credentials

  3. Result
    - Emails will be sent within 5 minutes of being queued
    - Notifications arrive near-instantly instead of waiting up to 1 hour
*/

-- Remove old frequent cron job
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-email-queue-frequent';

-- Create new frequent cron job that calls Edge Function
-- Runs every 5 minutes to process pending emails
SELECT cron.schedule(
  'process-email-queue-frequent',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://yrkjelaleitrfinopdzy.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlya2plbGFsZWl0cmZpbm9wZHp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTI4ODM4NCwiZXhwIjoyMDUwODY0Mzg0fQ.Hn2y1Qv4_Ht0dflJ-D8GFJT_ykJoYFRk6pYST_N1wSg'
    )
  );
  $$
);
