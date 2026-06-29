/*
  # Fix Auto Email Trigger - Prevent NULL URL Error

  ## Problem
  The `trigger_auto_send_email` function attempts to send emails using `net.http_post`,
  but when Supabase settings are not configured, it passes NULL as the URL, causing:
  "null value in column 'url' of relation 'http_request_queue' violates not-null constraint"
  
  This prevents users from creating reports or assigning responsibles.

  ## Solution
  Modify the function to gracefully handle missing configuration by:
  1. Checking if Supabase URL is configured before attempting to send
  2. If not configured, leave the email in 'pending' status for manual/cron processing
  3. Add proper error handling to prevent database constraint violations

  ## Changes
  - Update `trigger_auto_send_email` function to check for NULL URLs
  - Email remains in 'pending' status if auto-send is not possible
  - No database errors are thrown, operations can proceed normally
*/

CREATE OR REPLACE FUNCTION public.trigger_auto_send_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_supabase_url text;
  v_anon_key text;
  v_request_id bigint;
  v_should_send boolean;
  v_already_sent boolean;
BEGIN
  -- Solo procesar si el email está en estado 'pending'
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Determinar si el email debe enviarse ahora
  v_should_send := (
    NEW.scheduled_for IS NULL OR
    NEW.scheduled_for <= now()
  );

  -- Si no debe enviarse aún, retornar sin hacer nada
  IF NOT v_should_send THEN
    RETURN NEW;
  END IF;

  -- Para anuncios, verificar si ya se envió exitosamente a este usuario
  IF NEW.email_type = 'admin_announcement' THEN
    SELECT EXISTS (
      SELECT 1 FROM announcement_recipients ar
      INNER JOIN email_queue eq ON eq.recipient_user_id = ar.user_id
      WHERE ar.user_id = NEW.recipient_user_id
        AND ar.email_sent = true
        AND eq.data->>'announcement_id' = NEW.data->>'announcement_id'
        AND eq.id != NEW.id
    ) INTO v_already_sent;

    -- Si ya se envió, marcar como cancelado y no enviar
    IF v_already_sent THEN
      UPDATE email_queue
      SET
        status = 'cancelled',
        error_message = 'Email already sent to this user for this announcement'
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;
  END IF;

  -- Intentar obtener configuración de Supabase
  BEGIN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_anon_key := current_setting('app.settings.supabase_anon_key', true);

    IF v_supabase_url IS NULL THEN
      v_supabase_url := current_setting('supabase.url', true);
    END IF;

    IF v_anon_key IS NULL THEN
      v_anon_key := current_setting('supabase.anon_key', true);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Si hay error obteniendo settings, continuar sin ellos
      v_supabase_url := NULL;
      v_anon_key := NULL;
  END;

  -- Solo intentar enviar si tenemos la configuración necesaria
  IF v_supabase_url IS NOT NULL AND v_anon_key IS NOT NULL THEN
    BEGIN
      -- Llamar a la edge function para enviar el email
      SELECT INTO v_request_id net.http_post(
        url := v_supabase_url || '/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'email_id', NEW.id
        )
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Si falla el envío, dejar el email en pending
        -- El sistema de retry o cron lo procesará después
        RAISE NOTICE 'Failed to auto-send email %, will be processed later: %', NEW.id, SQLERRM;
    END;
  ELSE
    -- No hay configuración, el email se procesará por otro medio
    RAISE NOTICE 'Supabase settings not configured, email % will be processed by cron or manual trigger', NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
