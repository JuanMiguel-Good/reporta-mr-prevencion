/*
  # Actualizar descripciones de planes

  1. Cambios
    - Actualizar descripción del plan Free: orientado a equipos pequeños
    - Actualizar descripción del plan Basic: orientado a empresas en crecimiento
    - Actualizar descripción del plan Premium: orientado a organizaciones grandes
  
  2. Notas
    - Las nuevas descripciones reflejan mejor el público objetivo de cada plan
*/

UPDATE plans
SET description = 'Ideal para equipos pequeños o proyectos piloto'
WHERE name = 'Free';

UPDATE plans
SET description = 'Para empresas en crecimiento con necesidades estándar'
WHERE name = 'Basic';

UPDATE plans
SET description = 'Para organizaciones grandes con operaciones complejas'
WHERE name = 'Premium';