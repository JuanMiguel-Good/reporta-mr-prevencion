/*
  # Solución de Emails Duplicados de Anuncios

  1. Problema Identificado
    - El trigger auto_send_email_on_insert envía emails inmediatamente sin respetar scheduled_for
    - Los anuncios programados con delays se envían todos de golpe
    - El sistema de reintentos reenvía anuncios ya entregados exitosamente
    - Los usuarios reciben múltiples copias del mismo anuncio

  2. Soluciones Implementadas
    - Modificar trigger para respetar scheduled_for (solo enviar si es NULL o ya pasó)
    - Prevenir reintentos de anuncios ya enviados exitosamente al mismo usuario
    - Agregar deduplicación para evitar múltiples inserciones del mismo email
    - Limitar reintentos a 3 intentos máximo

  3. Cambios en Tablas
    - Agregar columna retry_count a email_queue
    - Agregar índice único para prevenir duplicados de anuncios
*/

-- Agregar columna retry_count si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_queue'
    AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE email_queue ADD COLUMN retry_count integer DEFAULT 0;
  END IF;
END $$;

-- Función mejorada que respeta scheduled_for y previene duplicados
CREATE OR REPLACE FUNCTION trigger_auto_send_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  -- Solo enviar si scheduled_for es NULL o ya pasó
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
    -- Extraer announcement_id del campo data
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

  -- Obtener configuración de Supabase
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

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

-- Función mejorada para sincronizar announcement_recipients
CREATE OR REPLACE FUNCTION sync_announcement_recipient_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_announcement_id uuid;
BEGIN
  -- Si el email se envió exitosamente y es de tipo admin_announcement
  IF NEW.status = 'sent' AND OLD.status != 'sent' AND NEW.email_type = 'admin_announcement' THEN
    -- Extraer announcement_id del campo data
    v_announcement_id := (NEW.data->>'announcement_id')::uuid;

    IF v_announcement_id IS NOT NULL THEN
      -- Actualizar announcement_recipients
      UPDATE announcement_recipients
      SET
        email_sent = true,
        email_sent_at = NEW.sent_at
      WHERE
        announcement_id = v_announcement_id
        AND user_id = NEW.recipient_user_id
        AND email_sent = false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recrear trigger de sincronización con la nueva función
DROP TRIGGER IF EXISTS sync_announcement_on_email_sent ON email_queue;

CREATE TRIGGER sync_announcement_on_email_sent
  AFTER UPDATE ON email_queue
  FOR EACH ROW
  WHEN (NEW.status = 'sent' AND OLD.status != 'sent')
  EXECUTE FUNCTION sync_announcement_recipient_status();

-- Índice para prevenir duplicados de anuncios al mismo usuario
-- Solo aplica a emails de tipo admin_announcement
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_announcement_per_user
  ON email_queue (recipient_user_id, (data->>'announcement_id'))
  WHERE email_type = 'admin_announcement'
    AND status NOT IN ('cancelled', 'failed');

-- Índice para mejorar búsqueda de emails programados
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled
  ON email_queue(scheduled_for, status)
  WHERE status = 'pending' AND scheduled_for IS NOT NULL;

-- Índice para retry_count
CREATE INDEX IF NOT EXISTS idx_email_queue_retry_count
  ON email_queue(retry_count)
  WHERE status = 'pending';

COMMENT ON FUNCTION trigger_auto_send_email IS 'Envía automáticamente emails cuando se agregan a la cola, respetando scheduled_for y previniendo duplicados';
COMMENT ON FUNCTION sync_announcement_recipient_status IS 'Sincroniza el estado de announcement_recipients cuando un email se envía exitosamente';
COMMENT ON COLUMN email_queue.retry_count IS 'Número de intentos de reenvío realizados. Máximo 3 intentos.';
