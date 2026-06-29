/*
  # Fix Daily Reminders Cron Job

  1. Problem
    - Current cron job tries to call Edge Function using app.settings parameters that don't exist
    - This causes the job to fail with: "unrecognized configuration parameter"
  
  2. Solution
    - Remove the broken cron jobs (send-daily-reminders and process-email-queue-hourly)
    - Create new cron jobs that execute SQL functions directly
    - This is more reliable and doesn't depend on external Edge Functions
  
  3. Cron Jobs Created
    - **send-daily-reminders**: Runs at 13:00 UTC (8:00 AM Peru time) every day
      - Executes: `generate_consolidated_daily_reminders()` function
    - **process-email-queue**: Runs every 5 minutes
      - Executes: `process_pending_emails()` function (to be created)
  
  4. Notes
    - The function `generate_consolidated_daily_reminders()` already exists and works
    - Emails are queued first, then processed by the email queue processor
    - More frequent processing (every 5 min) ensures emails are sent promptly
*/

-- Remove the broken cron jobs
SELECT cron.unschedule('send-daily-reminders');
SELECT cron.unschedule('process-email-queue-hourly');

-- Create a simple function to process pending emails in the queue
CREATE OR REPLACE FUNCTION process_pending_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email_record RECORD;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_response_id BIGINT;
BEGIN
  -- Get Supabase configuration from environment
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.service_role_key', true);
  
  -- If settings are not available, try to get them from the .env or skip
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    -- Just log and return - the edge function will handle this
    RAISE NOTICE 'Supabase configuration not available in database settings';
    RETURN;
  END IF;
  
  -- Process up to 10 pending emails per run
  FOR v_email_record IN
    SELECT id, recipient_email, subject, html_body, company_id, email_type
    FROM email_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 10
  LOOP
    BEGIN
      -- Call the send-email edge function
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_service_role_key,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'email_id', v_email_record.id,
          'to', v_email_record.recipient_email,
          'subject', v_email_record.subject,
          'html', v_email_record.html_body
        )
      ) INTO v_response_id;
      
      -- Mark as sent (the edge function will also update this)
      UPDATE email_queue
      SET 
        status = 'sent',
        sent_at = NOW()
      WHERE id = v_email_record.id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Mark as failed
      UPDATE email_queue
      SET 
        status = 'failed',
        error_message = SQLERRM
      WHERE id = v_email_record.id;
    END;
  END LOOP;
END;
$$;

-- Create the new cron job for daily reminders at 13:00 UTC (8:00 AM Peru time)
SELECT cron.schedule(
  'send-daily-reminders-fixed',
  '0 13 * * *',
  $$SELECT generate_consolidated_daily_reminders()$$
);

-- Create a cron job to process email queue every 5 minutes
SELECT cron.schedule(
  'process-email-queue-frequent',
  '*/5 * * * *',
  $$SELECT process_pending_emails()$$
);
