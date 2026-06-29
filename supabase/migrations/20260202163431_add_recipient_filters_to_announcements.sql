/*
  # Agregar filtros de destinatarios a anuncios

  ## Propósito
  Permite al Super Admin seleccionar destinatarios específicos para los anuncios
  en lugar de enviar siempre a todos los gestores SST.

  ## Cambios

  ### Tabla `announcements`
  - Agregar campo `data` (jsonb) para almacenar filtros de destinatarios
    - `type`: 'all' | 'companies' | 'managers'
    - `company_ids`: array de IDs de empresas (cuando type = 'companies')
    - `manager_ids`: array de IDs de gestores (cuando type = 'managers')

  ## Notas
  - El campo `data` permite flexibilidad para agregar más opciones en el futuro
  - Si `data` es null o no tiene filtros, se asume envío a todos (comportamiento anterior)
*/

-- Agregar campo data a announcements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'data'
  ) THEN
    ALTER TABLE announcements ADD COLUMN data jsonb DEFAULT NULL;
  END IF;
END $$;

-- Crear índice para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_announcements_data ON announcements USING gin(data);

-- Comentario en el campo
COMMENT ON COLUMN announcements.data IS 'Recipient filters: {type: "all"|"companies"|"managers", company_ids?: [], manager_ids?: []}';
