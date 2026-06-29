/*
  # Eliminar paso de personalización de color

  1. Cambios
    - Eliminar paso 3 "Personaliza" de la guía de configuración
    - Simplificar a solo 2 pasos reales que la app sí hace
    - Actualizar descripción del paso 2 para incluir guardar

  2. Razón
    - La app no permite personalizar colores de categorías
    - Solo permite crear y guardar nombre
*/

-- Eliminar el paso de personalización
DELETE FROM guides 
WHERE role = 'sst_manager' 
  AND title = 'Personaliza'
  AND description LIKE '%elige color%';

-- Actualizar el paso 2 para que sea más completo
UPDATE guides 
SET 
  description = 'Haz clic en "Agregar Nueva", ingresa el nombre y guarda'
WHERE role = 'sst_manager' 
  AND title = 'Crea Nuevo'
  AND EXISTS (
    SELECT 1 FROM guides p 
    WHERE p.id = guides.parent_id 
      AND p.title = 'Configurar Categorías/Áreas/Proyectos'
  );
