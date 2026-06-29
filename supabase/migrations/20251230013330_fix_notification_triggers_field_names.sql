/*
  # Fix Notification Triggers Field Names

  1. Changes
    - Update triggers to use correct field names from reports table
    - Change `created_by` to `reporter_id`
    - Update all trigger functions to use correct schema
*/

DROP TRIGGER IF EXISTS on_report_created ON reports;
DROP TRIGGER IF EXISTS on_report_status_changed ON reports;
DROP TRIGGER IF EXISTS on_responsible_assigned ON reports;

DROP FUNCTION IF EXISTS notify_report_created();
DROP FUNCTION IF EXISTS notify_report_status_changed();
DROP FUNCTION IF EXISTS notify_responsible_assigned();

CREATE OR REPLACE FUNCTION notify_report_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_name text;
  v_manager_id uuid;
BEGIN
  SELECT full_name INTO v_creator_name
  FROM users
  WHERE id = NEW.reporter_id;

  FOR v_manager_id IN
    SELECT id
    FROM users
    WHERE company_id = NEW.company_id
      AND role IN ('sst_manager', 'hr_observer')
      AND active = true
      AND id != NEW.reporter_id
  LOOP
    INSERT INTO notification_queue (user_id, title, body, data)
    VALUES (
      v_manager_id,
      'Nuevo Reporte Creado',
      v_creator_name || ' ha creado un nuevo reporte: ' || COALESCE(SUBSTRING(NEW.description, 1, 50), 'Sin descripción') || '...',
      jsonb_build_object(
        'reportId', NEW.id,
        'status', NEW.status,
        'url', '/gallery'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_report_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_status_label text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_status_label := CASE NEW.status
      WHEN 'reported' THEN 'Reportado'
      WHEN 'in_review' THEN 'En Revisión'
      WHEN 'assigned' THEN 'Asignado'
      WHEN 'evidence_rejected' THEN 'Evidencia Rechazada'
      WHEN 'closed' THEN 'Cerrado'
      ELSE NEW.status
    END;

    INSERT INTO notification_queue (user_id, title, body, data)
    VALUES (
      NEW.reporter_id,
      'Actualización de Reporte',
      'Tu reporte "' || COALESCE(SUBSTRING(NEW.description, 1, 50), 'Sin descripción') || '..." cambió a: ' || v_status_label,
      jsonb_build_object(
        'reportId', NEW.id,
        'status', NEW.status,
        'url', '/gallery'
      )
    );

    FOR v_user_id IN
      SELECT id
      FROM users
      WHERE company_id = NEW.company_id
        AND role IN ('sst_manager', 'hr_observer')
        AND active = true
        AND id != NEW.reporter_id
    LOOP
      INSERT INTO notification_queue (user_id, title, body, data)
      VALUES (
        v_user_id,
        'Cambio de Estado en Reporte',
        'Un reporte cambió a: ' || v_status_label || ' - "' || COALESCE(SUBSTRING(NEW.description, 1, 50), 'Sin descripción') || '..."',
        jsonb_build_object(
          'reportId', NEW.id,
          'status', NEW.status,
          'url', '/gallery'
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_responsible_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.responsible_id IS DISTINCT FROM NEW.responsible_id AND NEW.responsible_id IS NOT NULL THEN
    INSERT INTO notification_queue (user_id, title, body, data)
    VALUES (
      NEW.responsible_id,
      'Reporte Asignado',
      'Se te ha asignado como responsable del cierre de un reporte: "' || COALESCE(SUBSTRING(NEW.description, 1, 50), 'Sin descripción') || '..."',
      jsonb_build_object(
        'reportId', NEW.id,
        'status', NEW.status,
        'url', '/gallery'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_report_created
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_report_created();

CREATE TRIGGER on_report_status_changed
  AFTER UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_report_status_changed();

CREATE TRIGGER on_responsible_assigned
  AFTER UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_responsible_assigned();