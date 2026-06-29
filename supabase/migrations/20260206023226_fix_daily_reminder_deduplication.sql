/*
  # Fix Daily Reminder Email Deduplication

  1. Problem
    - The enqueue_email function prevents daily_reminder emails from being sent more than once every 30 days
    - This is because the deduplication check matches ANY daily_reminder in the last 30 days
    - Daily reminders should be sent once per day, not once per month

  2. Solution
    - Update deduplication logic to check different time windows based on email type:
      - daily_reminder: Only check last 18 hours (same day)
      - Other types: Keep 30-day check

  3. Impact
    - Daily reminders will now be sent every day as intended
    - Other email types maintain their 30-day deduplication protection
*/

CREATE OR REPLACE FUNCTION enqueue_email(
  p_company_id uuid,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_email_type text,
  p_subject text,
  p_html_body text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_scheduled_for timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email_id uuid;
  v_email_status text;
  v_dedup_key text;
  v_already_sent boolean;
  v_dedup_interval interval;
BEGIN
  -- Check if email is blocked due to bounces
  SELECT status INTO v_email_status
  FROM email_delivery_status
  WHERE email_address = p_recipient_email;

  -- Don't queue emails to invalid addresses
  IF v_email_status IN ('hard_bounce', 'invalid') THEN
    RAISE NOTICE 'Email % is marked as %, skipping', p_recipient_email, v_email_status;
    RETURN NULL;
  END IF;

  -- Calculate deduplication key
  v_dedup_key := p_recipient_email || '|' || p_email_type || '|' || 
    COALESCE((p_data->>'announcement_id')::text, '') || '|' ||
    COALESCE((p_data->>'report_id')::text, '');

  -- Set deduplication interval based on email type
  -- Daily reminders should only be deduplicated within the same day
  IF p_email_type = 'daily_reminder' THEN
    v_dedup_interval := INTERVAL '18 hours';
  ELSE
    v_dedup_interval := INTERVAL '30 days';
  END IF;

  -- Check if this exact email was already sent in the deduplication window
  SELECT EXISTS (
    SELECT 1 
    FROM email_history 
    WHERE recipient_email = p_recipient_email
      AND email_type = p_email_type
      AND (
        (p_data->>'announcement_id' IS NOT NULL AND (data->>'announcement_id')::uuid = (p_data->>'announcement_id')::uuid)
        OR
        (p_data->>'report_id' IS NOT NULL AND (data->>'report_id')::uuid = (p_data->>'report_id')::uuid)
        OR
        (p_data->>'announcement_id' IS NULL AND p_data->>'report_id' IS NULL)
      )
      AND sent_at >= NOW() - v_dedup_interval
  ) INTO v_already_sent;

  -- If already sent, skip
  IF v_already_sent THEN
    RAISE NOTICE 'Email already sent (dedup_key: %), skipping', v_dedup_key;
    RETURN NULL;
  END IF;

  -- Insert into queue
  INSERT INTO email_queue (
    company_id,
    recipient_user_id,
    recipient_email,
    email_type,
    subject,
    html_body,
    data,
    status,
    scheduled_for
  )
  VALUES (
    p_company_id,
    p_recipient_user_id,
    p_recipient_email,
    p_email_type,
    p_subject,
    p_html_body,
    p_data,
    'pending',
    p_scheduled_for
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_email_id;

  RETURN v_email_id;
EXCEPTION
  WHEN unique_violation THEN
    -- Email already in queue, skip silently
    RAISE NOTICE 'Email already in queue (dedup_key: %), skipping', v_dedup_key;
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION enqueue_email IS 'Encola un email para envío. Daily reminders se deduplicitan por día, otros emails por 30 días';
