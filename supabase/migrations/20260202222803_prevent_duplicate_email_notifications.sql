/*
  # Prevenir Notificaciones Duplicadas

  1. Problema Identificado
    - Los usuarios reciben el mismo anuncio múltiples veces
    - Los usuarios reciben notificaciones del mismo reporte múltiples veces
    - Causa: No hay verificación de duplicados antes de encolar emails

  2. Solución Implementada
    - Crear índice único compuesto para prevenir duplicados en email_queue
    - El índice usa: recipient_email + email_type + data (announcement_id o report_id)
    - Solo aplica a emails en estado 'pending' para permitir reintentos de fallos

  3. Cambios en la Base de Datos
    - Agregar columna computed hash_key para identificar unicidad
    - Crear índice único parcial en hash_key para emails pending
    - Limpiar duplicados existentes antes de crear índice

  4. Notas Importantes
    - Los emails fallidos (con status != 'pending') SÍ pueden reintentarse
    - Los emails ya enviados (status = 'sent') se mueven a email_history
    - El índice único previene que se encole el mismo email dos veces
*/

-- Paso 1: Agregar columna para identificar duplicados basada en el contenido clave
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS deduplication_key text 
GENERATED ALWAYS AS (
  recipient_email || '|' || email_type || '|' || 
  COALESCE((data->>'announcement_id')::text, '') || '|' ||
  COALESCE((data->>'report_id')::text, '')
) STORED;

-- Paso 2: Limpiar duplicados existentes en email_queue
-- Mantener solo el email más reciente de cada conjunto de duplicados
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY deduplication_key, status
      ORDER BY created_at DESC
    ) as rn
  FROM email_queue
  WHERE status = 'pending'
)
DELETE FROM email_queue
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Paso 3: Crear índice único para prevenir duplicados futuros
-- Solo aplica a emails pendientes (permite reintentos de emails fallidos)
DROP INDEX IF EXISTS idx_email_queue_unique_pending;

CREATE UNIQUE INDEX idx_email_queue_unique_pending 
ON email_queue (deduplication_key)
WHERE status = 'pending';

-- Paso 4: Crear función para verificar si un email ya fue enviado
CREATE OR REPLACE FUNCTION email_already_sent(
  p_recipient_email text,
  p_email_type text,
  p_announcement_id uuid DEFAULT NULL,
  p_report_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar en email_history si ya se envió
  RETURN EXISTS (
    SELECT 1 
    FROM email_history 
    WHERE recipient_email = p_recipient_email
      AND email_type = p_email_type
      AND (
        (p_announcement_id IS NOT NULL AND (data->>'announcement_id')::uuid = p_announcement_id)
        OR
        (p_report_id IS NOT NULL AND (data->>'report_id')::uuid = p_report_id)
      )
      AND sent_at >= NOW() - INTERVAL '30 days'
  );
END;
$$;

-- Comentarios
COMMENT ON COLUMN email_queue.deduplication_key IS 'Clave única generada automáticamente para prevenir duplicados: email|tipo|announcement_id|report_id';
COMMENT ON INDEX idx_email_queue_unique_pending IS 'Previene que se encolen emails duplicados en estado pending';
COMMENT ON FUNCTION email_already_sent IS 'Verifica si un email específico ya fue enviado en los últimos 30 días';
