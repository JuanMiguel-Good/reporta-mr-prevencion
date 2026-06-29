/*
  # Sistema de Reintentos Automáticos de Emails

  1. Descripción
    - Configura un cron job para reintentar emails pendientes cada hora
    - Crea trigger para sincronizar announcement_recipients con email_queue
    - Asegura que los emails bloqueados por rate limit se reintenten automáticamente

  2. Cron Job
    - Ejecuta process-email-queue cada hora
    - Reintenta emails pendientes automáticamente
    - Respeta límites de rate limiting de Hostinger

  3. Trigger de Sincronización
    - Actualiza announcement_recipients cuando un email se envía exitosamente
    - Mantiene la tabla sincronizada con el estado real de los envíos

  4. Notas
    - Los emails bloqueados por rate limit se marcan como 'pending' para reintento
    - El sistema intentará enviarlos en la siguiente ejecución del cron job
*/

-- Configurar cron job para procesar cola de emails cada hora
SELECT cron.schedule(
  'process-email-queue-hourly',
  '0 * * * *', -- Cada hora en punto
  $$
  SELECT net.http_post(
    url := 'https://yrkjelaleitrfinopdzy.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlya2plbGFsZWl0cmZpbm9wZHp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTI4ODM4NCwiZXhwIjoyMDUwODY0Mzg0fQ.Hn2y1Qv4_Ht0dflJ-D8GFJT_ykJoYFRk6pYST_N1wSg'
    )
  );
  $$
);

-- Función para sincronizar announcement_recipients cuando un email se envía
CREATE OR REPLACE FUNCTION sync_announcement_recipient_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si el email se envió exitosamente y está relacionado con un anuncio
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    -- Buscar si este email corresponde a un anuncio
    UPDATE announcement_recipients
    SET 
      email_sent = true,
      email_sent_at = NEW.sent_at
    WHERE 
      user_id = NEW.recipient_user_id
      AND announcement_id = (
        SELECT id FROM announcements
        WHERE created_at >= NEW.created_at - INTERVAL '1 hour'
        AND created_at <= NEW.created_at
        AND email_type = NEW.email_type
        LIMIT 1
      )
      AND email_sent = false;
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger para sincronizar estado de anuncios
DROP TRIGGER IF EXISTS sync_announcement_on_email_sent ON email_queue;

CREATE TRIGGER sync_announcement_on_email_sent
  AFTER UPDATE ON email_queue
  FOR EACH ROW
  WHEN (NEW.status = 'sent' AND OLD.status != 'sent')
  EXECUTE FUNCTION sync_announcement_recipient_status();

COMMENT ON FUNCTION sync_announcement_recipient_status IS 'Sincroniza el estado de announcement_recipients cuando un email se envía exitosamente';
