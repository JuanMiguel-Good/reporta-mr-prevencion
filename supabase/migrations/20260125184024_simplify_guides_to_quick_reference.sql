/*
  # Simplificar Sistema de Guías a Guía Rápida

  1. Cambios en Tablas
    - Eliminar `user_guide_progress` (sin seguimiento de progreso)
    - Eliminar `guide_steps` (los pasos ahora serán un array simple)
    - Eliminar `guide_categories` (sin categorías complejas)
    - Simplificar `guides` para ser tarjetas minimalistas con:
      - title: título de la guía
      - role: rol al que aplica (worker, sst_manager, super_admin)
      - icon: nombre del ícono de lucide-react
      - steps: array de texto con pasos cortos
      - order_index: orden de visualización

  2. Datos Iniciales
    - Guías básicas por rol con 3-4 pasos máximo
    - Texto ultra conciso (máximo 10-15 palabras por paso)
*/

-- Eliminar tablas complejas
DROP TABLE IF EXISTS user_guide_progress CASCADE;
DROP TABLE IF EXISTS guide_steps CASCADE;
DROP TABLE IF EXISTS guide_categories CASCADE;

-- Recrear tabla guides simplificada
DROP TABLE IF EXISTS guides CASCADE;

CREATE TABLE guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  role text NOT NULL CHECK (role IN ('worker', 'sst_manager', 'super_admin', 'all')),
  icon text NOT NULL DEFAULT 'HelpCircle',
  steps text[] NOT NULL DEFAULT '{}',
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- Policy: todos los usuarios autenticados pueden ver las guías de su rol o "all"
CREATE POLICY "Users can view guides for their role"
  ON guides FOR SELECT
  TO authenticated
  USING (
    role = 'all' OR 
    role = (
      SELECT u.role 
      FROM users u 
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Solo super admin puede modificar guías
CREATE POLICY "Super admin can manage guides"
  ON guides FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.auth_user_id = auth.uid() 
      AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.auth_user_id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- Insertar guías básicas
INSERT INTO guides (title, role, icon, steps, order_index) VALUES
-- Guías para Trabajadores
(
  'Reportar un Incidente',
  'worker',
  'Camera',
  ARRAY[
    'Toca el botón de cámara en la pantalla principal',
    'Captura una foto del incidente o área',
    'Completa los campos: categoría, descripción y ubicación',
    'Envía el reporte para revisión'
  ],
  1
),
(
  'Ver Mis Reportes',
  'worker',
  'FileText',
  ARRAY[
    'Abre la Galería desde el menú inferior',
    'Tus reportes se muestran en orden de más reciente',
    'Toca un reporte para ver su detalle y estado',
    'Los reportes pendientes aparecen con marca de alerta'
  ],
  2
),

-- Guías para Gestores SST
(
  'Revisar Reportes',
  'sst_manager',
  'ClipboardCheck',
  ARRAY[
    'Ve a Galería y filtra por estado "En Revisión"',
    'Toca el reporte para ver detalles completos',
    'Asigna un responsable usando el selector',
    'Cambia el estado según corresponda'
  ],
  3
),
(
  'Asignar Responsables',
  'sst_manager',
  'UserCheck',
  ARRAY[
    'Abre el reporte que quieres asignar',
    'Selecciona un usuario del campo "Asignado a"',
    'El usuario recibirá una notificación automática',
    'Monitorea el progreso desde Métricas'
  ],
  4
),
(
  'Configurar Categorías',
  'sst_manager',
  'Settings',
  ARRAY[
    'Ve a Configuración desde el menú',
    'En Categorías, crea o edita las existentes',
    'Define nombre y color para cada categoría',
    'Los trabajadores las verán al reportar'
  ],
  5
),

-- Guías para Super Admin
(
  'Gestionar Usuarios',
  'super_admin',
  'Users',
  ARRAY[
    'Accede a Usuarios desde el menú',
    'Crea usuarios con DNI (email opcional)',
    'Asigna roles: Trabajador o Gestor SST',
    'Edita o desactiva usuarios según necesidad'
  ],
  6
),
(
  'Gestionar Empresas',
  'super_admin',
  'Building2',
  ARRAY[
    'Ve a Empresas desde el menú',
    'Crea nuevas empresas con RUT y datos',
    'Asigna planes (Básico, Profesional, Empresarial)',
    'Administra límites de uso de IA por empresa'
  ],
  7
),
(
  'Ver Métricas Globales',
  'super_admin',
  'BarChart3',
  ARRAY[
    'Abre Métricas desde el menú',
    'Filtra por empresa y rango de fechas',
    'Revisa gráficos de reportes por estado',
    'Exporta datos a Excel si necesitas'
  ],
  8
);
