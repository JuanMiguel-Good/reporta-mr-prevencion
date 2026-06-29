/*
  # Add Email Notification System

  1. New Tables
    - `email_queue`
      - Queue for pending emails to be sent
      - Includes retry logic and scheduled delivery
      - Company-scoped for security
    
    - `email_history`
      - Audit log of all sent emails
      - Tracks delivery status and SMTP responses
      - Company-scoped for security
    
    - `email_delivery_status`
      - Tracks email validation and bounce status
      - Prevents sending to invalid emails
      - Auto-blocks after multiple bounces
  
  2. Helper Functions
    - `format_datetime_peru()` - Format timestamps in Lima timezone (DD/MM/YY HH24:MI)
    - `format_date_peru()` - Format dates in Lima timezone (DD/MM/YY)
    - `get_sst_managers_for_company()` - Get all SST managers for a company
    - `enqueue_email()` - Queue an email for sending
  
  3. Triggers
    - Auto-queue emails when reports are created
    - Auto-queue emails when reports are assigned
    - Auto-queue emails when evidence is uploaded
    - Auto-queue emails when evidence is rejected
  
  4. Security
    - All tables have RLS enabled
    - Only super admins and edge functions can access
    - All queries are company-scoped
*/

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Email Queue Table
CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  email_type text NOT NULL CHECK (email_type IN (
    'new_report',
    'report_assigned',
    'evidence_uploaded',
    'evidence_rejected',
    'daily_reminder',
    'smtp_failure_alert'
  )),
  subject text NOT NULL,
  html_body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Email History Table (for auditing)
CREATE TABLE IF NOT EXISTS email_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  email_type text NOT NULL,
  subject text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivery_status text NOT NULL CHECK (delivery_status IN ('delivered', 'bounced', 'failed')),
  smtp_response text,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Email Delivery Status Table (track bounces)
CREATE TABLE IF NOT EXISTS email_delivery_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address text UNIQUE NOT NULL,
  last_bounce_at timestamptz,
  bounce_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'soft_bounce', 'hard_bounce', 'invalid')),
  last_successful_delivery timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled ON email_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_company ON email_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_email_history_company ON email_history(company_id);
CREATE INDEX IF NOT EXISTS idx_email_history_sent_at ON email_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_delivery_status_lookup ON email_delivery_status(email_address, status);

-- =====================================================
-- 2. ENABLE RLS
-- =====================================================

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_delivery_status ENABLE ROW LEVEL SECURITY;

-- Only super admins can access these tables (edge functions bypass RLS)
CREATE POLICY "Super admins can manage email queue"
  ON email_queue FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can view email history"
  ON email_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can manage email delivery status"
  ON email_delivery_status FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- =====================================================
-- 3. HELPER FUNCTIONS
-- =====================================================

-- Format timestamp in Lima timezone as DD/MM/YY HH24:MI
CREATE OR REPLACE FUNCTION format_datetime_peru(ts timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT TO_CHAR(ts AT TIME ZONE 'America/Lima', 'DD/MM/YY HH24:MI');
$$;

-- Format date in Lima timezone as DD/MM/YY
CREATE OR REPLACE FUNCTION format_date_peru(ts timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT TO_CHAR(ts AT TIME ZONE 'America/Lima', 'DD/MM/YY');
$$;

-- Get all SST managers for a company
CREATE OR REPLACE FUNCTION get_sst_managers_for_company(target_company_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    id,
    email,
    full_name
  FROM users
  WHERE company_id = target_company_id
    AND role = 'sst_manager'
    AND active = true
    AND email IS NOT NULL
    AND email != '';
$$;

-- Queue an email for sending
CREATE OR REPLACE FUNCTION enqueue_email(
  p_company_id uuid,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_email_type text,
  p_subject text,
  p_html_body text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_scheduled_for timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email_id uuid;
  v_email_status text;
BEGIN
  -- Check if email is blocked due to bounces
  SELECT status INTO v_email_status
  FROM email_delivery_status
  WHERE email_address = p_recipient_email;

  -- Don't queue emails to invalid addresses
  IF v_email_status IN ('hard_bounce', 'invalid') THEN
    RAISE NOTICE 'Email % is marked as %, skipping', p_recipient_email, v_email_status;
    RETURN NULL;
  END IF;

  -- Insert into queue
  INSERT INTO email_queue (
    company_id,
    recipient_user_id,
    recipient_email,
    email_type,
    subject,
    html_body,
    data,
    scheduled_for
  ) VALUES (
    p_company_id,
    p_recipient_user_id,
    p_recipient_email,
    p_email_type,
    p_subject,
    p_html_body,
    p_data,
    p_scheduled_for
  )
  RETURNING id INTO v_email_id;

  RETURN v_email_id;
END;
$$;

-- =====================================================
-- 4. EMAIL TEMPLATE GENERATION FUNCTIONS
-- =====================================================

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
  -- Get report details
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
            <a href="https://app.goodsolutions.app/gallery" 
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
  -- Get report details
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
            <h3 style="margin-top: 0; color: #92400e;">⚠️ Reporte Asignado</h3>
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
            <a href="https://app.goodsolutions.app/gallery" 
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
  -- Get report details
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
            <h3 style="margin-top: 0; color: #1e40af;">📸 Evidencia Pendiente de Revisión</h3>
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
            <a href="https://app.goodsolutions.app/gallery?status=in_review" 
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
  -- Get report details
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
            <h3 style="margin-top: 0; color: #991b1b;">❌ Evidencia Rechazada</h3>
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
            <a href="https://app.goodsolutions.app/gallery" 
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

-- =====================================================
-- 5. TRIGGERS FOR AUTO-QUEUEING EMAILS
-- =====================================================

-- Trigger function: Queue emails when new report is created
CREATE OR REPLACE FUNCTION trigger_queue_new_report_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_manager RECORD;
  v_email_content RECORD;
BEGIN
  -- Get all SST managers for this company
  FOR v_manager IN 
    SELECT * FROM get_sst_managers_for_company(NEW.company_id)
  LOOP
    -- Generate email content
    SELECT * INTO v_email_content
    FROM generate_new_report_email(NEW.id, NEW.company_id, v_manager.full_name);
    
    -- Queue the email
    PERFORM enqueue_email(
      NEW.company_id,
      v_manager.user_id,
      v_manager.email,
      'new_report',
      v_email_content.subject,
      v_email_content.html_body,
      jsonb_build_object('report_id', NEW.id)
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger function: Queue email when report is assigned
CREATE OR REPLACE FUNCTION trigger_queue_assignment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assigned_user RECORD;
  v_email_content RECORD;
BEGIN
  -- Only send if assigned_to_id changed and is not null
  IF NEW.assigned_to_id IS NOT NULL AND (
    OLD.assigned_to_id IS NULL OR OLD.assigned_to_id != NEW.assigned_to_id
  ) THEN
    -- Get assigned user details
    SELECT id, email, full_name INTO v_assigned_user
    FROM users
    WHERE id = NEW.assigned_to_id
      AND email IS NOT NULL
      AND email != '';
    
    IF FOUND THEN
      -- Generate email content
      SELECT * INTO v_email_content
      FROM generate_report_assigned_email(NEW.id, NEW.company_id, v_assigned_user.full_name);
      
      -- Queue the email
      PERFORM enqueue_email(
        NEW.company_id,
        v_assigned_user.id,
        v_assigned_user.email,
        'report_assigned',
        v_email_content.subject,
        v_email_content.html_body,
        jsonb_build_object('report_id', NEW.id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function: Queue emails when evidence is uploaded (status changes to in_review)
CREATE OR REPLACE FUNCTION trigger_queue_evidence_uploaded_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_manager RECORD;
  v_email_content RECORD;
  v_uploader_name text;
BEGIN
  -- Only send if status changed to 'in_review'
  IF NEW.status = 'in_review' AND (OLD.status IS NULL OR OLD.status != 'in_review') THEN
    -- Get uploader name (assigned_to user)
    SELECT full_name INTO v_uploader_name
    FROM users
    WHERE id = NEW.assigned_to_id;
    
    -- Get all SST managers for this company
    FOR v_manager IN 
      SELECT * FROM get_sst_managers_for_company(NEW.company_id)
    LOOP
      -- Generate email content
      SELECT * INTO v_email_content
      FROM generate_evidence_uploaded_email(
        NEW.id, 
        NEW.company_id, 
        v_manager.full_name,
        COALESCE(v_uploader_name, 'Usuario')
      );
      
      -- Queue the email
      PERFORM enqueue_email(
        NEW.company_id,
        v_manager.user_id,
        v_manager.email,
        'evidence_uploaded',
        v_email_content.subject,
        v_email_content.html_body,
        jsonb_build_object('report_id', NEW.id)
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function: Queue email when evidence is rejected
CREATE OR REPLACE FUNCTION trigger_queue_evidence_rejected_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assigned_user RECORD;
  v_email_content RECORD;
BEGIN
  -- Only send if status changed to 'evidence_rejected'
  IF NEW.status = 'evidence_rejected' AND (OLD.status IS NULL OR OLD.status != 'evidence_rejected') THEN
    -- Get assigned user details
    SELECT id, email, full_name INTO v_assigned_user
    FROM users
    WHERE id = NEW.assigned_to_id
      AND email IS NOT NULL
      AND email != '';
    
    IF FOUND THEN
      -- Generate email content
      SELECT * INTO v_email_content
      FROM generate_evidence_rejected_email(
        NEW.id, 
        NEW.company_id, 
        v_assigned_user.full_name,
        NEW.rejection_reason
      );
      
      -- Queue the email
      PERFORM enqueue_email(
        NEW.company_id,
        v_assigned_user.id,
        v_assigned_user.email,
        'evidence_rejected',
        v_email_content.subject,
        v_email_content.html_body,
        jsonb_build_object('report_id', NEW.id, 'rejection_reason', NEW.rejection_reason)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS queue_new_report_emails ON reports;
CREATE TRIGGER queue_new_report_emails
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_queue_new_report_emails();

DROP TRIGGER IF EXISTS queue_assignment_email ON reports;
CREATE TRIGGER queue_assignment_email
  AFTER UPDATE ON reports
  FOR EACH ROW
  WHEN (NEW.assigned_to_id IS NOT NULL)
  EXECUTE FUNCTION trigger_queue_assignment_email();

DROP TRIGGER IF EXISTS queue_evidence_uploaded_emails ON reports;
CREATE TRIGGER queue_evidence_uploaded_emails
  AFTER UPDATE ON reports
  FOR EACH ROW
  WHEN (NEW.status = 'in_review')
  EXECUTE FUNCTION trigger_queue_evidence_uploaded_emails();

DROP TRIGGER IF EXISTS queue_evidence_rejected_email ON reports;
CREATE TRIGGER queue_evidence_rejected_email
  AFTER UPDATE ON reports
  FOR EACH ROW
  WHEN (NEW.status = 'evidence_rejected')
  EXECUTE FUNCTION trigger_queue_evidence_rejected_email();
