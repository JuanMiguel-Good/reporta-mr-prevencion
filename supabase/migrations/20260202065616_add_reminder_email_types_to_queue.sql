/*
  # Add Reminder Email Types to Email Queue

  1. Changes
    - Add 'pending_assignment_reminder' email type
    - Add 'deadline_reminder' email type
    
  2. Purpose
    - Allow automated reminder emails to be queued
*/

-- Drop existing constraint
ALTER TABLE email_queue 
  DROP CONSTRAINT IF EXISTS email_queue_email_type_check;

-- Add updated constraint with new email types
ALTER TABLE email_queue 
  ADD CONSTRAINT email_queue_email_type_check 
  CHECK (email_type = ANY (ARRAY[
    'new_report'::text, 
    'report_assigned'::text, 
    'evidence_uploaded'::text, 
    'evidence_rejected'::text, 
    'daily_reminder'::text, 
    'smtp_failure_alert'::text,
    'pending_assignment_reminder'::text,
    'deadline_reminder'::text
  ]));