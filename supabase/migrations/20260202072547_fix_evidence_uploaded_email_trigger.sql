/*
  # Fix Evidence Uploaded Email Trigger
  
  1. Problem
    - trigger_queue_evidence_uploaded_emails calls generate_evidence_uploaded_email with 4 parameters
    - But generate_evidence_uploaded_email only accepts 3 parameters now
    - This causes "function does not exist" errors
    
  2. Solution
    - Update the trigger to call the function with only 3 parameters (removed p_uploader_name)
*/

CREATE OR REPLACE FUNCTION trigger_queue_evidence_uploaded_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_manager RECORD;
  v_email_content RECORD;
BEGIN
  -- Only send if status changed to 'in_review'
  IF NEW.status = 'in_review' AND (OLD.status IS NULL OR OLD.status != 'in_review') THEN
    -- Get all SST managers for this company
    FOR v_manager IN 
      SELECT * FROM get_sst_managers_for_company(NEW.company_id)
    LOOP
      -- Generate email content (now with 3 parameters only)
      SELECT * INTO v_email_content
      FROM generate_evidence_uploaded_email(
        NEW.id, 
        NEW.company_id, 
        v_manager.full_name
      );
      
      -- Queue the email
      PERFORM enqueue_email(
        NEW.company_id,
        v_manager.user_id,
        v_manager.email,
        'evidence_uploaded',
        v_email_content.subject,
        v_email_content.html_body,
        jsonb_build_object('report_id', NEW.id)
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;
