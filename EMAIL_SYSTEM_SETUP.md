# Sistema de Notificaciones por Email - Configuración

Este documento describe la configuración del sistema de notificaciones por email para Reporta SST.

## Arquitectura del Sistema

El sistema de emails consta de 3 componentes principales:

1. **send-email** - Edge Function que envía emails individuales via SMTP
2. **process-email-queue** - Cron job que procesa la cola de emails cada hora
3. **send-daily-reminders** - Cron job que envía recordatorios diarios a las 8:00 AM (hora de Lima)

## Variables de Entorno Requeridas

Las siguientes variables de entorno deben estar configuradas en Supabase:

### SMTP Configuration (Hostinger)

```bash
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=tu-email@tudominio.com
SMTP_PASS=tu-contraseña-smtp
SMTP_FROM=noreply@tudominio.com  # (opcional, usa SMTP_USER por defecto)
```

### Cómo configurar las variables de entorno

1. Ir al Dashboard de Supabase: https://supabase.com/dashboard
2. Seleccionar el proyecto
3. Ir a **Project Settings** > **Edge Functions**
4. En la sección **Secrets**, agregar las variables:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`

## Configuración de Cron Jobs

Los cron jobs deben configurarse en el Dashboard de Supabase:

### 1. Procesador de Cola de Emails (cada hora)

```
Nombre: process-email-queue
Edge Function: process-email-queue
Cron Expression: 0 * * * *  (cada hora en punto)
HTTP Method: POST
```

### 2. Recordatorios Diarios (8:00 AM hora Lima)

```
Nombre: send-daily-reminders
Edge Function: send-daily-reminders
Cron Expression: 0 13 * * *  (8:00 AM Lima = 13:00 UTC)
HTTP Method: POST
```

**Nota:** Lima, Perú está en UTC-5 todo el año (no usa horario de verano).

## Tipos de Emails Automáticos

### 1. Nuevo Reporte Creado
- **Destinatarios:** Todos los Gestores SST de la empresa
- **Trigger:** Cuando se crea un nuevo reporte
- **Acción esperada:** Asignar el reporte a un responsable

### 2. Reporte Asignado
- **Destinatarios:** Usuario asignado (con permiso can_close_reports)
- **Trigger:** Cuando se asigna un reporte
- **Acción esperada:** Atender el reporte y subir evidencia de cierre

### 3. Evidencia Subida (Pendiente Revisión)
- **Destinatarios:** Todos los Gestores SST de la empresa
- **Trigger:** Cuando el responsable sube evidencia de cierre
- **Acción esperada:** Revisar y aprobar/rechazar la evidencia

### 4. Evidencia Rechazada
- **Destinatarios:** Usuario asignado al reporte
- **Trigger:** Cuando el Gestor SST rechaza la evidencia
- **Acción esperada:** Corregir y volver a subir evidencia

### 5. Recordatorio Diario
- **Destinatarios:** Todos los Gestores SST de empresas activas
- **Trigger:** Todos los días a las 8:00 AM (hora Lima)
- **Contenido:** Resumen de reportes pendientes (sin asignar, asignados, en revisión, rechazados)

### 6. Alertas al Super Admin
- **Destinatarios:** Super Admins
- **Triggers:**
  - Límite de emails por hora alcanzado (200/hora)
  - Tasa de fallos SMTP > 50%
  - Cola de emails pendientes > 500

## Seguridad y Aislamiento Multi-Empresa

- **TODAS** las consultas están filtradas por `company_id`
- Los emails SIEMPRE incluyen el nombre de la empresa en el asunto: `[Nombre Empresa] ...`
- Un Gestor SST que trabaja en múltiples empresas recibe emails separados por empresa
- Las tablas `email_queue`, `email_history` y `email_delivery_status` tienen RLS habilitado
- Solo Super Admins pueden acceder a estas tablas (Edge Functions bypasan RLS automáticamente)

## Manejo de Bounces y Emails Inválidos

El sistema automáticamente:
- Rastrea bounces en la tabla `email_delivery_status`
- Después de 3 bounces, marca el email como `hard_bounce`
- No intenta enviar a emails marcados como `hard_bounce` o `invalid`
- Cancela automáticamente emails en cola para direcciones bloqueadas

## Rate Limiting y Protección Anti-Spam

- **Máximo 200 emails por hora** (todas las empresas combinadas)
- **Máximo 100 emails por ejecución** del procesador de cola
- Si se excede el límite, el sistema pausa envíos y reintenta en la siguiente hora
- El Super Admin recibe alerta cuando se alcanza el límite

## Retry Logic

- Emails fallidos se reintentan automáticamente hasta 3 veces
- Después de 3 intentos fallidos, el email se marca como `failed`
- El sistema espera 100ms entre cada envío para evitar sobrecargar el servidor SMTP

## Formato de Fechas

Todas las fechas en los emails se muestran en:
- **Zona horaria:** America/Lima (UTC-5)
- **Formato corto:** DD/MM/YY (Ejemplo: 25/01/25)
- **Formato con hora:** DD/MM/YY HH:MM (Ejemplo: 25/01/25 14:30)

## Base de Datos

### Tablas Creadas

1. **email_queue** - Cola de emails pendientes
2. **email_history** - Auditoría de emails enviados
3. **email_delivery_status** - Estado de validación de emails

### Funciones Útiles

- `format_datetime_peru(timestamp)` - Formatea fecha/hora en zona horaria Lima
- `format_date_peru(timestamp)` - Formatea solo fecha en zona horaria Lima
- `get_sst_managers_for_company(company_id)` - Obtiene todos los Gestores SST activos de una empresa
- `enqueue_email(...)` - Encola un email para envío

## Testing

### Probar envío manual de email

```bash
# 1. Crear un email en la cola manualmente
INSERT INTO email_queue (
  company_id,
  recipient_user_id,
  recipient_email,
  email_type,
  subject,
  html_body
) VALUES (
  'tu-company-id',
  'tu-user-id',
  'tu-email@ejemplo.com',
  'daily_reminder',
  'Test Email',
  '<html><body><h1>Test</h1></body></html>'
);

# 2. Ejecutar el procesador de cola manualmente
curl -X POST \
  https://yrkjelaleitrfinopdzy.supabase.co/functions/v1/process-email-queue \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Monitoreo

Para monitorear el sistema de emails:

```sql
-- Ver emails pendientes
SELECT COUNT(*) FROM email_queue WHERE status = 'pending';

-- Ver emails enviados hoy
SELECT COUNT(*)
FROM email_history
WHERE sent_at >= CURRENT_DATE;

-- Ver tasa de fallos en las últimas 24 horas
SELECT
  delivery_status,
  COUNT(*)
FROM email_history
WHERE sent_at >= NOW() - INTERVAL '24 hours'
GROUP BY delivery_status;

-- Ver emails bloqueados por bounces
SELECT *
FROM email_delivery_status
WHERE status IN ('hard_bounce', 'invalid');
```

## Troubleshooting

### Los emails no se están enviando

1. Verificar que las variables de entorno SMTP estén configuradas
2. Verificar que los cron jobs estén activos
3. Revisar logs de las Edge Functions en Supabase Dashboard
4. Verificar que no se haya alcanzado el límite de 200 emails/hora

### Emails marcados como spam

1. Verificar que el dominio tenga configurado SPF, DKIM y DMARC
2. Contactar a Hostinger para verificar reputación del servidor SMTP
3. Considerar usar un servicio especializado como SendGrid o AWS SES

### Alta tasa de bounces

1. Revisar tabla `email_delivery_status` para identificar emails problemáticos
2. Verificar que los emails de los usuarios sean válidos
3. El Super Admin recibirá alertas automáticas si la tasa de fallos > 50%

## Enlaces Útiles

- Dashboard Supabase: https://supabase.com/dashboard
- Hostinger Email: https://www.hostinger.com/cpanel-login
- Documentación Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Documentación Nodemailer: https://nodemailer.com/about/
