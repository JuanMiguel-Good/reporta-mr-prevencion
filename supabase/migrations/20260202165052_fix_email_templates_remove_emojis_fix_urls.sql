/*
  # Corregir Templates de Correos - Eliminar Emojis y Actualizar URLs
  
  1. Cambios
    - Eliminar todos los emojis de los templates de correos
    - Actualizar URLs a https://reporta.goodsolutions.app/login
    - Usar iconos minimalistas representados con símbolos simples o texto
    
  2. Funciones actualizadas
    - generate_new_report_email
    - generate_report_assigned_email
    - generate_evidence_uploaded_email
    - generate_evidence_rejected_email
    - generate_consolidated_daily_reminders
*/

-- Generate email for new report created
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
          <h2 style="color: #2563eb;">Hola ' || p_recipient_name || ',</h2>
          <p>Se ha creado un nuevo reporte en <strong>' || v_company_name || '</strong> que requiere tu atención.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Detalles del Reporte</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 140px;">Tipo:</td>
                <td style="padding: 8px 0;">' || v_report_type || '</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Categoría:</td>
                <td style="padding: 8px 0;">' || COALESCE(v_category_name, 'Sin categoría') || '</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Reportado por:</td>
                <td style="padding: 8px 0;">' || v_reporter_name || '</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Fecha:</td>
                <td style="padding: 8px 0;">' || v_created_at || '</td>
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
          </div>
          
          <p><strong>Acción requerida:</strong> Por favor, asigna este reporte a un responsable para su atención.</p>
          
          <div style="margin: 30px 0;">
            <a href="https://reporta.goodsolutions.app/login" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver Reporte
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

-- Generate email for report assigned
CREATE OR REPLACE FUNCTION generate_report_assigned_email(
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
  v_description text;
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
    COALESCE(r.proyecto, 'No especificado'),
    COALESCE(SUBSTRING(r.description, 1, 200), 'Sin descripción')
  INTO 
    v_company_name,
    v_report_type,
    v_category_name,
    v_reporter_name,
    v_created_at,
    v_area,
    v_proyecto,
    v_description
  FROM reports r
  JOIN companies c ON c.id = r.company_id
  LEFT JOIN categories cat ON cat.id = r.category_id
  JOIN users u ON u.id = r.reporter_id
  WHERE r.id = p_report_id;

  RETURN QUERY SELECT
    '[' || v_company_name || '] Reporte Asignado a Ti' AS subject,
    '<html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Hola ' || p_recipient_name || ',</h2>
          <p>Se te ha asignado un reporte en <strong>' || v_company_name || '</strong> para su atención y cierre.</p>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e;">Reporte Asignado</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 140px;">Tipo:</td>
                <td style="padding: 8px 0;">' || v_report_type || '</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Categoría:</td>
                <td style="padding: 8px 0;">' || COALESCE(v_category_name, 'Sin categoría') || '</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Reportado por:</td>
                <td style="padding: 8px 0;">' || v_reporter_name || '</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Fecha:</td>
                <td style="padding: 8px 0;">' || v_created_at || '</td>
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
            <p style="margin: 16px 0 0 0;"><strong>Descripción:</strong><br>' || v_description || '</p>
          </div>
          
          <p><strong>Acción requerida:</strong> Por favor, sube la evidencia de cierre cuando hayas atendido este reporte.</p>
          
          <div style="margin: 30px 0;">
            <a href="https://reporta.goodsolutions.app/login" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver Reporte y Subir Evidencia
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

-- Generate email for evidence uploaded (pending review)
CREATE OR REPLACE FUNCTION generate_evidence_uploaded_email(
  p_report_id uuid,
  p_company_id uuid,
  p_recipient_name text,
  p_uploader_name text
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
    '[' || v_company_name || '] Evidencia de Cierre Subida - Requiere Revisión' AS subject,
    '<html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Hola ' || p_recipient_name || ',</h2>
          <p><strong>' || p_uploader_name || '</strong> ha subido evidencia de cierre para un reporte en <strong>' || v_company_name || '</strong>.</p>
          
          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <h3 style="margin-top: 0; color: #1e40af;">Evidencia Pendiente de Revisión</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 140px;">Tipo:</td>
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
          </div>
          
          <p><strong>Acción requerida:</strong> Por favor, revisa la evidencia subida y aprueba o rechaza el cierre.</p>
          
          <div style="margin: 30px 0;">
            <a href="https://reporta.goodsolutions.app/login" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Revisar Evidencia
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

-- Generate email for evidence rejected
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
    '[' || v_company_name || '] Evidencia de Cierre Rechazada' AS subject,
    '<html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">Hola ' || p_recipient_name || ',</h2>
          <p>La evidencia de cierre que subiste ha sido rechazada por el Gestor SST en <strong>' || v_company_name || '</strong>.</p>
          
          <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #991b1b;">Evidencia Rechazada</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 140px;">Tipo:</td>
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
            <div style="margin-top: 16px; padding: 12px; background-color: white; border-radius: 4px;">
              <strong style="color: #991b1b;">Razón del rechazo:</strong><br>
              <p style="margin: 8px 0 0 0; color: #1f2937;">' || COALESCE(p_rejection_reason, 'No se especificó razón') || '</p>
            </div>
          </div>
          
          <p><strong>Acción requerida:</strong> Por favor, corrige el problema y vuelve a subir la evidencia de cierre.</p>
          
          <div style="margin: 30px 0;">
            <a href="https://reporta.goodsolutions.app/login" 
               style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ver Reporte y Subir Nueva Evidencia
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

-- Generate consolidated daily reminders with simplified icons
CREATE OR REPLACE FUNCTION generate_consolidated_daily_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company RECORD;
  v_manager RECORD;
  v_pending_reports TEXT := '';
  v_upcoming_deadlines TEXT := '';
  v_overdue_reports TEXT := '';
  v_count_pending INTEGER := 0;
  v_count_upcoming INTEGER := 0;
  v_count_overdue INTEGER := 0;
  v_total_count INTEGER := 0;
  v_subject TEXT;
  v_html_body TEXT;
  v_emails_sent INTEGER := 0;
  v_errors TEXT[] := '{}';
  v_report RECORD;
  v_days INTEGER;
  v_status_badge TEXT;
BEGIN
  FOR v_company IN
    SELECT id, name FROM companies WHERE active = true
  LOOP
    FOR v_manager IN
      SELECT id, email, full_name
      FROM users
      WHERE company_id = v_company.id
        AND role = 'sst_manager'
        AND active = true
        AND email IS NOT NULL
        AND email != ''
    LOOP
      v_pending_reports := '';
      v_upcoming_deadlines := '';
      v_overdue_reports := '';
      v_count_pending := 0;
      v_count_upcoming := 0;
      v_count_overdue := 0;
      
      FOR v_report IN
        SELECT 
          r.id,
          r.type,
          r.created_at,
          r.area,
          r.proyecto,
          cat.name as category_name,
          creator.full_name as creator_name,
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - r.created_at))::INTEGER as days_pending
        FROM reports r
        LEFT JOIN categories cat ON r.category_id = cat.id
        LEFT JOIN users creator ON r.created_by = creator.id
        WHERE r.company_id = v_company.id
          AND r.status = 'reported'
          AND (r.assigned_to_id IS NULL OR r.proposed_closure_date IS NULL)
          AND EXTRACT(DAY FROM (CURRENT_TIMESTAMP - r.created_at)) >= 2
        ORDER BY r.created_at ASC
      LOOP
        v_count_pending := v_count_pending + 1;
        v_pending_reports := v_pending_reports || 
          '<tr style="background-color: ' || (CASE WHEN v_count_pending % 2 = 0 THEN '#f9fafb' ELSE 'white' END) || ';">
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">#' || SUBSTRING(v_report.id::TEXT, 1, 8) || '</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">' || 
              (CASE WHEN v_report.type = 'unsafe_act' THEN 'Acto Inseguro' ELSE 'Condición Insegura' END) || 
            '</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">' || COALESCE(v_report.category_name, 'Sin categoría') || '</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">' || COALESCE(v_report.area, 'N/A') || '</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              <span style="background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-weight: bold;">' || 
              v_report.days_pending || ' días</span>
            </td>
          </tr>';
      END LOOP;
      
      FOR v_report IN
        SELECT 
          r.id,
          r.type,
          r.proposed_closure_date,
          r.area,
          r.proyecto,
          cat.name as category_name,
          responsible.full_name as responsible_name,
          EXTRACT(DAY FROM (r.proposed_closure_date::date - CURRENT_DATE))::INTEGER as days_until
        FROM reports r
        LEFT JOIN categories cat ON r.category_id = cat.id
        LEFT JOIN users responsible ON r.assigned_to_id = responsible.id
        WHERE r.company_id = v_company.id
          AND r.status = 'assigned'
          AND r.proposed_closure_date IS NOT NULL
          AND r.proposed_closure_date::date >= CURRENT_DATE
          AND EXTRACT(DAY FROM (r.proposed_closure_date::date - CURRENT_DATE)) <= 3
        ORDER BY r.proposed_closure_date ASC
      LOOP
        v_count_upcoming := v_count_upcoming + 1;
        v_days := v_report.days_until;
        
        IF v_days = 0 THEN
          v_status_badge := '<span style="background-color: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-weight: bold;">HOY</span>';
        ELSIF v_days = 1 THEN
          v_status_badge := '<span style="background-color: #fed7aa; color: #c2410c; padding: 4px 8px; border-radius: 4px; font-weight: bold;">Mañana</span>';
        ELSE
          v_status_badge := '<span style="background-color: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-weight: bold;">En ' || v_days || ' días</span>';
        END IF;
        
        v_upcoming_deadlines := v_upcoming_deadlines || 
          '<tr style="background-color: ' || (CASE WHEN v_count_upcoming % 2 = 0 THEN '#f9fafb' ELSE 'white' END) || ';">
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">#' || SUBSTRING(v_report.id::TEXT, 1, 8) || '</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">' || COALESCE(v_report.responsible_name, 'Sin asignar') || '</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">' || 
              (CASE WHEN v_report.type = 'unsafe_act' THEN 'Acto Inseguro' ELSE 'Condición Insegura' END) || 
            '</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">' || TO_CHAR(v_report.proposed_closure_date, 'DD/MM/YYYY') || '</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">' || v_status_badge || '</td>
          </tr>';
      END LOOP;
      
      FOR v_report IN
        SELECT 
          r.id,
          r.type,
          r.proposed_closure_date,
          r.area,
          r.proyecto,
          cat.name as category_name,
          responsible.full_name as responsible_name,
          ABS(EXTRACT(DAY FROM (r.proposed_closure_date::date - CURRENT_DATE)))::INTEGER as days_overdue
        FROM reports r
        LEFT JOIN categories cat ON r.category_id = cat.id
        LEFT JOIN users responsible ON r.assigned_to_id = responsible.id
        WHERE r.company_id = v_company.id
          AND r.status = 'assigned'
          AND r.proposed_closure_date IS NOT NULL
          AND r.proposed_closure_date::date < CURRENT_DATE
        ORDER BY r.proposed_closure_date ASC
      LOOP
        v_count_overdue := v_count_overdue + 1;
        v_overdue_reports := v_overdue_reports || 
          '<tr style="background-color: ' || (CASE WHEN v_count_overdue % 2 = 0 THEN '#fef2f2' ELSE '#fee2e2' END) || ';">
            <td style="padding: 12px; border-bottom: 1px solid #fecaca;">#' || SUBSTRING(v_report.id::TEXT, 1, 8) || '</td>
            <td style="padding: 12px; border-bottom: 1px solid #fecaca;">' || COALESCE(v_report.responsible_name, 'Sin asignar') || '</td>
            <td style="padding: 12px; border-bottom: 1px solid #fecaca;">' || 
              (CASE WHEN v_report.type = 'unsafe_act' THEN 'Acto Inseguro' ELSE 'Condición Insegura' END) || 
            '</td>
            <td style="padding: 12px; border-bottom: 1px solid #fecaca; color: #dc2626; font-weight: bold;">' || 
              TO_CHAR(v_report.proposed_closure_date, 'DD/MM/YYYY') || 
            '</td>
            <td style="padding: 12px; border-bottom: 1px solid #fecaca; text-align: center;">
              <span style="background-color: #dc2626; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">VENCIDO ' || 
              v_report.days_overdue || ' días</span>
            </td>
          </tr>';
      END LOOP;
      
      v_total_count := v_count_pending + v_count_upcoming + v_count_overdue;
      
      IF v_total_count > 0 THEN
        v_subject := '[' || v_company.name || '] Recordatorio Diario: ' || v_total_count || ' reporte';
        IF v_total_count > 1 THEN
          v_subject := v_subject || 's';
        END IF;
        IF v_count_overdue > 0 THEN
          v_subject := v_subject || ' (' || v_count_overdue || ' VENCIDO';
          IF v_count_overdue > 1 THEN
            v_subject := v_subject || 'S';
          END IF;
          v_subject := v_subject || ')';
        END IF;
        
        v_html_body := '<html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Recordatorio Diario</h1>
                <p style="color: #fecaca; margin: 10px 0 0 0; font-size: 16px;">' || v_company.name || '</p>
              </div>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-left: 4px solid #dc2626;">
                <p style="margin: 0; font-size: 18px;">Hola <strong>' || v_manager.full_name || '</strong>,</p>
                <p style="margin: 10px 0 0 0;">Tienes <strong>' || v_total_count || ' reporte';
        
        IF v_total_count > 1 THEN
          v_html_body := v_html_body || 's';
        END IF;
        
        v_html_body := v_html_body || '</strong> que requiere';
        
        IF v_total_count = 1 THEN
          v_html_body := v_html_body || ' atención hoy:</p>';
        ELSE
          v_html_body := v_html_body || 'n atención hoy:</p>';
        END IF;
        
        v_html_body := v_html_body || '
                <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">';
        
        IF v_count_overdue > 0 THEN
          v_html_body := v_html_body || '
                  <span style="background-color: #dc2626; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold;">
                    ' || v_count_overdue || ' Vencido';
          IF v_count_overdue > 1 THEN
            v_html_body := v_html_body || 's';
          END IF;
          v_html_body := v_html_body || '</span>';
        END IF;
        
        IF v_count_upcoming > 0 THEN
          v_html_body := v_html_body || '
                  <span style="background-color: #2563eb; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold;">
                    ' || v_count_upcoming || ' Próximo';
          IF v_count_upcoming > 1 THEN
            v_html_body := v_html_body || 's';
          END IF;
          v_html_body := v_html_body || ' a vencer</span>';
        END IF;
        
        IF v_count_pending > 0 THEN
          v_html_body := v_html_body || '
                  <span style="background-color: #f59e0b; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold;">
                    ' || v_count_pending || ' Sin asignar</span>';
        END IF;
        
        v_html_body := v_html_body || '
                </div>
              </div>';
        
        IF v_count_overdue > 0 THEN
          v_html_body := v_html_body || '
              <div style="margin-top: 30px;">
                <h2 style="color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 10px;">
                  Reportes Vencidos (' || v_count_overdue || ')
                </h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <thead>
                    <tr style="background-color: #dc2626; color: white;">
                      <th style="padding: 12px; text-align: left;">ID</th>
                      <th style="padding: 12px; text-align: left;">Responsable</th>
                      <th style="padding: 12px; text-align: left;">Tipo</th>
                      <th style="padding: 12px; text-align: left;">Fecha Límite</th>
                      <th style="padding: 12px; text-align: center;">Retraso</th>
                    </tr>
                  </thead>
                  <tbody>' || v_overdue_reports || '</tbody>
                </table>
              </div>';
        END IF;
        
        IF v_count_upcoming > 0 THEN
          v_html_body := v_html_body || '
              <div style="margin-top: 30px;">
                <h2 style="color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px;">
                  Reportes Próximos a Vencer (' || v_count_upcoming || ')
                </h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <thead>
                    <tr style="background-color: #2563eb; color: white;">
                      <th style="padding: 12px; text-align: left;">ID</th>
                      <th style="padding: 12px; text-align: left;">Responsable</th>
                      <th style="padding: 12px; text-align: left;">Tipo</th>
                      <th style="padding: 12px; text-align: left;">Fecha Límite</th>
                      <th style="padding: 12px; text-align: center;">Estado</th>
                    </tr>
                  </thead>
                  <tbody>' || v_upcoming_deadlines || '</tbody>
                </table>
              </div>';
        END IF;
        
        IF v_count_pending > 0 THEN
          v_html_body := v_html_body || '
              <div style="margin-top: 30px;">
                <h2 style="color: #f59e0b; border-bottom: 3px solid #f59e0b; padding-bottom: 10px;">
                  Reportes Sin Asignar (' || v_count_pending || ')
                </h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <thead>
                    <tr style="background-color: #f59e0b; color: white;">
                      <th style="padding: 12px; text-align: left;">ID</th>
                      <th style="padding: 12px; text-align: left;">Tipo</th>
                      <th style="padding: 12px; text-align: left;">Categoría</th>
                      <th style="padding: 12px; text-align: left;">Área</th>
                      <th style="padding: 12px; text-align: center;">Días Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>' || v_pending_reports || '</tbody>
                </table>
              </div>';
        END IF;
        
        v_html_body := v_html_body || '
              <div style="margin-top: 40px; text-align: center; padding: 30px; background-color: #f9fafb; border-radius: 8px;">
                <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937;">
                  <strong>Gestiona todos estos reportes desde el sistema</strong>
                </p>
                <a href="https://reporta.goodsolutions.app/login" 
                   style="background-color: #dc2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">
                  Acceder al Sistema
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 40px 0 30px 0;">
              
              <p style="font-size: 12px; color: #6b7280; text-align: center;">
                Este es un recordatorio automático del sistema de reportes de ' || v_company.name || '.<br>
                <strong>Este resumen se envía automáticamente todos los días a las 8:00 AM.</strong><br>
                Por favor no respondas a este correo.
              </p>
            </div>
          </body>
        </html>';
        
        BEGIN
          PERFORM enqueue_email(
            p_company_id := v_company.id,
            p_recipient_user_id := v_manager.id,
            p_recipient_email := v_manager.email,
            p_email_type := 'daily_reminder',
            p_subject := v_subject,
            p_html_body := v_html_body,
            p_data := jsonb_build_object(
              'total_count', v_total_count,
              'count_pending', v_count_pending,
              'count_upcoming', v_count_upcoming,
              'count_overdue', v_count_overdue
            )
          );
          
          v_emails_sent := v_emails_sent + 1;
        EXCEPTION WHEN OTHERS THEN
          v_errors := array_append(v_errors, 'Manager ' || v_manager.email || ': ' || SQLERRM);
        END;
      END IF;
      
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'emails_sent', v_emails_sent,
    'errors', v_errors
  );
END;
$$;