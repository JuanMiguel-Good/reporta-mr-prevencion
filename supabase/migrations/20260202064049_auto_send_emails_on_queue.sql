/*
  # Envío Automático de Emails

  1. Descripción
    - Configura el sistema para enviar emails AUTOMÁTICAMENTE cuando se agregan a la cola
    - Usa pg_net para llamar a la edge function de envío inmediatamente
    - NO requiere cron jobs ni intervención manual

  2. Cambios
    - Crea función que usa pg_net para enviar emails vía edge function
    - Crea trigger en email_queue que se ejecuta al insertar nuevos emails
    - Los emails se envían inmediatamente sin esperar procesamiento manual

  3. Funcionamiento
    - Cuando se crea un reporte → se agrega email a la cola
    - Trigger detecta el nuevo email → llama a la edge function
    - Edge function envía el email vía SMTP
    - Todo es automático e instantáneo
*/

-- Función que envía el email usando pg_net
CREATE OR REPLACE FUNCTION trigger_auto_send_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_anon_key text;
  v_request_id bigint;
BEGIN
  -- Solo procesar si el email está en estado 'pending'
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Obtener configuración de Supabase (estas están disponibles automáticamente)
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- Si no están configuradas, usar las variables de entorno del sistema
  IF v_supabase_url IS NULL THEN
    v_supabase_url := current_setting('supabase.url', true);
  END IF;

  IF v_anon_key IS NULL THEN
    v_anon_key := current_setting('supabase.anon_key', true);
  END IF;

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

  RETURN NEW;
END;
$$;

-- Crear trigger en email_queue
DROP TRIGGER IF EXISTS auto_send_email_on_insert ON email_queue;

CREATE TRIGGER auto_send_email_on_insert
  AFTER INSERT ON email_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_auto_send_email();

-- Comentario explicativo
COMMENT ON FUNCTION trigger_auto_send_email IS 'Envía automáticamente emails cuando se agregan a la cola usando pg_net';
COMMENT ON TRIGGER auto_send_email_on_insert ON email_queue IS 'Trigger que envía emails automáticamente al insertarlos en la cola';
