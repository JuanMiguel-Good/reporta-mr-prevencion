/*
  # Prevenir Duplicados en enqueue_email

  1. Problema
    - La función enqueue_email no verifica si el email ya fue enviado
    - Esto causa que se reencolen emails que ya se enviaron exitosamente

  2. Solución
    - Modificar enqueue_email para verificar email_history antes de encolar
    - Si el email ya se envió en los últimos 30 días, no lo encola nuevamente
    - Usar la deduplication_key para verificación más precisa

  3. Impacto
    - Evita emails duplicados a usuarios
    - Respeta el límite de envío de Hostinger
    - Mejora experiencia del usuario
*/

-- Actualizar función enqueue_email para verificar historial
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

  -- Check if this exact email was already sent in the last 30 days
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
      AND sent_at >= NOW() - INTERVAL '30 days'
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

COMMENT ON FUNCTION enqueue_email IS 'Encola un email para envío, verificando primero si ya fue enviado o está en cola';
