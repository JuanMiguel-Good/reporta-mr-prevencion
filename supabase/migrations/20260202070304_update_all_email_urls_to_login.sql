/*
  # Update All Email URLs to Login Page

  1. Changes
    - Update all email notification templates to use https://reporta.goodsolutions.app/login
    - Applies to: new report, report assigned, evidence uploaded, evidence rejected
    
  2. Purpose
    - Ensure all email buttons redirect to the correct login page
*/

-- Update generate_new_report_email function
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
  v_created_at text;
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
    u.full_name,
    format_datetime_peru(r.created_at),
    COALESCE(r.area, 'No especificada'),
    COALESCE(r.proyecto, 'No especificado')
  INTO 
    v_company_name,
    v_report_type,
    v_category_name,
    v_reporter_name,
    v_created_at,
    v_area,
    v_proyecto
  FROM reports r
  JOIN companies c ON c.id = r.company_id
  LEFT JOIN categories cat ON cat.id = r.category_id
  JOIN users u ON u.id = r.reporter_id
  WHERE r.id = p_report_id;

  RETURN QUERY SELECT
    '[' || v_company_name || '] Nuevo Reporte Creado' AS subject,
    '<html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin: 0 0 8px 0; color: #1e40af;">Nuevo Reporte Creado</h2>
            <p style="margin: 0; color: #1e40af;">Se ha creado un nuevo reporte que requiere tu atención.</p>
          </div>
          
          <p>Hola <strong>' || p_recipient_name || '</strong>,</p>
          
          <p>Se ha creado un nuevo reporte en el sistema:</p>
          
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
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Proyecto:</td>
              <td style="padding: 8px 0;">' || v_proyecto || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Reportado por:</td>
              <td style="padding: 8px 0;">' || v_reporter_name || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Fecha y hora:</td>
              <td style="padding: 8px 0;">' || v_created_at || '</td>
            </tr>
          </table>

          <div style="margin: 30px 0;">
            <a href="https://reporta.goodsolutions.app/login" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ir al Sistema
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #6b7280;">
            Este es un mensaje automático del sistema de reportes de ' || v_company_name || '.<br>
            Por favor no respondas a este correo.
          </p>
        </div>
      </body>
    </html>' AS html_body;
END;
$$;

-- Update generate_report_assigned_email function
CREATE OR REPLACE FUNCTION generate_report_assigned_email(
  p_report_id uuid,
  p_company_id uuid,
  p_recipient_name text,
  p_closure_date date
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
  v_closure_date_formatted text;
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

  v_closure_date_formatted := TO_CHAR(p_closure_date, 'DD/MM/YYYY');

  RETURN QUERY SELECT
    '[' || v_company_name || '] Reporte Asignado - Acción Requerida' AS subject,
    '<html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin: 0 0 8px 0; color: #92400e;">Reporte Asignado</h2>
            <p style="margin: 0; color: #78350f;">Se te ha asignado un reporte para dar cierre.</p>
          </div>
          
          <p>Hola <strong>' || p_recipient_name || '</strong>,</p>
          
          <p>Se te ha asignado el siguiente reporte para que tomes acción:</p>
          
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
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Proyecto:</td>
              <td style="padding: 8px 0;">' || v_proyecto || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Fecha límite de cierre:</td>
              <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">' || v_closure_date_formatted || '</td>
            </tr>
          </table>

          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #1f2937;">¿Qué debes hacer?</p>
            <p style="margin: 8px 0;">Debes tomar las acciones correctivas necesarias y luego subir evidencia fotográfica del cierre antes de la fecha límite.</p>
          </div>

          <div style="margin: 30px 0;">
            <a href="https://reporta.goodsolutions.app/login" 
               style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ir al Sistema
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #6b7280;">
            Este es un mensaje automático del sistema de reportes de ' || v_company_name || '.<br>
            Por favor no respondas a este correo.
          </p>
        </div>
      </body>
    </html>' AS html_body;
END;
$$;

-- Update generate_evidence_uploaded_email function
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
    '<html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin: 0 0 8px 0; color: #065f46;">Evidencia de Cierre Subida</h2>
            <p style="margin: 0; color: #065f46;">Se ha subido evidencia de cierre para revisión.</p>
          </div>
          
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
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Proyecto:</td>
              <td style="padding: 8px 0;">' || v_proyecto || '</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Responsable:</td>
              <td style="padding: 8px 0;">' || v_responsible_name || '</td>
            </tr>
          </table>

          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #1f2937;">Acción Requerida:</p>
            <p style="margin: 8px 0;">Por favor revisa la evidencia y aprueba o rechaza el cierre del reporte.</p>
          </div>

          <div style="margin: 30px 0;">
            <a href="https://reporta.goodsolutions.app/login" 
               style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ir al Sistema
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #6b7280;">
            Este es un mensaje automático del sistema de reportes de ' || v_company_name || '.<br>
            Por favor no respondas a este correo.
          </p>
        </div>
      </body>
    </html>' AS html_body;
END;
$$;

-- Update generate_evidence_rejected_email function
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
  v_report_type text;
  v_category_name text;
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

  RETURN QUERY SELECT
    '[' || v_company_name || '] Evidencia Rechazada - Acción Requerida' AS subject,
    '<html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin: 0 0 8px 0; color: #991b1b;">Evidencia Rechazada</h2>
            <p style="margin: 0; color: #991b1b;">La evidencia de cierre que subiste ha sido rechazada.</p>
          </div>
          
          <p>Hola <strong>' || p_recipient_name || '</strong>,</p>
          
          <p>La evidencia de cierre que subiste para el siguiente reporte ha sido rechazada:</p>
          
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
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Proyecto:</td>
              <td style="padding: 8px 0;">' || v_proyecto || '</td>
            </tr>
          </table>

          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-weight: bold; color: #92400e;">Motivo del Rechazo:</p>
            <p style="margin: 0; color: #78350f;">' || p_rejection_reason || '</p>
          </div>

          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #1f2937;">Acción Requerida:</p>
            <p style="margin: 8px 0;">Por favor corrige la situación y sube nueva evidencia de cierre.</p>
          </div>

          <div style="margin: 30px 0;">
            <a href="https://reporta.goodsolutions.app/login" 
               style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ir al Sistema
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #6b7280;">
            Este es un mensaje automático del sistema de reportes de ' || v_company_name || '.<br>
            Por favor no respondas a este correo.
          </p>
        </div>
      </body>
    </html>' AS html_body;
END;
$$;