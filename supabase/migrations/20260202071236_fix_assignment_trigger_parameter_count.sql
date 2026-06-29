/*
  # Fix Assignment Email Trigger

  1. Changes
    - Update trigger_queue_assignment_email to pass the proposed_closure_date parameter
    - This fixes the error when assigning a responsible person
    
  2. Purpose
    - Ensure the trigger calls generate_report_assigned_email with the correct number of parameters
*/

CREATE OR REPLACE FUNCTION trigger_queue_assignment_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assigned_user RECORD;
  v_email_content RECORD;
BEGIN
  -- Only send if assigned_to_id changed and is not null
  IF NEW.assigned_to_id IS NOT NULL AND (
    OLD.assigned_to_id IS NULL OR OLD.assigned_to_id != NEW.assigned_to_id
  ) THEN
    -- Get assigned user details
    SELECT id, email, full_name INTO v_assigned_user
    FROM users
    WHERE id = NEW.assigned_to_id
      AND email IS NOT NULL
      AND email != '';
    
    IF FOUND THEN
      -- Generate email content with closure date
      SELECT * INTO v_email_content
      FROM generate_report_assigned_email(
        NEW.id, 
        NEW.company_id, 
        v_assigned_user.full_name,
        NEW.proposed_closure_date
      );
      
      -- Queue the email
      PERFORM enqueue_email(
        NEW.company_id,
        v_assigned_user.id,
        v_assigned_user.email,
        'report_assigned',
        v_email_content.subject,
        v_email_content.html_body,
        jsonb_build_object('report_id', NEW.id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;