/*
  # Add Evidence Approved Email Notification

  1. Purpose
    - Notify responsible person when their evidence is approved
    - Send email when report status changes to 'closed'
    - Complete the notification workflow for all report lifecycle events

  2. New Components
    - Function `trigger_queue_evidence_approved_email()` - Creates email for approved evidence
    - Trigger `queue_evidence_approved_email` - Fires when status becomes 'closed'

  3. Notification Recipients
    - Responsible person (who uploaded the evidence)

  4. Email Content
    - Congratulates on closure approval
    - Shows report details
    - Provides link to view closed report
*/

-- Function to queue evidence approved email
CREATE OR REPLACE FUNCTION trigger_queue_evidence_approved_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_name TEXT;
  v_responsible_email TEXT;
  v_responsible_name TEXT;
  v_category_name TEXT;
  v_subject TEXT;
  v_html_body TEXT;
BEGIN
  -- Only proceed if status changed to 'closed' and there's an assigned person
  IF OLD.status = 'closed' OR NEW.assigned_to_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get company name
  SELECT name INTO v_company_name
  FROM companies
  WHERE id = NEW.company_id;

  -- Get responsible person details
  SELECT email, full_name INTO v_responsible_email, v_responsible_name
  FROM users
  WHERE id = NEW.assigned_to_id;

  -- Skip if no email
  IF v_responsible_email IS NULL OR v_responsible_email = '' THEN
    RETURN NEW;
  END IF;

  -- Get category name
  SELECT name INTO v_category_name
  FROM categories
  WHERE id = NEW.category_id;

  -- Build subject
  v_subject := '[' || v_company_name || '] Evidencia Aprobada - Reporte Cerrado';

  -- Build HTML body
  v_html_body := '<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<div style="max-width: 600px; margin: 0 auto; padding: 20px;">
<div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
<h2 style="margin: 0 0 8px 0; color: #065f46;">Evidencia Aprobada</h2>
<p style="margin: 0; color: #047857;">Tu evidencia de cierre ha sido aprobada y el reporte ha sido cerrado exitosamente.</p>
</div>

<h3 style="color: #1f2937;">Detalles del Reporte</h3>
<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
<tr>
<td style="padding: 8px 0; font-weight: bold; width: 40%;">ID del Reporte:</td>
<td style="padding: 8px 0;">#' || SUBSTRING(NEW.id::TEXT, 1, 8) || '</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Tipo:</td>
<td style="padding: 8px 0;">' || 
CASE WHEN NEW.type = 'unsafe_act' THEN 'Acto Inseguro' ELSE 'Condición Insegura' END || 
'</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Categoría:</td>
<td style="padding: 8px 0;">' || COALESCE(v_category_name, 'Sin categoría') || '</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Área:</td>
<td style="padding: 8px 0;">' || COALESCE(NEW.area, 'N/A') || '</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Proyecto:</td>
<td style="padding: 8px 0;">' || COALESCE(NEW.proyecto, 'N/A') || '</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Estado:</td>
<td style="padding: 8px 0; color: #10b981; font-weight: bold;">CERRADO</td>
</tr>
<tr>
<td style="padding: 8px 0; font-weight: bold;">Fecha de cierre:</td>
<td style="padding: 8px 0;">' || 
TO_CHAR(NEW.updated_at, 'DD/MM/YYYY HH24:MI') || 
'</td>
</tr>
</table>

<div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
<p style="margin: 0; font-weight: bold; color: #1f2937;">Felicitaciones</p>
<p style="margin: 8px 0;">Tu evidencia de cierre ha sido revisada y aprobada. El reporte ha sido cerrado exitosamente. Gracias por tu colaboración en mejorar la seguridad.</p>
</div>

<div style="margin: 30px 0;">
<a href="https://reporta.goodsolutions.app/login" 
style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
Ver Reporte Cerrado
</a>
</div>

<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

<p style="font-size: 12px; color: #6b7280;">
Este es una notificación automática del sistema de reportes de ' || v_company_name || '.<br>
Por favor no respondas a este correo.
</p>
</div>
</body>
</html>';

  -- Queue the email
  PERFORM enqueue_email(
    p_company_id := NEW.company_id,
    p_recipient_user_id := NEW.assigned_to_id,
    p_recipient_email := v_responsible_email,
    p_email_type := 'evidence_approved',
    p_subject := v_subject,
    p_html_body := v_html_body,
    p_data := jsonb_build_object('report_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- Create trigger for evidence approved
DROP TRIGGER IF EXISTS queue_evidence_approved_email ON reports;

CREATE TRIGGER queue_evidence_approved_email
AFTER UPDATE ON reports
FOR EACH ROW
WHEN (NEW.status = 'closed' AND OLD.status != 'closed')
EXECUTE FUNCTION trigger_queue_evidence_approved_email();
