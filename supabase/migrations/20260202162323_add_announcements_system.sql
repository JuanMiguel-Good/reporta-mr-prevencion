/*
  # Sistema de Anuncios del Super Admin a Gestores SST

  ## Propósito
  Permite al Super Admin enviar comunicaciones masivas a todos los Gestores SST del sistema.
  
  ## Nuevas Tablas

  ### 1. `announcements`
  Almacena los anuncios creados por el Super Admin
  - `id` (uuid, PK)
  - `title` (text) - Título del anuncio
  - `message` (text) - Contenido completo del mensaje
  - `priority` (text) - Nivel de prioridad: 'info', 'warning', 'important'
  - `status` (text) - Estado: 'draft', 'scheduled', 'sent', 'failed'
  - `created_by` (uuid) - ID del super admin que creó el anuncio
  - `scheduled_for` (timestamptz) - Fecha programada para envío (null = inmediato)
  - `sent_at` (timestamptz) - Fecha real de envío
  - `recipient_count` (int) - Número total de destinatarios
  - `attachment_urls` (jsonb) - URLs de archivos adjuntos (opcional)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `announcement_recipients`
  Tracking de entrega y lectura por gestor SST
  - `id` (uuid, PK)
  - `announcement_id` (uuid, FK) - Referencia al anuncio
  - `user_id` (uuid, FK) - ID del gestor SST destinatario
  - `company_id` (uuid, FK) - ID de la empresa del gestor
  - `email_sent` (boolean) - Si se envió el email
  - `email_sent_at` (timestamptz) - Cuándo se envió el email
  - `read_at` (timestamptz) - Cuándo leyó el anuncio (para futuro)
  - `created_at` (timestamptz)

  ## Cambios en Tablas Existentes
  - Actualizar restricción CHECK en `email_queue.email_type` para incluir 'admin_announcement'

  ## Seguridad
  - RLS habilitado en ambas tablas
  - Solo super_admin puede crear y ver anuncios
  - Gestores SST pueden ver anuncios dirigidos a ellos (para futuro)
*/

-- Crear tabla de anuncios
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count integer DEFAULT 0,
  attachment_urls jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT priority_check CHECK (priority IN ('info', 'warning', 'important')),
  CONSTRAINT status_check CHECK (status IN ('draft', 'scheduled', 'sent', 'failed'))
);

-- Crear tabla de destinatarios de anuncios
CREATE TABLE IF NOT EXISTS announcement_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email_sent boolean DEFAULT false,
  email_sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Habilitar RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;

-- Políticas para announcements
-- Super admin puede hacer todo
CREATE POLICY "Super admin can manage announcements"
  ON announcements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Políticas para announcement_recipients
-- Super admin puede ver todos los destinatarios
CREATE POLICY "Super admin can view all recipients"
  ON announcement_recipients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Gestores SST pueden ver sus propios anuncios (para futuro)
CREATE POLICY "SST managers can view their announcements"
  ON announcement_recipients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.id = announcement_recipients.user_id
      AND users.role = 'sst_manager'
    )
  );

-- Actualizar restricción de email_queue para incluir admin_announcement
-- Primero eliminar la restricción existente
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'email_queue_email_type_check' 
    AND table_name = 'email_queue'
  ) THEN
    ALTER TABLE email_queue DROP CONSTRAINT email_queue_email_type_check;
  END IF;
END $$;

-- Agregar la nueva restricción con el tipo adicional
ALTER TABLE email_queue ADD CONSTRAINT email_queue_email_type_check 
  CHECK (email_type = ANY (ARRAY[
    'new_report'::text, 
    'report_assigned'::text, 
    'evidence_uploaded'::text, 
    'evidence_rejected'::text, 
    'daily_reminder'::text, 
    'smtp_failure_alert'::text, 
    'pending_assignment_reminder'::text, 
    'deadline_reminder'::text,
    'admin_announcement'::text
  ]));

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_scheduled_for ON announcements(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_announcement_id ON announcement_recipients(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_user_id ON announcement_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_email_sent ON announcement_recipients(email_sent);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_announcements_updated_at_trigger ON announcements;
CREATE TRIGGER update_announcements_updated_at_trigger
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();

-- Comentarios en las tablas
COMMENT ON TABLE announcements IS 'Stores system-wide announcements from super admin to all SST managers';
COMMENT ON TABLE announcement_recipients IS 'Tracks delivery and read status of announcements for each SST manager';
COMMENT ON COLUMN announcements.attachment_urls IS 'JSON array of attachment URLs stored in Supabase storage';
COMMENT ON COLUMN announcements.scheduled_for IS 'When to send the announcement. NULL means send immediately';
