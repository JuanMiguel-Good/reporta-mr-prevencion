/*
  # Reorganizar Guías según Orden de Navegación

  1. Cambios
    - Eliminar todas las guías existentes
    - Crear guías organizadas según el menú de navegación
    - Orden: Cámara → Galería → Usuarios → Configuración → Métricas
    - Agregar guía de crear reportes para sst_manager también

  2. Estructura
    - Cada guía corresponde a un ícono del menú
    - order_index refleja la posición en el menú
    - Guías específicas por rol donde corresponda
*/

-- Limpiar guías existentes
DELETE FROM guides;

-- ========================================
-- 1. CÁMARA (Camera) - order_index 10-19
-- ========================================

-- Crear Nuevo Reporte (Worker)
INSERT INTO guides (title, role, icon, steps, order_index) VALUES
(
  'Crear Nuevo Reporte',
  'worker',
  'Camera',
  ARRAY[
    'Presiona el botón de cámara en la pantalla principal',
    'Toma fotos del incidente o condición insegura',
    'Selecciona tipo: Acto Inseguro o Condición Insegura',
    'Elige la categoría correspondiente',
    'Describe lo observado y propón una solución',
    'Opcional: agrega área, proyecto y ubicación GPS',
    'Envía el reporte para que sea revisado'
  ],
  10
);

-- Crear Nuevo Reporte (SST Manager)
INSERT INTO guides (title, role, icon, steps, order_index) VALUES
(
  'Crear Nuevo Reporte',
  'sst_manager',
  'Camera',
  ARRAY[
    'Presiona el botón de cámara en la pantalla principal',
    'Toma fotos del incidente o condición insegura',
    'Selecciona tipo: Acto Inseguro o Condición Insegura',
    'Elige la categoría correspondiente',
    'Describe lo observado y propón una solución',
    'Opcional: agrega área, proyecto y ubicación GPS',
    'Envía el reporte o asígnalo directamente'
  ],
  10
);

-- ========================================
-- 2. GALERÍA (Gallery) - order_index 20-29
-- ========================================

-- Ver Reportes (Worker)
INSERT INTO guides (title, role, icon, steps, order_index) VALUES
(
  'Ver Mis Reportes',
  'worker',
  'Gallery',
  ARRAY[
    'Ve a Galería desde el menú principal',
    'Visualiza todos tus reportes enviados',
    'Haz clic en cualquier reporte para ver detalles',
    'Revisa el estado: Pendiente, En Proceso o Cerrado',
    'Puedes exportar reportes a Excel desde aquí'
  ],
  20
);

-- Gestionar Reportes (SST Manager)
INSERT INTO guides (title, role, icon, steps, order_index) VALUES
(
  'Gestionar Reportes',
  'sst_manager',
  'Gallery',
  ARRAY[
    'Ve a Galería para ver todos los reportes',
    'Filtra por estado, categoría, área o proyecto',
    'Haz clic en un reporte para revisar detalles',
    'Asigna responsables y cambia el estado',
    'Agrega evidencias de cierre cuando se resuelva',
    'Exporta reportes a Excel para análisis'
  ],
  20
);

-- ========================================
-- 3. USUARIOS (Users) - order_index 30-39
-- ========================================

-- Gestionar Usuarios (SST Manager)
INSERT INTO guides (title, role, icon, steps, order_index) VALUES
(
  'Gestionar Usuarios',
  'sst_manager',
  'Users',
  ARRAY[
    'Ve a Usuarios desde el menú',
    'Visualiza todos los usuarios de tu empresa',
    'Crea nuevos usuarios con DNI y rol',
    'Edita información de usuarios existentes',
    'Elimina usuarios que ya no necesites',
    'Los trabajadores pueden crear reportes'
  ],
  30
);

-- ========================================
-- 4. CONFIGURACIÓN (Settings) - order_index 40-49
-- ========================================

-- Configurar Categorías (SST Manager)
INSERT INTO guides (title, role, icon, steps, order_index) VALUES
(
  'Configurar Categorías',
  'sst_manager',
  'Settings',
  ARRAY[
    'Ve a Configuración, pestaña Categorías',
    'Crea nuevas categorías de reportes',
    'Define el nombre de la categoría',
    'Haz clic en el selector de color',
    'Elige un color para identificarla visualmente',
    'Edita o elimina categorías existentes'
  ],
  40
);

-- Configurar Áreas (SST Manager)
INSERT INTO guides (title, role, icon, steps, order_index) VALUES
(
  'Configurar Áreas',
  'sst_manager',
  'Settings',
  ARRAY[
    'Ve a Configuración, pestaña Áreas',
    'Crea nuevas áreas con nombre descriptivo',
    'Las áreas ayudan a clasificar reportes por ubicación',
    'Edita o elimina áreas según necesidad',
    'Los trabajadores verán estas áreas al reportar'
  ],
  41
);

-- Configurar Proyectos (SST Manager)
INSERT INTO guides (title, role, icon, steps, order_index) VALUES
(
  'Configurar Proyectos',
  'sst_manager',
  'Settings',
  ARRAY[
    'Ve a Configuración, pestaña Proyectos',
    'Crea nuevos proyectos con nombre descriptivo',
    'Los proyectos agrupan reportes por iniciativa',
    'Edita o elimina proyectos existentes',
    'Los trabajadores verán estos proyectos al reportar'
  ],
  42
);

-- ========================================
-- 5. MÉTRICAS (BarChart3) - order_index 50-59
-- ========================================

-- Ver Métricas (SST Manager)
INSERT INTO guides (title, role, icon, steps, order_index) VALUES
(
  'Ver Métricas y Estadísticas',
  'sst_manager',
  'BarChart3',
  ARRAY[
    'Ve a Métricas desde el menú principal',
    'Visualiza gráficos de reportes por categoría',
    'Revisa estadísticas por área y proyecto',
    'Analiza tendencias de Actos y Condiciones Inseguras',
    'Monitorea tiempos de respuesta y cierre',
    'Exporta datos para reportes ejecutivos'
  ],
  50
);
