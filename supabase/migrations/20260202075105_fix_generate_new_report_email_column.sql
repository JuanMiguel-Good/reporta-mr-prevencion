/*
  # Fix generate_new_report_email Column Reference
  
  1. Cambios
    - Corrige created_by a reporter_id en generate_new_report_email
*/

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
    '<html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 20px; border-radius: 4px;">
            <h2 style="margin: 0 0 8px 0; color: #92400e;">Nuevo Reporte Creado</h2>
            <p style="margin: 0; color: #78350f;">Se ha creado un nuevo reporte que requiere asignación.</p>
          </div>
          
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
          
          <div style="margin: 30px 0;">
            <a href="https://reporta.goodsolutions.app/login" 
               style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Asignar Responsable
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #6b7280;">
            Este es un correo automático del sistema de reportes de ' || v_company_name || '.<br>
            Por favor no respondas a este correo.
          </p>
        </div>
      </body>
    </html>' AS html_body;
END;
$$;
