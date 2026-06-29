# Configuración SMTP de Hostinger - Pasos Exactos

## 🔑 Tus Credenciales SMTP

```
SMTP_HOST: smtp.hostinger.com
SMTP_PORT: 465
SMTP_USER: noreply@goodsolutions.app
SMTP_PASS: ]Na2;[FK9p
SMTP_FROM: noreply@goodsolutions.app
```

## 📋 Pasos para Configurar en Supabase

### 1. Acceder al Dashboard de Supabase

1. Ve a: https://supabase.com/dashboard
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto: **yrkjelaleitrfinopdzy**

### 2. Configurar los Secrets (Variables de Entorno)

1. En el menú lateral, ve a: **⚙️ Project Settings**
2. En el menú de configuración, selecciona: **Edge Functions**
3. Busca la sección: **Secrets**
4. Haz clic en: **Add new secret**

### 3. Agregar cada Secret (uno por uno)

Agrega estos 5 secretos exactamente como se muestra:

#### Secret 1: SMTP_HOST
- **Name:** `SMTP_HOST`
- **Value:** `smtp.hostinger.com`
- Click **Add secret**

#### Secret 2: SMTP_PORT
- **Name:** `SMTP_PORT`
- **Value:** `465`
- Click **Add secret**

#### Secret 3: SMTP_USER
- **Name:** `SMTP_USER`
- **Value:** `noreply@goodsolutions.app`
- Click **Add secret**

#### Secret 4: SMTP_PASS
- **Name:** `SMTP_PASS`
- **Value:** `]Na2;[FK9p`
- Click **Add secret**

#### Secret 5: SMTP_FROM
- **Name:** `SMTP_FROM`
- **Value:** `noreply@goodsolutions.app`
- Click **Add secret**

### 4. Verificar que los Secrets están configurados

Después de agregar todos los secrets, deberías ver una lista con:
- ✅ SMTP_HOST
- ✅ SMTP_PORT
- ✅ SMTP_USER
- ✅ SMTP_PASS
- ✅ SMTP_FROM

## ⏰ Configurar los Cron Jobs

Ahora necesitas configurar los trabajos programados para que los emails se envíen automáticamente:

### 1. Procesador de Cola de Emails (Cada Hora)

1. En el menú lateral, ve a: **Database** > **Cron Jobs**
2. Haz clic en: **Create a new cron job**
3. Configura así:
   - **Name:** `process-email-queue`
   - **Schedule:** `0 * * * *` (cada hora en punto)
   - **Command:** Selecciona "Invoke Edge Function"
   - **Edge Function:** `process-email-queue`
   - **HTTP Method:** `POST`
4. Click **Create**

### 2. Recordatorios Diarios (8:00 AM Hora Perú)

1. Haz clic en: **Create a new cron job**
2. Configura así:
   - **Name:** `send-daily-reminders`
   - **Schedule:** `0 13 * * *` (8:00 AM Perú = 13:00 UTC)
   - **Command:** Selecciona "Invoke Edge Function"
   - **Edge Function:** `send-daily-reminders`
   - **HTTP Method:** `POST`
3. Click **Create**

## 🧪 Probar que Funciona

### Opción 1: Ejecutar Manualmente el Procesador

1. Ve a: **Edge Functions** en el menú lateral
2. Busca la función: **process-email-queue**
3. Haz clic en: **Invoke**
4. Revisa los logs para ver si procesó correctamente

### Opción 2: Crear un Email de Prueba

1. Ve al **SQL Editor** en Supabase
2. Ejecuta este SQL (reemplaza con tus datos reales):

```sql
-- Reemplaza estos valores con datos reales de tu sistema
INSERT INTO email_queue (
  company_id,
  recipient_user_id,
  recipient_email,
  email_type,
  subject,
  html_body
) VALUES (
  'tu-company-id-aqui',  -- Obtén esto de la tabla companies
  'tu-user-id-aqui',     -- Obtén esto de la tabla users
  'tu-email-personal@gmail.com',  -- Tu email personal para probar
  'test',
  'Email de Prueba - Sistema Reporta SST',
  '<html><body style="font-family: Arial, sans-serif; padding: 20px;"><h1>✅ Email de Prueba</h1><p>Si recibes este email, el sistema SMTP está configurado correctamente.</p><p>Remitente: noreply@goodsolutions.app</p></body></html>'
);
```

3. Espera hasta la próxima hora en punto (cuando corra el cron job)
4. O ejecuta manualmente la función `process-email-queue` desde el Dashboard
5. Revisa tu email personal para confirmar que llegó

## ✅ Confirmación Final

Después de configurar todo, el sistema debería:

1. ✉️ Enviar emails automáticamente cuando:
   - Se crea un nuevo reporte → Notifica a Gestores SST
   - Se asigna un reporte → Notifica al responsable
   - Se sube evidencia → Notifica a Gestores SST
   - Se rechaza evidencia → Notifica al responsable

2. 📬 Enviar recordatorio diario a las 8:00 AM (hora Perú) con resumen de reportes pendientes

3. 🔄 Procesar la cola de emails cada hora automáticamente

## 🆘 Si Algo No Funciona

1. **Verificar logs de Edge Functions:**
   - Ve a: Edge Functions > Selecciona la función > Logs
   - Busca errores relacionados con SMTP

2. **Verificar que los secrets estén bien escritos:**
   - Ve a: Project Settings > Edge Functions > Secrets
   - Verifica que no haya espacios extra o errores de tipeo

3. **Probar conexión SMTP desde Hostinger:**
   - Inicia sesión en tu panel de Hostinger
   - Verifica que la cuenta noreply@goodsolutions.app esté activa
   - Confirma que la contraseña sea correcta

4. **Revisar límites:**
   - El sistema tiene un límite de 200 emails por hora
   - Si se excede, el sistema pausa y reintenta en la siguiente hora

## 📊 Monitoreo

Para ver el estado del sistema de emails, ejecuta en el SQL Editor:

```sql
-- Ver emails pendientes
SELECT COUNT(*) as pendientes FROM email_queue WHERE status = 'pending';

-- Ver emails enviados hoy
SELECT COUNT(*) as enviados_hoy
FROM email_history
WHERE sent_at::date = CURRENT_DATE;

-- Ver últimos emails enviados
SELECT
  recipient_email,
  subject,
  delivery_status,
  sent_at
FROM email_history
ORDER BY sent_at DESC
LIMIT 10;
```

---

**¡IMPORTANTE!** Una vez configurados los secrets en Supabase, NO necesitas hacer nada más en el código. El sistema ya está completamente implementado y funcionará automáticamente.
