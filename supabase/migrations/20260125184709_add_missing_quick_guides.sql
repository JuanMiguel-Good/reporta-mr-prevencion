/*
  # Agregar Guías Faltantes

  1. Nuevas Guías
    - Crear Nuevo Reporte (Worker)
    - Configurar Áreas (SST Manager)
    - Configurar Proyectos (SST Manager)
    - Personalizar Categorías con Colores (SST Manager)

  2. Contenido
    - Guías con pasos concisos y prácticos
    - Iconos específicos para cada tarea
    - Ordenadas lógicamente
*/

-- Agregar nuevas guías
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
  0
),
(
  'Configurar Áreas',
  'sst_manager',
  'Settings',
  ARRAY[
    'Ve a Configuración desde el menú',
    'Selecciona la pestaña "Áreas"',
    'Crea nuevas áreas con nombre descriptivo',
    'Edita o elimina áreas existentes según necesidad',
    'Los trabajadores verán estas áreas al reportar'
  ],
  10
),
(
  'Configurar Proyectos',
  'sst_manager',
  'Settings',
  ARRAY[
    'Ve a Configuración desde el menú',
    'Selecciona la pestaña "Proyectos"',
    'Crea nuevos proyectos con nombre descriptivo',
    'Edita o elimina proyectos existentes según necesidad',
    'Los trabajadores verán estos proyectos al reportar'
  ],
  11
),
(
  'Personalizar Categorías',
  'sst_manager',
  'Settings',
  ARRAY[
    'Ve a Configuración, pestaña Categorías',
    'Crea o edita una categoría',
    'Define el nombre de la categoría',
    'Haz clic en el selector de color',
    'Elige un color para identificarla visualmente',
    'Guarda los cambios'
  ],
  12
);
