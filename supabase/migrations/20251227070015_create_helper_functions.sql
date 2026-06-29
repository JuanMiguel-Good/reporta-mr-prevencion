/*
  # Create Helper Functions and Triggers

  ## Functions Created
  
  1. **track_report_status_change()** - Automatically log status changes to report_history
  2. **get_user_role()** - Get current user's role
  3. **get_user_company()** - Get current user's company_id
  
  ## Triggers
  
  1. Auto-track report status changes
  2. Set main photo for first photo uploaded

  ## Notes
  - Simplifies permission checks in application code
  - Ensures data integrity with automatic tracking
*/

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to get current user's company
CREATE OR REPLACE FUNCTION get_user_company()
RETURNS uuid AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to automatically track report status changes
CREATE OR REPLACE FUNCTION track_report_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO report_history (report_id, changed_by, previous_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to track status changes
DROP TRIGGER IF EXISTS trigger_track_report_status ON reports;
CREATE TRIGGER trigger_track_report_status
  AFTER UPDATE ON reports
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION track_report_status_change();

-- Function to set first photo as main photo automatically
CREATE OR REPLACE FUNCTION set_main_photo_if_first()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM report_photos
    WHERE report_id = NEW.report_id
    AND id != NEW.id
  ) THEN
    NEW.is_main := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set first photo as main
DROP TRIGGER IF EXISTS trigger_set_main_photo ON report_photos;
CREATE TRIGGER trigger_set_main_photo
  BEFORE INSERT ON report_photos
  FOR EACH ROW
  EXECUTE FUNCTION set_main_photo_if_first();

-- Function to create default categories for a new company
CREATE OR REPLACE FUNCTION create_default_categories(company_uuid uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO categories (company_id, name, description, display_order, active)
  VALUES
    (company_uuid, 'Orden y Limpieza', 'Problemas relacionados con desorden, basura o falta de limpieza', 1, true),
    (company_uuid, 'EPP Faltante', 'Falta de equipos de protección personal', 2, true),
    (company_uuid, 'Herramientas Defectuosas', 'Herramientas dañadas o en mal estado', 3, true),
    (company_uuid, 'Peligro Eléctrico', 'Cables expuestos, tomas dañados, sobrecarga', 4, true),
    (company_uuid, 'Señalización', 'Falta de señales de seguridad o señales dañadas', 5, true),
    (company_uuid, 'Superficies Resbaladizas', 'Pisos mojados, aceite derramado', 6, true),
    (company_uuid, 'Obstáculos', 'Objetos que bloquean pasillos o salidas', 7, true),
    (company_uuid, 'Procedimiento Incorrecto', 'No seguir procedimientos de seguridad establecidos', 8, true),
    (company_uuid, 'Otro', 'Otras condiciones o actos inseguros', 9, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to create default categories when company is created
CREATE OR REPLACE FUNCTION trigger_create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_categories(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create categories for new companies
DROP TRIGGER IF EXISTS trigger_new_company_categories ON companies;
CREATE TRIGGER trigger_new_company_categories
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_categories();