# Corrección de Emails Duplicados

## Problema Identificado

Los usuarios estaban recibiendo notificaciones y anuncios duplicados múltiples veces:
- El mismo anuncio se enviaba 3+ veces a las 5:00 PM y 5:01 PM
- Las notificaciones de reportes se duplicaban
- Esto creaba una experiencia negativa (spam) y desperdiciaba el límite de envío

## Causas Raíz

1. **No había verificación de duplicados**: El sistema no verificaba si un email ya había sido enviado antes de encolarlo nuevamente
2. **El cron job reencolaba emails**: Cada hora, el sistema intentaba enviar emails sin verificar el historial
3. **Faltaba índice único**: No existía protección a nivel de base de datos contra duplicados

## Soluciones Implementadas

### 1. Límites de Hostinger Actualizados

**Archivo**: `20260202211733_update_hostinger_email_limits.sql`

- Ajustado el límite diario de **800 emails/hora** (19,200/día) a **950 emails/día**
- Cambiada la ventana de verificación de "por hora" a "por 24 horas"
- Reducido el procesamiento por lote de 100 a 50 emails
- Creada tabla `email_config` con todos los límites documentados:
  - max_emails_per_day: 1000
  - safe_limit_per_day: 950 (margen de seguridad)
  - max_emails_per_run: 50
  - max_email_size_mb: 35
  - max_attachment_size_mb: 25
  - max_recipients_per_email: 100

### 2. Prevención de Duplicados en Base de Datos

**Archivo**: `prevent_duplicate_email_notifications.sql`

- **Columna deduplication_key**: Clave generada automáticamente basada en:
  - recipient_email
  - email_type
  - announcement_id (si aplica)
  - report_id (si aplica)

- **Índice único parcial**: Previene que se encolen emails duplicados en estado 'pending'
  ```sql
  CREATE UNIQUE INDEX idx_email_queue_unique_pending
  ON email_queue (deduplication_key)
  WHERE status = 'pending';
  ```

- **Función email_already_sent()**: Verifica si un email específico ya fue enviado en los últimos 30 días

### 3. Verificación en send-announcement

**Archivo**: `supabase/functions/send-announcement/index.ts`

Antes de encolar emails de anuncios:
1. Consulta `email_history` para obtener emails ya enviados de ese anuncio
2. Crea un Set con los emails ya enviados
3. Omite usuarios que ya recibieron el anuncio
4. Solo encola emails para usuarios nuevos

```typescript
const { data: alreadySent } = await supabase
  .from("email_history")
  .select("recipient_email")
  .eq("email_type", "admin_announcement")
  .contains("data", { announcement_id: announcement.id });

const alreadySentEmails = new Set(
  (alreadySent || []).map((record: any) => record.recipient_email)
);

// Omite emails ya enviados
if (alreadySentEmails.has(manager.email)) {
  console.log(`Skipping ${manager.email} - announcement already sent`);
  continue;
}
```

### 4. Actualización de enqueue_email

**Archivo**: `fix_enqueue_email_check_history.sql`

La función `enqueue_email()` ahora:
1. Verifica `email_delivery_status` (rebotes/emails inválidos)
2. **Verifica `email_history`** para detectar si el email ya fue enviado
3. Si ya fue enviado en los últimos 30 días, NO lo encola
4. Maneja `unique_violation` silenciosamente si el email ya está en cola

```sql
-- Check if this exact email was already sent in the last 30 days
SELECT EXISTS (
  SELECT 1
  FROM email_history
  WHERE recipient_email = p_recipient_email
    AND email_type = p_email_type
    AND [verificación de announcement_id o report_id]
    AND sent_at >= NOW() - INTERVAL '30 days'
) INTO v_already_sent;

-- If already sent, skip
IF v_already_sent THEN
  RAISE NOTICE 'Email already sent, skipping';
  RETURN NULL;
END IF;
```

## Resultados Esperados

### Prevención Inmediata
- Los emails duplicados NO se pueden encolar gracias al índice único
- La función `enqueue_email()` verifica el historial antes de encolar
- Los anuncios verifican el historial antes de crear registros en email_queue

### Protección a Largo Plazo
- Límite diario de 950 emails respeta el plan de Hostinger (1000/día)
- Margen de 50 emails para emergencias o picos
- Verificación de 30 días previene reenvíos accidentales
- Sistema escalable y mantenible

## Estado Actual del Sistema

### Emails Hoy (2 de febrero)
- Total enviados en 24 horas: 318 emails
- Disponibles para hoy: 632 emails
- Sistema funcionando dentro de límites

### Cola de Emails
- Todos los emails en cola tienen status 'sent'
- No hay emails 'pending' duplicados
- Sistema limpio y operativo

## Monitoreo y Mantenimiento

### Verificar Límites Diarios
```sql
SELECT
  COUNT(*) as total_enviados_24h,
  950 - COUNT(*) as disponibles_hoy
FROM email_history
WHERE sent_at >= NOW() - INTERVAL '24 hours';
```

### Verificar Duplicados
```sql
SELECT
  recipient_email,
  email_type,
  data->>'announcement_id' as announcement_id,
  data->>'report_id' as report_id,
  COUNT(*) as veces_enviado
FROM email_history
WHERE sent_at >= CURRENT_DATE
GROUP BY recipient_email, email_type, data->>'announcement_id', data->>'report_id'
HAVING COUNT(*) > 1;
```

### Ver Estado de la Cola
```sql
SELECT
  status,
  email_type,
  COUNT(*) as count
FROM email_queue
GROUP BY status, email_type
ORDER BY status, email_type;
```

## Notas Importantes

1. **Los duplicados históricos permanecen**: Los emails enviados ANTES de esta corrección están en `email_history`. Las nuevas protecciones solo aplican hacia adelante.

2. **Reintentos permitidos**: Los emails que FALLAN pueden reintentarse. El índice único solo aplica a emails 'pending', no a 'failed'.

3. **Ventana de 30 días**: La verificación de duplicados considera los últimos 30 días. Después de ese período, el sistema permitiría reenviar (si fuera necesario).

4. **Cron job cada hora**: El sistema procesa la cola cada hora, pero ahora con las verificaciones de duplicados implementadas.

5. **Edge function actualizada**: `send-announcement` fue deployada con las correcciones.
