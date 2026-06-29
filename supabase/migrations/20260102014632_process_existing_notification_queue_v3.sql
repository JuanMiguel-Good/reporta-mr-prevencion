/*
  # Process Existing Notification Queue v3
  
  ## Overview
  This migration processes all pending notifications in the queue and inserts them
  into the notifications table so they appear in the notification bell.
  
  ## Changes
  1. Insert all pending notifications from queue into notifications table with proper types
  2. Mark them as sent in the queue
*/

-- Process all pending notifications
INSERT INTO notifications (user_id, company_id, type, title, message, data, read, created_at)
SELECT 
  nq.user_id,
  u.company_id,
  CASE 
    WHEN nq.title ILIKE '%nuevo reporte%' THEN 'report_created'
    WHEN nq.title ILIKE '%asignado%' THEN 'report_assigned'
    WHEN nq.title ILIKE '%evidencia%' THEN 'evidence_uploaded'
    WHEN nq.title ILIKE '%cerrado%' THEN 'report_closed'
    ELSE 'report_status_changed'
  END,
  nq.title,
  nq.body,
  nq.data,
  false,
  nq.created_at
FROM notification_queue nq
INNER JOIN users u ON u.id = nq.user_id
WHERE nq.status = 'pending'
ON CONFLICT DO NOTHING;

-- Update the queue to mark them as processed
UPDATE notification_queue
SET 
  status = 'sent',
  sent_at = now(),
  error_message = 'Processed by migration - in-app notification created'
WHERE status = 'pending';
