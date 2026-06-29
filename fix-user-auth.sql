-- Script para crear cuenta de autenticación para usuario existente
-- Usuario: DNI 72288795 (MAYRA MALDONADO)

-- Este script debe ejecutarse manualmente desde el panel de Supabase
-- ya que requiere crear un usuario en auth.users

-- Pasos a seguir:
-- 1. Ve al panel de Supabase: https://supabase.com/dashboard
-- 2. Selecciona tu proyecto
-- 3. Ve a Authentication > Users
-- 4. Click en "Add user" > "Create new user"
-- 5. Ingresa:
--    Email: sig@vulcanometals.com
--    Password: 72288795 (o la contraseña que prefieras)
--    Marca "Auto Confirm User" como activado
-- 6. Click en "Create user"
-- 7. Copia el UUID del usuario creado
-- 8. Ejecuta el siguiente query reemplazando 'AUTH_USER_ID_AQUI' con el UUID copiado:

-- UPDATE users
-- SET auth_user_id = 'AUTH_USER_ID_AQUI'
-- WHERE dni = '72288795';

-- Alternativa: Eliminar y recrear el usuario
-- Si prefieres, puedes eliminar el usuario actual y recrearlo desde el frontend
-- usando el botón "Agregar Usuario" en la página de Usuarios
