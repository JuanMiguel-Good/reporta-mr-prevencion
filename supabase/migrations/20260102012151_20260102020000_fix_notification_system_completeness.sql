/*
  # Fix Push Notification System Completeness

  ## Overview
  This migration fixes missing notifications in the workflow to ensure all stakeholders
  are notified at the correct times.

  ## Changes

  ### 1. Enhanced Status Change Notifications
     - When status changes to 'closed': Notify the assigned user (assigned_to_id) that their evidence was approved
     - When status changes to 'evidence_rejected': Include rejection reason in notification
     - Improve notification messages to be more contextual

  ### 2. Evidence Upload Notifications
     - Create dedicated trigger for evidence uploads
     - Notify SST managers and HR observers when evidence is uploaded
     - More specific messaging for evidence-related events

  ## Notification Flow

  1. **New Report Created** → Notify: SST Managers, HR Observers
  2. **Responsible Assigned** → Notify: Assigned user (assigned_to_id)
  3. **Evidence Uploaded** → Notify: SST Managers, HR Observers
  4. **Report Closed** → Notify: Reporter, Assigned user (assigned_to_id), SST Managers, HR Observers
  5. **Evidence Rejected** → Notify: Assigned user (assigned_to_id) with rejection reason

  ## Security
  - All functions use SECURITY DEFINER for proper permissions
  - No RLS changes needed
*/

-- Drop existing triggers to recreate them
DROP TRIGGER IF EXISTS on_report_status_changed ON reports;
DROP TRIGGER IF EXISTS on_evidence_uploaded ON report_photos;

DROP FUNCTION IF EXISTS notify_report_status_changed();
DROP FUNCTION IF EXISTS notify_evidence_uploaded();

-- Enhanced status change notification function
CREATE OR REPLACE FUNCTION notify_report_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_status_label text;
  v_assigned_user_name text;
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

    -- Special handling for closed status
    IF NEW.status = 'closed' THEN
      -- Notify the assigned user that their evidence was approved
      IF NEW.assigned_to_id IS NOT NULL THEN
        INSERT INTO notification_queue (user_id, title, body, data)
        VALUES (
          NEW.assigned_to_id,
          'Evidencia Aprobada',
          'Tu evidencia para el reporte "' || COALESCE(SUBSTRING(NEW.description, 1, 50), 'Sin descripción') || '..." fue aprobada y el reporte ha sido cerrado.',
          jsonb_build_object(
            'reportId', NEW.id,
            'status', NEW.status,
            'url', '/gallery'
          )
        );
      END IF;

      -- Notify reporter
      IF NEW.reporter_id IS NOT NULL AND NEW.reporter_id != NEW.assigned_to_id THEN
        INSERT INTO notification_queue (user_id, title, body, data)
        VALUES (
          NEW.reporter_id,
          'Reporte Cerrado',
          'Tu reporte "' || COALESCE(SUBSTRING(NEW.description, 1, 50), 'Sin descripción') || '..." ha sido cerrado exitosamente.',
          jsonb_build_object(
            'reportId', NEW.id,
            'status', NEW.status,
            'url', '/gallery'
          )
        );
      END IF;

      -- Notify managers and observers
      FOR v_user_id IN
        SELECT id
        FROM users
        WHERE company_id = NEW.company_id
          AND role IN ('sst_manager', 'hr_observer')
          AND active = true
          AND id != NEW.reporter_id
          AND id != NEW.assigned_to_id
      LOOP
        INSERT INTO notification_queue (user_id, title, body, data)
        VALUES (
          v_user_id,
          'Reporte Cerrado',
          'El reporte "' || COALESCE(SUBSTRING(NEW.description, 1, 50), 'Sin descripción') || '..." ha sido cerrado.',
          jsonb_build_object(
            'reportId', NEW.id,
            'status', NEW.status,
            'url', '/gallery'
          )
        );
      END LOOP;

    -- Special handling for evidence rejected status
    ELSIF NEW.status = 'evidence_rejected' THEN
      -- Notify the assigned user with rejection reason
      IF NEW.assigned_to_id IS NOT NULL THEN
        INSERT INTO notification_queue (user_id, title, body, data)
        VALUES (
          NEW.assigned_to_id,
          'Evidencia Rechazada',
          'Tu evidencia fue rechazada. Motivo: ' || COALESCE(NEW.rejection_reason, 'No especificado') || '. Por favor, sube nueva evidencia.',
          jsonb_build_object(
            'reportId', NEW.id,
            'status', NEW.status,
            'rejectionReason', NEW.rejection_reason,
            'url', '/gallery'
          )
        );
      END IF;

      -- Notify reporter
      IF NEW.reporter_id IS NOT NULL AND NEW.reporter_id != NEW.assigned_to_id THEN
        INSERT INTO notification_queue (user_id, title, body, data)
        VALUES (
          NEW.reporter_id,
          'Actualización de Reporte',
          'La evidencia del reporte "' || COALESCE(SUBSTRING(NEW.description, 1, 50), 'Sin descripción') || '..." fue rechazada y se solicitó nueva evidencia.',
          jsonb_build_object(
            'reportId', NEW.id,
            'status', NEW.status,
            'url', '/gallery'
          )
        );
      END IF;

    -- Default handling for other status changes
    ELSE
      -- Notify reporter for general status changes
      IF NEW.reporter_id IS NOT NULL THEN
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
      END IF;

      -- Notify managers and observers
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
  END IF;

  RETURN NEW;
END;
$$;

-- Evidence upload notification function
CREATE OR REPLACE FUNCTION notify_evidence_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_manager_id uuid;
  v_report_description text;
  v_uploader_name text;
BEGIN
  -- Only proceed if this is an evidence photo
  IF NEW.is_evidence = true THEN
    -- Get report description
    SELECT description INTO v_report_description
    FROM reports
    WHERE id = NEW.report_id;

    -- Get uploader name
    SELECT full_name INTO v_uploader_name
    FROM users
    WHERE id = NEW.uploaded_by;

    -- Get company_id for the report
    FOR v_manager_id IN
      SELECT u.id
      FROM users u
      INNER JOIN reports r ON r.company_id = u.company_id
      WHERE r.id = NEW.report_id
        AND u.role IN ('sst_manager', 'hr_observer')
        AND u.active = true
        AND u.id != NEW.uploaded_by
    LOOP
      INSERT INTO notification_queue (user_id, title, body, data)
      VALUES (
        v_manager_id,
        'Nueva Evidencia Subida',
        v_uploader_name || ' ha subido evidencia para el reporte: "' || COALESCE(SUBSTRING(v_report_description, 1, 50), 'Sin descripción') || '..."',
        jsonb_build_object(
          'reportId', NEW.report_id,
          'photoId', NEW.id,
          'url', '/gallery'
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER on_report_status_changed
  AFTER UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_report_status_changed();

CREATE TRIGGER on_evidence_uploaded
  AFTER INSERT ON report_photos
  FOR EACH ROW
  WHEN (NEW.is_evidence = true)
  EXECUTE FUNCTION notify_evidence_uploaded();
