/*
  # Arreglar referencia de changed_by en report_history

  ## Problema
  El trigger `track_report_status_change` usa `auth.uid()` para `changed_by`,
  pero `changed_by` referencia `users.id` (no `users.auth_user_id`).
  Esto causa errores de clave foránea al asignar responsables.

  ## Solución
  Modificar el trigger para buscar el `users.id` correcto basado en:
  - `auth_user_id` = auth.uid()
  - `company_id` del reporte

  ## Cambios
  1. Actualizar función `track_report_status_change` para buscar users.id correcto
  2. Manejar caso donde no se encuentra el usuario (usar NULL y permitirlo)
*/

-- Primero, necesitamos permitir NULL en changed_by temporalmente para casos edge
ALTER TABLE report_history ALTER COLUMN changed_by DROP NOT NULL;

-- Recrear la función de tracking con la lógica correcta
CREATE OR REPLACE FUNCTION track_report_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_record_id uuid;
  report_company_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Obtener el company_id del reporte
    SELECT company_id INTO report_company_id
    FROM public.reports
    WHERE id = NEW.id;

    -- Buscar el users.id correcto para este auth user y company
    SELECT id INTO user_record_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
      AND company_id = report_company_id
    LIMIT 1;

    -- Si no se encuentra, intentar con cualquier registro del usuario
    IF user_record_id IS NULL THEN
      SELECT id INTO user_record_id
      FROM public.users
      WHERE auth_user_id = auth.uid()
      LIMIT 1;
    END IF;

    -- Insertar en el historial
    INSERT INTO public.report_history (report_id, changed_by, previous_status, new_status)
    VALUES (NEW.id, user_record_id, OLD.status, NEW.status);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recrear el trigger
DROP TRIGGER IF EXISTS track_report_status_change_trigger ON reports;
CREATE TRIGGER track_report_status_change_trigger
  AFTER UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION track_report_status_change();
