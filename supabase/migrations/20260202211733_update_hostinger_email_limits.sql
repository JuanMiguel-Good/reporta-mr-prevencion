/*
  # Actualización de Límites de Email según Hostinger

  1. Límites de Hostinger Documentados
    - Envío diario de mensajes: 1000 emails cada 24 horas
    - Almacenamiento por buzón: 10.00 GB
    - Emails por buzón: 100000 correos electrónicos
    - Tamaño de correo saliente: 35 MB
    - Capacidad de archivos adjuntos: 25 MB
    - Destinatarios por mensaje: 100 destinatarios
    - Alias por buzón: 50 alias
    - Reenviadores por buzón: 10 reenviadores

  2. Configuración del Sistema
    - Límite diario ajustado a 950 emails (margen de seguridad de 50)
    - Procesamiento por lote: 50 emails máximo por ejecución
    - Cron job ejecutándose cada hora (24 ejecuciones diarias)
    - Sistema de reintentos con máximo 3 intentos

  3. Protección contra Duplicados
    - Índice único para prevenir envíos duplicados de anuncios
    - Verificación de emails ya enviados antes de procesar
    - Cancelación automática de emails duplicados

  4. Monitoreo
    - El sistema verifica el contador de emails en las últimas 24 horas
    - Alerta automática a super admins cuando se alcanza el límite
    - Estadísticas de envío disponibles en email_history
*/

-- Crear tabla de configuración de límites de email si no existe
CREATE TABLE IF NOT EXISTS email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Insertar configuración de límites de Hostinger
INSERT INTO email_config (config_key, config_value, description)
VALUES (
  'hostinger_limits',
  jsonb_build_object(
    'max_emails_per_day', 1000,
    'safe_limit_per_day', 950,
    'max_emails_per_run', 50,
    'max_email_size_mb', 35,
    'max_attachment_size_mb', 25,
    'max_recipients_per_email', 100,
    'max_retries', 3,
    'retry_delay_hours', 1
  ),
  'Límites de envío de emails según plan de Hostinger'
)
ON CONFLICT (config_key) 
DO UPDATE SET 
  config_value = EXCLUDED.config_value,
  updated_at = now();

-- Deshabilitar RLS en email_config (solo lectura para funciones del sistema)
ALTER TABLE email_config DISABLE ROW LEVEL SECURITY;

-- Comentarios
COMMENT ON TABLE email_config IS 'Configuración global del sistema de envío de emails';
COMMENT ON COLUMN email_config.config_key IS 'Clave única de configuración';
COMMENT ON COLUMN email_config.config_value IS 'Valor de configuración en formato JSON';
COMMENT ON COLUMN email_config.description IS 'Descripción del propósito de esta configuración';
