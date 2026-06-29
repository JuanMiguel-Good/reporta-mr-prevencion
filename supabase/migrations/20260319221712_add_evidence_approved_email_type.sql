/*
  # Add evidence_approved email type

  1. Changes
    - Updates the email_queue_email_type_check constraint to include 'evidence_approved'
    - This allows the system to send email notifications when evidence is approved
  
  2. Notes
    - Fixes the error: "new row for relation \"email_queue\" violates check constraint \"email_queue_email_type_check\""
    - This error was occurring when approving and closing reports
*/

-- Drop the existing constraint
ALTER TABLE email_queue DROP CONSTRAINT IF EXISTS email_queue_email_type_check;

-- Add the updated constraint with evidence_approved included
ALTER TABLE email_queue ADD CONSTRAINT email_queue_email_type_check 
CHECK (email_type = ANY (ARRAY[
  'new_report'::text,
  'report_assigned'::text,
  'evidence_uploaded'::text,
  'evidence_rejected'::text,
  'evidence_approved'::text,
  'daily_reminder'::text,
  'smtp_failure_alert'::text,
  'pending_assignment_reminder'::text,
  'deadline_reminder'::text,
  'admin_announcement'::text
]));