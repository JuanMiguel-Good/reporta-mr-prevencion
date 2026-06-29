/*
  # Add Pending Review Reminders

  1. Purpose
    - Send daily reminders to SST Managers for reports with evidence pending review
    - Notify when evidence has been uploaded but not approved/rejected after 24 hours
    - Continue sending daily until evidence is reviewed

  2. New Function
    - `send_pending_review_reminders()` - Sends reminders for reports in 'in_review' status
    - Checks reports that have been in review for 24+ hours
    - Sends daily reminders until status changes

  3. Recipients
    - SST Managers (who need to approve or reject evidence)

  4. Integration
    - Will be called by send-daily-reminders Edge Function
    - Runs daily at 8am Peru time along with other reminders
*/

-- Function to send reminders for pending evidence reviews
CREATE OR REPLACE FUNCTION send_pending_review_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report RECORD;
  v_manager RECORD;
  v_hours_pending INTEGER;
  v_days_pending INTEGER;
  v_subject TEXT;
  v_html_body TEXT;
  v_reminders_sent INTEGER := 0;
  v_errors TEXT[] := '{}';
  v_responsible_name TEXT;
  v_category_name TEXT;
BEGIN
  -- Find reports in 'in_review' status for more than 24 hours
  FOR v_report IN
    SELECT 
      r.id,
      r.company_id,
      r.type,
      r.created_at,
      r.updated_at,
      r.assigned_to_id,
      r.area,
      r.proyecto,
      r.proposed_closure_date,
      c.name as company_name
    FROM reports r
    JOIN companies c ON r.company_id = c.id
    WHERE r.status = 'in_review'
      AND c.active = true
      AND EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - r.updated_at)) / 3600 >= 24
  LOOP
    -- Calculate time pending
    v_hours_pending := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_report.updated_at)) / 3600;
    v_days_pending := FLOOR(v_hours_pending / 24)::INTEGER;
    
    -- Get responsible person name
    SELECT full_name INTO v_responsible_name
    FROM users
    WHERE id = v_report.assigned_to_id;
    
    -- Get category name
    SELECT cat.name INTO v_category_name
    FROM categories cat
    JOIN reports r ON r.category_id = cat.id
    WHERE r.id = v_report.id;
    
    -- Find all SST managers for this company
    FOR v_manager IN
      SELECT id, email, full_name
      FROM users
      WHERE company_id = v_report.company_id
        AND role = 'sst_manager'
        AND active = true
        AND email IS NOT NULL
        AND email != ''
    LOOP
      
      v_subject := '[' || v_report.company_name || '] Recordatorio: Evidencia Pendiente de Revisión - ' || v_days_pending || ' días';
      
      v_html_body := '<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
<div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
<h2 style="margin: 0 0 8px 0; color: #1e40af;">Evidencia Pendiente de Revisión</h2>
<p style="margin: 0; color: #1e3a8a;">Este reporte tiene evidencia subida que lleva <strong>' || v_days_pending || ' días</strong> esperando aprobación o rechazo.</p>
</div>

<h3 style="color: #1f2937;">Detalles del Reporte</h3>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
<tr>
<td style="padding: 8px 0; font-weight: bold; width: 40%;">ID del Reporte:</td>
<td style="padding: 8px 0;">#' || SUBSTRING(v_report.id::TEXT, 1, 8) || '</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Responsable:</td>
<td style="padding: 8px 0;">' || COALESCE(v_responsible_name, 'Sin asignar') || '</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Tipo:</td>
<td style="padding: 8px 0;">' || 
CASE WHEN v_report.type = 'unsafe_act' THEN 'Acto Inseguro' ELSE 'Condición Insegura' END || 
'</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Categoría:</td>
<td style="padding: 8px 0;">' || COALESCE(v_category_name, 'Sin categoría') || '</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Área:</td>
<td style="padding: 8px 0;">' || COALESCE(v_report.area, 'N/A') || '</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Evidencia subida:</td>
<td style="padding: 8px 0;">' || 
TO_CHAR(v_report.updated_at, 'DD/MM/YYYY HH24:MI') || 
'</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Tiempo en revisión:</td>
<td style="padding: 8px 0; color: #2563eb; font-weight: bold;">' || v_days_pending || ' días</td>
</tr>
</table>

<div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
<p style="margin: 0; font-weight: bold; color: #1f2937;">Acción Requerida</p>
<p style="margin: 8px 0;">Por favor revisa la evidencia subida por <strong>' || COALESCE(v_responsible_name, 'el responsable') || '</strong> y apruébala o recházala lo antes posible.</p>
</div>

<div style="margin: 30px 0;">
<a href="https://reporta.goodsolutions.app/login" 
style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
Revisar Evidencia Ahora
</a>
</div>

<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

<p style="font-size: 12px; color: #6b7280;">
Este es un recordatorio automático del sistema de reportes de ' || v_report.company_name || '.<br>
Por favor no respondas a este correo.
</p>
</div>
</body>
</html>';
      
      BEGIN
        PERFORM enqueue_email(
          p_company_id := v_report.company_id,
          p_recipient_user_id := v_manager.id,
          p_recipient_email := v_manager.email,
          p_email_type := 'pending_review_reminder',
          p_subject := v_subject,
          p_html_body := v_html_body,
          p_data := jsonb_build_object(
            'report_id', v_report.id,
            'days_pending', v_days_pending
          )
        );
        
        v_reminders_sent := v_reminders_sent + 1;
      EXCEPTION WHEN OTHERS THEN
        v_errors := array_append(v_errors, 'Report #' || v_report.id || ' to ' || v_manager.email || ': ' || SQLERRM);
      END;
      
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'reminders_sent', v_reminders_sent,
    'errors', v_errors
  );
END;
$$;
