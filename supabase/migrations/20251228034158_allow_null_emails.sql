/*
  # Permitir emails nulos en la tabla de usuarios
  
  1. Cambios
    - Modifica la columna `email` en la tabla `users` para permitir valores NULL
    - Esto permite crear usuarios sin email que solo se autentican con DNI
    - Los emails temporales ya no son necesarios en la tabla users
  
  2. Seguridad
    - Se mantienen todas las políticas RLS existentes
    - El login con DNI ya está soportado mediante la función get_email_from_dni
*/

-- Permitir que la columna email sea nullable
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
