/*
  # Add Automatic Report Notifications

  1. New Functions
    - `notify_report_created()` - Notifies SST managers and HR observers when a report is created
    - `notify_report_status_changed()` - Notifies relevant users when report status changes
    - `notify_responsible_assigned()` - Notifies user when assigned as responsible for closure

  2. Triggers
    - `on_report_created` - Fires after report insert
    - `on_report_updated` - Fires after report update

  3. Behavior
    - When report is created: notify all SST managers and HR observers in the company
    - When report status changes: notify creator, SST managers, and HR observers
    - When responsible is assigned: notify the assigned user
*/

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
  WHERE id = NEW.created_by;

  FOR v_manager_id IN
    SELECT id
    FROM users
    WHERE company_id = NEW.company_id
      AND role IN ('sst_manager', 'hr_observer')
      AND active = true
      AND id != NEW.created_by
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
      WHEN 'open' THEN 'Abierto'
      WHEN 'in_review' THEN 'En Revisión'
      WHEN 'in_progress' THEN 'En Proceso'
      WHEN 'closed' THEN 'Cerrado'
      ELSE NEW.status
    END;

    INSERT INTO notification_queue (user_id, title, body, data)
    VALUES (
      NEW.created_by,
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
        AND id != NEW.created_by
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

DROP TRIGGER IF EXISTS on_report_created ON reports;
CREATE TRIGGER on_report_created
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_report_created();

DROP TRIGGER IF EXISTS on_report_status_changed ON reports;
CREATE TRIGGER on_report_status_changed
  AFTER UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_report_status_changed();

DROP TRIGGER IF EXISTS on_responsible_assigned ON reports;
CREATE TRIGGER on_responsible_assigned
  AFTER UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_responsible_assigned();