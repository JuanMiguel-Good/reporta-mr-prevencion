/*
  # Actualizar Todos los Emails con Íconos Planos y Diseño Responsive
  
  1. Cambios
    - Actualiza todos los emails para usar íconos planos
    - Hace todos los emails responsive para móviles
*/

-- Email de reporte asignado
DROP FUNCTION IF EXISTS generate_report_assigned_email(uuid, uuid, text, date);

CREATE OR REPLACE FUNCTION generate_report_assigned_email(
  p_report_id uuid,
  p_company_id uuid,
  p_recipient_name text,
  p_proposed_closure_date date DEFAULT NULL
)
RETURNS TABLE (
  subject text,
  html_body text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_company_name text;
  v_report_type text;
  v_category_name text;
  v_area text;
  v_proyecto text;
  v_closure_date_html text := '';
BEGIN
  SELECT 
    c.name,
    CASE r.type 
      WHEN 'unsafe_act' THEN 'Acto Inseguro'
      WHEN 'unsafe_condition' THEN 'Condición Insegura'
    END,
    cat.name,
    COALESCE(r.area, 'No especificada'),
    COALESCE(r.proyecto, 'No especificado')
  INTO 
    v_company_name,
    v_report_type,
    v_category_name,
    v_area,
    v_proyecto
  FROM reports r
  JOIN companies c ON c.id = r.company_id
  LEFT JOIN categories cat ON cat.id = r.category_id
  WHERE r.id = p_report_id;

  IF p_proposed_closure_date IS NOT NULL THEN
    v_closure_date_html := '<tr>
      <td style="padding: 8px 0; font-weight: bold;">Fecha propuesta de cierre:</td>
      <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">' || TO_CHAR(p_proposed_closure_date, 'DD/MM/YYYY') || '</td>
    </tr>';
  END IF;

  RETURN QUERY SELECT
    '[' || v_company_name || '] Nuevo Reporte Asignado - Acción Requerida' AS subject,
    '<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @media only screen and (max-width: 600px) {
          .container { padding: 10px !important; }
          .button { padding: 12px 20px !important; font-size: 14px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f3f4f6;">
      <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
          <h2 style="margin: 0 0 8px 0; color: #1e40af;">■ Nuevo Reporte Asignado</h2>
          <p style="margin: 0; color: #1e40af;">Se te ha asignado un reporte para su resolución.</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px;">
          <p>Hola <strong>' || p_recipient_name || '</strong>,</p>
          
          <p>Se te ha asignado un nuevo reporte en <strong>' || v_company_name || '</strong> que requiere tu atención.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 40%;">Tipo:</td>
              <td style="padding: 8px 0;">' || v_report_type || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Categoría:</td>
              <td style="padding: 8px 0;">' || COALESCE(v_category_name, 'Sin categoría') || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Área:</td>
              <td style="padding: 8px 0;">' || v_area || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Proyecto:</td>
              <td style="padding: 8px 0;">' || v_proyecto || '</td>
            </tr>
            ' || v_closure_date_html || '
          </table>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="https://reporta.goodsolutions.app/login" 
               class="button"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              ► Ver Reporte Completo
            </a>
          </div>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          Este es un correo automático del sistema de reportes de ' || v_company_name || '.<br>
          Por favor no respondas a este correo.
        </p>
      </div>
    </body>
    </html>' AS html_body;
END;
$$;

-- Email de evidencia subida
DROP FUNCTION IF EXISTS generate_evidence_uploaded_email(uuid, uuid, text);

CREATE OR REPLACE FUNCTION generate_evidence_uploaded_email(
  p_report_id uuid,
  p_company_id uuid,
  p_recipient_name text
)
RETURNS TABLE (
  subject text,
  html_body text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_company_name text;
  v_report_type text;
  v_category_name text;
  v_responsible_name text;
  v_area text;
  v_proyecto text;
BEGIN
  SELECT 
    c.name,
    CASE r.type 
      WHEN 'unsafe_act' THEN 'Acto Inseguro'
      WHEN 'unsafe_condition' THEN 'Condición Insegura'
    END,
    cat.name,
    responsible.full_name,
    COALESCE(r.area, 'No especificada'),
    COALESCE(r.proyecto, 'No especificado')
  INTO 
    v_company_name,
    v_report_type,
    v_category_name,
    v_responsible_name,
    v_area,
    v_proyecto
  FROM reports r
  JOIN companies c ON c.id = r.company_id
  LEFT JOIN categories cat ON cat.id = r.category_id
  JOIN users responsible ON responsible.id = r.assigned_to_id
  WHERE r.id = p_report_id;

  RETURN QUERY SELECT
    '[' || v_company_name || '] Evidencia de Cierre Subida - Revisión Requerida' AS subject,
    '<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @media only screen and (max-width: 600px) {
          .container { padding: 10px !important; }
          .button { padding: 12px 20px !important; font-size: 14px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f3f4f6;">
      <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
          <h2 style="margin: 0 0 8px 0; color: #065f46;">✓ Evidencia de Cierre Subida</h2>
          <p style="margin: 0; color: #065f46;">Se ha subido evidencia de cierre para revisión.</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px;">
          <p>Hola <strong>' || p_recipient_name || '</strong>,</p>
          
          <p>El responsable <strong>' || v_responsible_name || '</strong> ha subido evidencia de cierre para el siguiente reporte:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 40%;">ID del Reporte:</td>
              <td style="padding: 8px 0;">#' || p_report_id || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Tipo:</td>
              <td style="padding: 8px 0;">' || v_report_type || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Categoría:</td>
              <td style="padding: 8px 0;">' || COALESCE(v_category_name, 'Sin categoría') || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Área:</td>
              <td style="padding: 8px 0;">' || v_area || '</td>
            </tr>
          </table>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="https://reporta.goodsolutions.app/login" 
               class="button"
               style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              ► Revisar Evidencia
            </a>
          </div>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          Este es un correo automático del sistema de reportes de ' || v_company_name || '.<br>
          Por favor no respondas a este correo.
        </p>
      </div>
    </body>
    </html>' AS html_body;
END;
$$;

-- Email de evidencia rechazada
DROP FUNCTION IF EXISTS generate_evidence_rejected_email(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION generate_evidence_rejected_email(
  p_report_id uuid,
  p_company_id uuid,
  p_recipient_name text,
  p_rejection_reason text
)
RETURNS TABLE (
  subject text,
  html_body text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_company_name text;
BEGIN
  SELECT name INTO v_company_name
  FROM companies
  WHERE id = p_company_id;

  RETURN QUERY SELECT
    '[' || v_company_name || '] Evidencia Rechazada - Nueva Evidencia Requerida' AS subject,
    '<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @media only screen and (max-width: 600px) {
          .container { padding: 10px !important; }
          .button { padding: 12px 20px !important; font-size: 14px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f3f4f6;">
      <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
          <h2 style="margin: 0 0 8px 0; color: #991b1b;">✕ Evidencia Rechazada</h2>
          <p style="margin: 0; color: #991b1b;">La evidencia de cierre no fue aprobada.</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px;">
          <p>Hola <strong>' || p_recipient_name || '</strong>,</p>
          
          <p>La evidencia que subiste para el reporte <strong>#' || p_report_id || '</strong> no ha sido aprobada.</p>
          
          <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #92400e;">Motivo del rechazo:</p>
            <p style="margin: 8px 0 0 0; color: #78350f;">' || p_rejection_reason || '</p>
          </div>
          
          <p>Por favor, revisa el motivo del rechazo y sube nueva evidencia corregida.</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="https://reporta.goodsolutions.app/login" 
               class="button"
               style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              ► Subir Nueva Evidencia
            </a>
          </div>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          Este es un correo automático del sistema de reportes de ' || v_company_name || '.<br>
          Por favor no respondas a este correo.
        </p>
      </div>
    </body>
    </html>' AS html_body;
END;
$$;

-- Email de nuevo reporte
DROP FUNCTION IF EXISTS generate_new_report_email(uuid, uuid, text);

CREATE OR REPLACE FUNCTION generate_new_report_email(
  p_report_id uuid,
  p_company_id uuid,
  p_recipient_name text
)
RETURNS TABLE (
  subject text,
  html_body text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_company_name text;
  v_report_type text;
  v_category_name text;
  v_reporter_name text;
  v_area text;
  v_proyecto text;
BEGIN
  SELECT 
    c.name,
    CASE r.type 
      WHEN 'unsafe_act' THEN 'Acto Inseguro'
      WHEN 'unsafe_condition' THEN 'Condición Insegura'
    END,
    cat.name,
    reporter.full_name,
    COALESCE(r.area, 'No especificada'),
    COALESCE(r.proyecto, 'No especificado')
  INTO 
    v_company_name,
    v_report_type,
    v_category_name,
    v_reporter_name,
    v_area,
    v_proyecto
  FROM reports r
  JOIN companies c ON c.id = r.company_id
  LEFT JOIN categories cat ON cat.id = r.category_id
  JOIN users reporter ON reporter.id = r.reporter_id
  WHERE r.id = p_report_id;

  RETURN QUERY SELECT
    '[' || v_company_name || '] Nuevo Reporte Creado - Requiere Asignación' AS subject,
    '<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @media only screen and (max-width: 600px) {
          .container { padding: 10px !important; }
          .button { padding: 12px 20px !important; font-size: 14px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f3f4f6;">
      <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
          <h2 style="margin: 0 0 8px 0; color: #92400e;">+ Nuevo Reporte Creado</h2>
          <p style="margin: 0; color: #78350f;">Se ha creado un nuevo reporte que requiere asignación.</p>
        </div>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px;">
          <p>Hola <strong>' || p_recipient_name || '</strong>,</p>
          
          <p><strong>' || v_reporter_name || '</strong> ha creado un nuevo reporte en <strong>' || v_company_name || '</strong>.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 40%;">Tipo:</td>
              <td style="padding: 8px 0;">' || v_report_type || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Categoría:</td>
              <td style="padding: 8px 0;">' || COALESCE(v_category_name, 'Sin categoría') || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Área:</td>
              <td style="padding: 8px 0;">' || v_area || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Proyecto:</td>
              <td style="padding: 8px 0;">' || v_proyecto || '</td>
            </tr>
          </table>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="https://reporta.goodsolutions.app/login" 
               class="button"
               style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              ► Asignar Responsable
            </a>
          </div>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #6b7280; text-align: center;">
          Este es un correo automático del sistema de reportes de ' || v_company_name || '.<br>
          Por favor no respondas a este correo.
        </p>
      </div>
    </body>
    </html>' AS html_body;
END;
$$;
