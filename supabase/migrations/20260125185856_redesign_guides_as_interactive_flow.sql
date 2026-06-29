/*
  # Rediseñar Guías como Flujo Interactivo

  1. Cambios
    - Reestructurar tabla guides para flujo jerárquico
    - Agregar parent_id para opciones principales y sub-pasos
    - Cambiar steps array a description text para simplicidad
    - Agregar campo question para texto de pregunta

  2. Estructura
    - Nivel 0: Pregunta principal "¿Qué deseas hacer?"
    - Nivel 1: Opciones con íconos (parent_id = null)
    - Nivel 2: Pasos detallados (parent_id = id de opción)
*/

-- Eliminar tabla existente y recrear con nueva estructura
DROP TABLE IF EXISTS guides CASCADE;

CREATE TABLE guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES guides(id) ON DELETE CASCADE,
  role text NOT NULL,
  title text NOT NULL,
  icon text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read guides"
  ON guides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage guides"
  ON guides FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Índices
CREATE INDEX idx_guides_parent_id ON guides(parent_id);
CREATE INDEX idx_guides_role ON guides(role);
CREATE INDEX idx_guides_order ON guides(order_index);

-- ========================================
-- OPCIONES PRINCIPALES PARA WORKER
-- ========================================

INSERT INTO guides (role, title, icon, description, order_index) VALUES
('worker', 'Crear Nuevo Reporte', 'Camera', 'Reporta actos o condiciones inseguras con fotos y descripción', 10);

INSERT INTO guides (role, title, icon, description, order_index) VALUES
('worker', 'Ver Mis Reportes', 'Gallery', 'Revisa el estado de tus reportes enviados', 20);

-- ========================================
-- OPCIONES PRINCIPALES PARA SST MANAGER
-- ========================================

INSERT INTO guides (role, title, icon, description, order_index) VALUES
('sst_manager', 'Crear Nuevo Reporte', 'Camera', 'Reporta actos o condiciones inseguras con fotos y descripción', 10);

INSERT INTO guides (role, title, icon, description, order_index) VALUES
('sst_manager', 'Asignar Responsable', 'UserCheck', 'Asigna un responsable a reportes pendientes', 20);

INSERT INTO guides (role, title, icon, description, order_index) VALUES
('sst_manager', 'Gestionar Reportes', 'ClipboardCheck', 'Revisa, aprueba o rechaza reportes recibidos', 30);

INSERT INTO guides (role, title, icon, description, order_index) VALUES
('sst_manager', 'Agregar Usuario', 'UserPlus', 'Crea nuevos usuarios para tu empresa', 40);

INSERT INTO guides (role, title, icon, description, order_index) VALUES
('sst_manager', 'Configurar Categorías/Áreas/Proyectos', 'Settings', 'Personaliza las opciones de clasificación', 50);

INSERT INTO guides (role, title, icon, description, order_index) VALUES
('sst_manager', 'Ver Métricas', 'BarChart3', 'Visualiza estadísticas y reportes analíticos', 60);

-- ========================================
-- PASOS DETALLADOS - CREAR NUEVO REPORTE (WORKER)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'worker' AND title = 'Crear Nuevo Reporte';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'worker', 'Paso 1', 'Camera', 'Presiona el botón de cámara en la pantalla principal', 1),
  (v_parent_id, 'worker', 'Paso 2', 'Image', 'Toma fotos del incidente o condición insegura', 2),
  (v_parent_id, 'worker', 'Paso 3', 'AlertTriangle', 'Selecciona tipo: Acto Inseguro o Condición Insegura', 3),
  (v_parent_id, 'worker', 'Paso 4', 'FolderOpen', 'Elige la categoría correspondiente', 4),
  (v_parent_id, 'worker', 'Paso 5', 'FileText', 'Describe lo observado y propón una solución', 5),
  (v_parent_id, 'worker', 'Paso 6', 'MapPin', 'Opcional: agrega área, proyecto y ubicación GPS', 6),
  (v_parent_id, 'worker', 'Paso 7', 'Send', 'Envía el reporte para que sea revisado', 7);
END $$;

-- ========================================
-- PASOS DETALLADOS - VER MIS REPORTES (WORKER)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'worker' AND title = 'Ver Mis Reportes';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'worker', 'Paso 1', 'Gallery', 'Ve a Galería desde el menú principal', 1),
  (v_parent_id, 'worker', 'Paso 2', 'List', 'Visualiza todos tus reportes enviados', 2),
  (v_parent_id, 'worker', 'Paso 3', 'Eye', 'Haz clic en cualquier reporte para ver detalles', 3),
  (v_parent_id, 'worker', 'Paso 4', 'Clock', 'Revisa el estado: Pendiente, En Proceso o Cerrado', 4),
  (v_parent_id, 'worker', 'Paso 5', 'Download', 'Puedes exportar reportes a Excel desde aquí', 5);
END $$;

-- ========================================
-- PASOS DETALLADOS - CREAR NUEVO REPORTE (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Crear Nuevo Reporte';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Paso 1', 'Camera', 'Presiona el botón de cámara en la pantalla principal', 1),
  (v_parent_id, 'sst_manager', 'Paso 2', 'Image', 'Toma fotos del incidente o condición insegura', 2),
  (v_parent_id, 'sst_manager', 'Paso 3', 'AlertTriangle', 'Selecciona tipo: Acto Inseguro o Condición Insegura', 3),
  (v_parent_id, 'sst_manager', 'Paso 4', 'FolderOpen', 'Elige la categoría correspondiente', 4),
  (v_parent_id, 'sst_manager', 'Paso 5', 'FileText', 'Describe lo observado y propón una solución', 5),
  (v_parent_id, 'sst_manager', 'Paso 6', 'MapPin', 'Opcional: agrega área, proyecto y ubicación GPS', 6),
  (v_parent_id, 'sst_manager', 'Paso 7', 'Send', 'Envía el reporte o asígnalo directamente', 7);
END $$;

-- ========================================
-- PASOS DETALLADOS - ASIGNAR RESPONSABLE (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Asignar Responsable';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Paso 1', 'Gallery', 'Ve a Galería y selecciona un reporte pendiente', 1),
  (v_parent_id, 'sst_manager', 'Paso 2', 'Eye', 'Haz clic en el reporte para ver sus detalles', 2),
  (v_parent_id, 'sst_manager', 'Paso 3', 'UserCheck', 'Busca la sección "Asignar Responsable"', 3),
  (v_parent_id, 'sst_manager', 'Paso 4', 'Users', 'Selecciona un usuario de tu empresa', 4),
  (v_parent_id, 'sst_manager', 'Paso 5', 'Save', 'Guarda la asignación', 5),
  (v_parent_id, 'sst_manager', 'Paso 6', 'Bell', 'El responsable recibirá una notificación', 6);
END $$;

-- ========================================
-- PASOS DETALLADOS - GESTIONAR REPORTES (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Gestionar Reportes';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Paso 1', 'Gallery', 'Ve a Galería para ver todos los reportes', 1),
  (v_parent_id, 'sst_manager', 'Paso 2', 'Filter', 'Filtra por estado, categoría, área o proyecto', 2),
  (v_parent_id, 'sst_manager', 'Paso 3', 'Eye', 'Haz clic en un reporte para revisar detalles', 3),
  (v_parent_id, 'sst_manager', 'Paso 4', 'Edit', 'Cambia el estado del reporte según avance', 4),
  (v_parent_id, 'sst_manager', 'Paso 5', 'ImagePlus', 'Agrega evidencias de cierre cuando se resuelva', 5),
  (v_parent_id, 'sst_manager', 'Paso 6', 'Download', 'Exporta reportes a Excel para análisis', 6);
END $$;

-- ========================================
-- PASOS DETALLADOS - AGREGAR USUARIO (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Agregar Usuario';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Paso 1', 'Users', 'Ve a Usuarios desde el menú', 1),
  (v_parent_id, 'sst_manager', 'Paso 2', 'UserPlus', 'Haz clic en "Nuevo Usuario"', 2),
  (v_parent_id, 'sst_manager', 'Paso 3', 'CreditCard', 'Ingresa el DNI del trabajador', 3),
  (v_parent_id, 'sst_manager', 'Paso 4', 'User', 'Completa nombre, apellidos y datos personales', 4),
  (v_parent_id, 'sst_manager', 'Paso 5', 'Shield', 'Selecciona el rol: Trabajador o Gestor SST', 5),
  (v_parent_id, 'sst_manager', 'Paso 6', 'Building', 'Opcional: asigna área y proyecto', 6),
  (v_parent_id, 'sst_manager', 'Paso 7', 'Save', 'Guarda el nuevo usuario', 7);
END $$;

-- ========================================
-- PASOS DETALLADOS - CONFIGURAR (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Configurar Categorías/Áreas/Proyectos';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Paso 1', 'Settings', 'Ve a Configuración desde el menú', 1),
  (v_parent_id, 'sst_manager', 'Paso 2', 'FolderOpen', 'Elige la pestaña: Categorías, Áreas o Proyectos', 2),
  (v_parent_id, 'sst_manager', 'Paso 3', 'Plus', 'Haz clic en "Agregar Nueva"', 3),
  (v_parent_id, 'sst_manager', 'Paso 4', 'Type', 'Ingresa el nombre descriptivo', 4),
  (v_parent_id, 'sst_manager', 'Paso 5', 'Palette', 'Para categorías: selecciona un color identificador', 5),
  (v_parent_id, 'sst_manager', 'Paso 6', 'Save', 'Guarda los cambios', 6),
  (v_parent_id, 'sst_manager', 'Paso 7', 'Edit', 'Edita o elimina elementos según necesidad', 7);
END $$;

-- ========================================
-- PASOS DETALLADOS - VER MÉTRICAS (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Ver Métricas';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Paso 1', 'BarChart3', 'Ve a Métricas desde el menú principal', 1),
  (v_parent_id, 'sst_manager', 'Paso 2', 'PieChart', 'Visualiza gráficos de reportes por categoría', 2),
  (v_parent_id, 'sst_manager', 'Paso 3', 'TrendingUp', 'Revisa estadísticas por área y proyecto', 3),
  (v_parent_id, 'sst_manager', 'Paso 4', 'Clock', 'Analiza tiempos de respuesta y cierre', 4),
  (v_parent_id, 'sst_manager', 'Paso 5', 'Calendar', 'Filtra por rango de fechas', 5),
  (v_parent_id, 'sst_manager', 'Paso 6', 'Download', 'Exporta datos para reportes ejecutivos', 6);
END $$;
