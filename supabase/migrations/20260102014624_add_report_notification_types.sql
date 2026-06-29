/*
  # Add Report Notification Types
  
  ## Overview
  Extends the notifications table to support report-related notification types.
  
  ## Changes
  1. Drop existing type check constraint
  2. Add new constraint with report notification types included
*/

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with report types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'ai_limit_50'::text,
  'ai_limit_80'::text,
  'ai_limit_100'::text,
  'ai_limit_renewed'::text,
  'limit_request_approved'::text,
  'limit_request_rejected'::text,
  'plan_upgraded'::text,
  'plan_limit_reached'::text,
  'report_created'::text,
  'report_assigned'::text,
  'report_status_changed'::text,
  'evidence_uploaded'::text,
  'evidence_rejected'::text,
  'report_closed'::text
]));
