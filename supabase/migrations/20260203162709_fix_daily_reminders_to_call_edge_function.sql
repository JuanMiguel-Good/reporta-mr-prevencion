/*
  # Fix Daily Reminders to Call Edge Function

  1. Problem
    - Current cron job only calls SQL function generate_consolidated_daily_reminders()
    - This only sends the consolidated summary, NOT individual reminders
    - Functions like send_pending_assignment_reminders() are never called

  2. Solution
    - Update cron job to call Edge Function send-daily-reminders
    - Edge Function executes ALL reminder functions:
      - send_pending_assignment_reminders() - Daily after 24h
      - send_deadline_reminders() - 3d, 1d, same day before deadline
      - send_pending_review_reminders() - Daily after 24h in review
      - Plus consolidated summary to all managers

  3. Schedule
    - Runs at 08:00 AM Peru time (13:00 UTC)
    - All reminders processed in one execution
*/

-- Remove old job
SELECT cron.unschedule(3);

-- Create new job that calls Edge Function
SELECT cron.schedule(
  'send-daily-reminders',
  '0 13 * * *', -- 13:00 UTC = 08:00 Peru time
  $$
  SELECT net.http_post(
    url := 'https://yrkjelaleitrfinopdzy.supabase.co/functions/v1/send-daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlya2plbGFsZWl0cmZpbm9wZHp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTI4ODM4NCwiZXhwIjoyMDUwODY0Mzg0fQ.Hn2y1Qv4_Ht0dflJ-D8GFJT_ykJoYFRk6pYST_N1wSg'
    )
  );
  $$
);

-- Remove redundant hourly email processing job (we have frequent one every 5 min)
SELECT cron.unschedule(5);
