/*
  # Fix Date Calculations in Reminder Functions

  1. Changes
    - Fix EXTRACT usage for date differences
    - Use proper date arithmetic
    
  2. Purpose
    - Ensure date calculations work correctly
*/

-- Fix pending assignment reminders function
CREATE OR REPLACE FUNCTION send_pending_assignment_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report RECORD;
  v_manager RECORD;
  v_days_since_creation INTEGER;
  v_subject TEXT;
  v_html_body TEXT;
  v_reminders_sent INTEGER := 0;
  v_errors TEXT[] := '{}';
BEGIN
  FOR v_report IN
    SELECT 
      r.id,
      r.company_id,
      r.type,
      r.created_at,
      r.area,
      r.proyecto,
      c.name as company_name,
      cat.name as category_name,
      reporter.full_name as reporter_name
    FROM reports r
    JOIN companies c ON r.company_id = c.id
    LEFT JOIN categories cat ON r.category_id = cat.id
    LEFT JOIN users reporter ON r.reporter_id = reporter.id
    WHERE r.status = 'reported'
      AND (r.assigned_to_id IS NULL OR r.proposed_closure_date IS NULL)
      AND c.active = true
  LOOP
    -- Calculate days since creation (using date subtraction)
    v_days_since_creation := CURRENT_DATE - r.created_at::date;
    
    -- Send reminder on day 2, then every 2 days (2, 4, 6, 8, etc.)
    IF v_days_since_creation >= 2 AND v_days_since_creation % 2 = 0 THEN
      
      FOR v_manager IN
        SELECT id, email, full_name
        FROM users
        WHERE company_id = v_report.company_id
          AND role = 'sst_manager'
          AND active = true
          AND email IS NOT NULL
      LOOP
        
        v_subject := '[' || v_report.company_name || '] Recordatorio: Reporte #' || v_report.id || ' Sin Asignar';
        
        v_html_body := '
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
                  <h2 style="margin: 0 0 8px 0; color: #92400e;">⚠️ Reporte Pendiente de Asignación</h2>
                  <p style="margin: 0; color: #78350f;">Este reporte lleva <strong>' || v_days_since_creation || ' días</strong> sin ser asignado.</p>
                </div>
                
                <h3 style="color: #1f2937;">Detalles del Reporte</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; width: 40%;">ID del Reporte:</td>
                    <td style="padding: 8px 0;">#' || v_report.id || '</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Tipo:</td>
                    <td style="padding: 8px 0;">' || 
                      CASE WHEN v_report.type = 'unsafe_act' THEN 'Acto Inseguro' ELSE 'Condición Insegura' END || 
                    '</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Categoría:</td>
                    <td style="padding: 8px 0;">' || COALESCE(v_report.category_name, 'Sin categoría') || '</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Área:</td>
                    <td style="padding: 8px 0;">' || COALESCE(v_report.area, 'N/A') || '</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Proyecto:</td>
                    <td style="padding: 8px 0;">' || COALESCE(v_report.proyecto, 'N/A') || '</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Reportado por:</td>
                    <td style="padding: 8px 0;">' || COALESCE(v_report.reporter_name, 'Desconocido') || '</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Fecha de creación:</td>
                    <td style="padding: 8px 0;">' || 
                      TO_CHAR(v_report.created_at AT TIME ZONE 'America/Lima', 'DD/MM/YYYY HH24:MI') || 
                    '</td>
                  </tr>
                </table>

                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-weight: bold; color: #1f2937;">🎯 Acciones Requeridas:</p>
                  <ul style="margin: 8px 0; padding-left: 20px;">
                    <li>Asignar un responsable de cierre</li>
                    <li>Establecer una fecha propuesta de cierre</li>
                  </ul>
                </div>

                <div style="margin: 30px 0;">
                  <a href="https://app.goodsolutions.app/gallery" 
                     style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Asignar Responsable Ahora
                  </a>
                </div>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <p style="font-size: 12px; color: #6b7280;">
                  Este es un recordatorio automático del sistema de reportes de ' || v_report.company_name || '.<br>
                  Por favor no respondas a este correo.
                </p>
              </div>
            </body>
          </html>
        ';
        
        BEGIN
          PERFORM enqueue_email(
            p_company_id := v_report.company_id,
            p_recipient_user_id := v_manager.id,
            p_recipient_email := v_manager.email,
            p_email_type := 'pending_assignment_reminder',
            p_subject := v_subject,
            p_html_body := v_html_body,
            p_data := jsonb_build_object(
              'report_id', v_report.id,
              'days_pending', v_days_since_creation
            )
          );
          
          v_reminders_sent := v_reminders_sent + 1;
        EXCEPTION WHEN OTHERS THEN
          v_errors := array_append(v_errors, 'Report #' || v_report.id || ' to ' || v_manager.email || ': ' || SQLERRM);
        END;
        
      END LOOP;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'reminders_sent', v_reminders_sent,
    'errors', v_errors
  );
END;
$$;

-- Fix deadline reminders function
CREATE OR REPLACE FUNCTION send_deadline_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report RECORD;
  v_user RECORD;
  v_days_until_deadline INTEGER;
  v_days_overdue INTEGER;
  v_subject TEXT;
  v_html_body TEXT;
  v_reminders_sent INTEGER := 0;
  v_errors TEXT[] := '{}';
  v_should_send BOOLEAN;
BEGIN
  FOR v_report IN
    SELECT 
      r.id,
      r.company_id,
      r.type,
      r.created_at,
      r.proposed_closure_date,
      r.assigned_to_id,
      r.area,
      r.proyecto,
      c.name as company_name,
      cat.name as category_name,
      responsible.full_name as responsible_name,
      responsible.email as responsible_email,
      responsible.id as responsible_id
    FROM reports r
    JOIN companies c ON r.company_id = c.id
    LEFT JOIN categories cat ON r.category_id = cat.id
    LEFT JOIN users responsible ON r.assigned_to_id = responsible.id
    WHERE r.status = 'assigned'
      AND r.proposed_closure_date IS NOT NULL
      AND r.assigned_to_id IS NOT NULL
      AND c.active = true
  LOOP
    v_should_send := false;
    -- Calculate days until deadline (using date subtraction)
    v_days_until_deadline := v_report.proposed_closure_date - CURRENT_DATE;
    
    -- Determine if we should send a reminder
    IF v_days_until_deadline = 3 THEN
      v_should_send := true;
      v_subject := '[' || v_report.company_name || '] Recordatorio: Reporte #' || v_report.id || ' - Cierre en 3 días';
    ELSIF v_days_until_deadline = 1 THEN
      v_should_send := true;
      v_subject := '[' || v_report.company_name || '] Urgente: Reporte #' || v_report.id || ' - Cierre mañana';
    ELSIF v_days_until_deadline = 0 THEN
      v_should_send := true;
      v_subject := '[' || v_report.company_name || '] ⚠️ Reporte #' || v_report.id || ' - Cierre HOY';
    ELSIF v_days_until_deadline < 0 THEN
      v_days_overdue := ABS(v_days_until_deadline);
      IF v_days_overdue % 2 = 0 THEN
        v_should_send := true;
        v_subject := '[' || v_report.company_name || '] 🔴 VENCIDO: Reporte #' || v_report.id || ' - ' || v_days_overdue || ' días de retraso';
      END IF;
    END IF;
    
    IF v_should_send THEN
      v_html_body := '
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: ' || 
                CASE 
                  WHEN v_days_until_deadline < 0 THEN '#fee2e2; border-left: 4px solid #dc2626;'
                  WHEN v_days_until_deadline = 0 THEN '#fef3c7; border-left: 4px solid #f59e0b;'
                  ELSE '#dbeafe; border-left: 4px solid #2563eb;'
                END || 
                ' padding: 16px; margin-bottom: 20px; border-radius: 4px;">
                <h2 style="margin: 0 0 8px 0; color: ' ||
                  CASE 
                    WHEN v_days_until_deadline < 0 THEN '#991b1b;'
                    WHEN v_days_until_deadline = 0 THEN '#92400e;'
                    ELSE '#1e40af;'
                  END ||
                '">' ||
                  CASE 
                    WHEN v_days_until_deadline < 0 THEN '🔴 Reporte Vencido'
                    WHEN v_days_until_deadline = 0 THEN '⚠️ Cierre Hoy'
                    WHEN v_days_until_deadline = 1 THEN '⏰ Cierre Mañana'
                    ELSE '📅 Fecha de Cierre Próxima'
                  END ||
                '</h2>
                <p style="margin: 0;">' ||
                  CASE 
                    WHEN v_days_until_deadline < 0 THEN 'Este reporte está <strong>vencido por ' || ABS(v_days_until_deadline) || ' días</strong>. Se requiere acción inmediata.'
                    WHEN v_days_until_deadline = 0 THEN 'El plazo de cierre vence <strong>hoy</strong>.'
                    WHEN v_days_until_deadline = 1 THEN 'El plazo de cierre vence <strong>mañana</strong>.'
                    ELSE 'El plazo de cierre vence en <strong>' || v_days_until_deadline || ' días</strong>.'
                  END ||
                '</p>
              </div>
              
              <h3 style="color: #1f2937;">Detalles del Reporte</h3>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 40%;">ID del Reporte:</td>
                  <td style="padding: 8px 0;">#' || v_report.id || '</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Responsable:</td>
                  <td style="padding: 8px 0;">' || COALESCE(v_report.responsible_name, 'Sin asignar') || '</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Fecha de cierre:</td>
                  <td style="padding: 8px 0; ' ||
                    CASE WHEN v_days_until_deadline < 0 THEN 'color: #dc2626; font-weight: bold;' ELSE '' END ||
                    '">' || 
                    TO_CHAR(v_report.proposed_closure_date, 'DD/MM/YYYY') || 
                  '</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Tipo:</td>
                  <td style="padding: 8px 0;">' || 
                    CASE WHEN v_report.type = 'unsafe_act' THEN 'Acto Inseguro' ELSE 'Condición Insegura' END || 
                  '</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Categoría:</td>
                  <td style="padding: 8px 0;">' || COALESCE(v_report.category_name, 'Sin categoría') || '</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Área:</td>
                  <td style="padding: 8px 0;">' || COALESCE(v_report.area, 'N/A') || '</td>
                </tr>
              </table>

              <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold; color: #1f2937;">🎯 Acción Requerida:</p>
                <p style="margin: 8px 0;">El responsable <strong>' || COALESCE(v_report.responsible_name, 'asignado') || '</strong> debe subir la evidencia de cierre.</p>
              </div>

              <div style="margin: 30px 0;">
                <a href="https://app.goodsolutions.app/gallery" 
                   style="background-color: ' ||
                     CASE WHEN v_days_until_deadline < 0 THEN '#dc2626' ELSE '#2563eb' END ||
                   '; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Ver Reporte y Subir Evidencia
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #6b7280;">
                Este es un recordatorio automático del sistema de reportes de ' || v_report.company_name || '.<br>
                Por favor no respondas a este correo.
              </p>
            </div>
          </body>
        </html>
      ';
      
      -- Send to SST Manager(s)
      FOR v_user IN
        SELECT id, email, full_name
        FROM users
        WHERE company_id = v_report.company_id
          AND role = 'sst_manager'
          AND active = true
          AND email IS NOT NULL
      LOOP
        BEGIN
          PERFORM enqueue_email(
            p_company_id := v_report.company_id,
            p_recipient_user_id := v_user.id,
            p_recipient_email := v_user.email,
            p_email_type := 'deadline_reminder',
            p_subject := v_subject,
            p_html_body := v_html_body,
            p_data := jsonb_build_object(
              'report_id', v_report.id,
              'days_until_deadline', v_days_until_deadline,
              'recipient_role', 'sst_manager'
            )
          );
          
          v_reminders_sent := v_reminders_sent + 1;
        EXCEPTION WHEN OTHERS THEN
          v_errors := array_append(v_errors, 'Report #' || v_report.id || ' to SST Manager ' || v_user.email || ': ' || SQLERRM);
        END;
      END LOOP;
      
      -- Send to Responsible person
      IF v_report.responsible_email IS NOT NULL THEN
        BEGIN
          PERFORM enqueue_email(
            p_company_id := v_report.company_id,
            p_recipient_user_id := v_report.responsible_id,
            p_recipient_email := v_report.responsible_email,
            p_email_type := 'deadline_reminder',
            p_subject := v_subject,
            p_html_body := v_html_body,
            p_data := jsonb_build_object(
              'report_id', v_report.id,
              'days_until_deadline', v_days_until_deadline,
              'recipient_role', 'responsible'
            )
          );
          
          v_reminders_sent := v_reminders_sent + 1;
        EXCEPTION WHEN OTHERS THEN
          v_errors := array_append(v_errors, 'Report #' || v_report.id || ' to Responsible ' || v_report.responsible_email || ': ' || SQLERRM);
        END;
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'reminders_sent', v_reminders_sent,
    'errors', v_errors
  );
END;
$$;