/*
  # Simplificar Guías a Máximo 3 Pasos

  1. Cambios
    - Eliminar todos los pasos detallados existentes
    - Recrear con máximo 3 pasos por opción
    - Hacer descripciones más concisas y visuales
    - Enfoque en íconos para cada paso

  2. Objetivo
    - Guías más simples y fáciles de seguir
    - Íconos como protagonistas
    - Pasos claros y directos
*/

-- Eliminar todos los pasos hijos (mantener opciones principales)
DELETE FROM guides WHERE parent_id IS NOT NULL;

-- ========================================
-- CREAR NUEVO REPORTE (WORKER & SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  -- Worker
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'worker' AND title = 'Crear Nuevo Reporte';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'worker', 'Toma Fotos', 'Camera', 'Captura imágenes del incidente o condición insegura', 1),
  (v_parent_id, 'worker', 'Clasifica', 'FolderOpen', 'Selecciona tipo y categoría del reporte', 2),
  (v_parent_id, 'worker', 'Describe y Envía', 'Send', 'Agrega descripción, solución propuesta y envía', 3);

  -- SST Manager
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Crear Nuevo Reporte';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Toma Fotos', 'Camera', 'Captura imágenes del incidente o condición insegura', 1),
  (v_parent_id, 'sst_manager', 'Clasifica', 'FolderOpen', 'Selecciona tipo y categoría del reporte', 2),
  (v_parent_id, 'sst_manager', 'Describe y Envía', 'Send', 'Agrega descripción, solución propuesta y envía', 3);
END $$;

-- ========================================
-- VER MIS REPORTES (WORKER)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'worker' AND title = 'Ver Mis Reportes';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'worker', 'Accede a Galería', 'Images', 'Ve a Galería desde el menú principal', 1),
  (v_parent_id, 'worker', 'Selecciona Reporte', 'Eye', 'Haz clic en cualquier reporte para ver detalles', 2),
  (v_parent_id, 'worker', 'Revisa Estado', 'Clock', 'Verifica estado y exporta si necesitas', 3);
END $$;

-- ========================================
-- ASIGNAR RESPONSABLE (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Asignar Responsable';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Abre Reporte', 'Eye', 'Selecciona un reporte pendiente en Galería', 1),
  (v_parent_id, 'sst_manager', 'Elige Usuario', 'UserCheck', 'Selecciona el responsable de tu equipo', 2),
  (v_parent_id, 'sst_manager', 'Guarda', 'Save', 'Confirma la asignación y notifica al responsable', 3);
END $$;

-- ========================================
-- GESTIONAR REPORTES (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Gestionar Reportes';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Filtra Reportes', 'Filter', 'Usa filtros por estado, categoría o área', 1),
  (v_parent_id, 'sst_manager', 'Actualiza Estado', 'Edit', 'Cambia el estado según el avance del caso', 2),
  (v_parent_id, 'sst_manager', 'Cierra con Evidencia', 'ImagePlus', 'Agrega fotos de evidencia al cerrar', 3);
END $$;

-- ========================================
-- AGREGAR USUARIO (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Agregar Usuario';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Nuevo Usuario', 'UserPlus', 'Ve a Usuarios y haz clic en "Nuevo Usuario"', 1),
  (v_parent_id, 'sst_manager', 'Datos Básicos', 'CreditCard', 'Ingresa DNI, nombre y apellidos', 2),
  (v_parent_id, 'sst_manager', 'Asigna Rol', 'Shield', 'Define rol y área/proyecto, luego guarda', 3);
END $$;

-- ========================================
-- CONFIGURAR CATEGORÍAS/ÁREAS/PROYECTOS (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Configurar Categorías/Áreas/Proyectos';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Elige Sección', 'Settings', 'Ve a Configuración y selecciona pestaña', 1),
  (v_parent_id, 'sst_manager', 'Crea Nuevo', 'Plus', 'Haz clic en "Agregar Nueva" e ingresa nombre', 2),
  (v_parent_id, 'sst_manager', 'Personaliza', 'Palette', 'Categorías: elige color. Luego guarda', 3);
END $$;

-- ========================================
-- VER MÉTRICAS (SST)
-- ========================================

DO $$
DECLARE
  v_parent_id uuid;
BEGIN
  SELECT id INTO v_parent_id FROM guides 
  WHERE role = 'sst_manager' AND title = 'Ver Métricas';

  INSERT INTO guides (parent_id, role, title, icon, description, order_index) VALUES
  (v_parent_id, 'sst_manager', 'Accede a Métricas', 'BarChart3', 'Ve a Métricas desde el menú principal', 1),
  (v_parent_id, 'sst_manager', 'Analiza Gráficos', 'PieChart', 'Revisa estadísticas por categoría, área y proyecto', 2),
  (v_parent_id, 'sst_manager', 'Exporta Datos', 'Download', 'Descarga reportes en Excel para análisis', 3);
END $$;
