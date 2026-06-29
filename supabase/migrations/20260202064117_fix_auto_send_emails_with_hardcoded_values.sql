/*
  # Fix: Envío Automático de Emails con valores directos

  1. Descripción
    - Corrige la función de envío automático para usar valores directos
    - NO requiere configuración manual
    - Envía emails inmediatamente cuando se agregan a la cola

  2. Funcionamiento
    - Cuando se crea un reporte → email a la cola
    - Trigger automático → llama edge function
    - Edge function → envía email vía SMTP
    - Todo instantáneo y automático
*/

-- Eliminar función anterior
DROP FUNCTION IF EXISTS trigger_auto_send_email() CASCADE;

-- Recrear función con valores directos
CREATE OR REPLACE FUNCTION trigger_auto_send_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  -- Solo procesar si el email está en estado 'pending'
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Llamar a la edge function para enviar el email usando pg_net
  -- Los valores están hardcodeados para evitar problemas de configuración
  SELECT INTO v_request_id net.http_post(
    url := 'https://yrkjelaleitrfinopdzy.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlya2plbGFsZWl0cmZpbm9wZHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTgzODQsImV4cCI6MjA4MjM5NDM4NH0.5qjehzm86dqSU7Ig9QSCB9cMWsBUaw67eyLkawL9OpQ'
    ),
    body := jsonb_build_object(
      'email_id', NEW.id
    )
  );

  RAISE LOG 'Email automático enviado: ID=%, request_id=%', NEW.id, v_request_id;

  RETURN NEW;
END;
$$;

-- Recrear trigger
DROP TRIGGER IF EXISTS auto_send_email_on_insert ON email_queue;

CREATE TRIGGER auto_send_email_on_insert
  AFTER INSERT ON email_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_auto_send_email();

COMMENT ON FUNCTION trigger_auto_send_email IS 'Envía automáticamente emails cuando se agregan a la cola';
COMMENT ON TRIGGER auto_send_email_on_insert ON email_queue IS 'Envía emails automáticamente - NO requiere cron jobs';
