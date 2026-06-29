/*
  # Sistema de Gestor SST Multiempresa

  ## 1. Modificaciones a la tabla users
    - Eliminar constraint UNIQUE del campo dni
    - Agregar constraint UNIQUE compuesta (dni, company_id)
    - Agregar campo is_multi_company_manager (boolean)
    - Agregar constraint CHECK para is_multi_company_manager (solo gestores SST pueden ser multiempresa)

  ## 2. Nueva tabla: multi_company_managers
    - `id` (uuid, primary key)
    - `dni` (text, unique, not null)
    - `primary_email` (text, not null)
    - `full_name` (text, not null)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## 3. Funciones auxiliares
    - get_companies_for_dni: Retorna lista de empresas donde un DNI está registrado como gestor SST multiempresa
    - is_multi_company_dni: Verifica si un DNI es gestor multiempresa

  ## 4. Seguridad
    - RLS habilitado en multi_company_managers
    - Solo super_admin puede gestionar gestores multiempresa
*/

-- 1. Agregar nuevo campo a users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_multi_company_manager'
  ) THEN
    ALTER TABLE users ADD COLUMN is_multi_company_manager boolean DEFAULT false;
  END IF;
END $$;

-- 2. Eliminar constraint UNIQUE del campo dni si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_dni_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_dni_key;
  END IF;
END $$;

-- 3. Agregar constraint UNIQUE compuesta (dni, company_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_dni_company_id_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_dni_company_id_key UNIQUE (dni, company_id);
  END IF;
END $$;

-- 4. Agregar constraint CHECK para is_multi_company_manager
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_multi_company_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_multi_company_role_check 
    CHECK (
      NOT is_multi_company_manager OR 
      (is_multi_company_manager AND role = 'sst_manager')
    );
  END IF;
END $$;

-- 5. Crear tabla multi_company_managers
CREATE TABLE IF NOT EXISTS multi_company_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dni text UNIQUE NOT NULL,
  primary_email text NOT NULL,
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Habilitar RLS en multi_company_managers
ALTER TABLE multi_company_managers ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para multi_company_managers
CREATE POLICY "Super admins can view all multi-company managers"
  ON multi_company_managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert multi-company managers"
  ON multi_company_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update multi-company managers"
  ON multi_company_managers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete multi-company managers"
  ON multi_company_managers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- 8. Función para obtener empresas de un DNI multiempresa
CREATE OR REPLACE FUNCTION get_companies_for_dni(user_dni text)
RETURNS TABLE (
  user_id uuid,
  company_id uuid,
  company_name text,
  company_logo text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.company_id,
    c.name,
    c.logo_url
  FROM users u
  INNER JOIN companies c ON c.id = u.company_id
  WHERE u.dni = user_dni
    AND u.is_multi_company_manager = true
    AND u.role = 'sst_manager'
    AND u.active = true
    AND c.active = true
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Función para verificar si un DNI es multiempresa
CREATE OR REPLACE FUNCTION is_multi_company_dni(user_dni text)
RETURNS boolean AS $$
DECLARE
  company_count integer;
BEGIN
  SELECT COUNT(DISTINCT company_id) INTO company_count
  FROM users
  WHERE dni = user_dni
    AND is_multi_company_manager = true
    AND role = 'sst_manager'
    AND active = true;
  
  RETURN company_count > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Función para sincronizar datos de gestor multiempresa
CREATE OR REPLACE FUNCTION sync_multi_company_manager_data(
  manager_dni text,
  new_full_name text DEFAULT NULL,
  new_email text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Actualizar nombre completo si se proporciona
  IF new_full_name IS NOT NULL THEN
    UPDATE users
    SET full_name = new_full_name,
        updated_at = now()
    WHERE dni = manager_dni
      AND is_multi_company_manager = true;
    
    UPDATE multi_company_managers
    SET full_name = new_full_name,
        updated_at = now()
    WHERE dni = manager_dni;
  END IF;
  
  -- Actualizar email si se proporciona
  IF new_email IS NOT NULL THEN
    UPDATE users
    SET email = new_email,
        updated_at = now()
    WHERE dni = manager_dni
      AND is_multi_company_manager = true;
    
    UPDATE multi_company_managers
    SET primary_email = new_email,
        updated_at = now()
    WHERE dni = manager_dni;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Agregar índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_users_dni_multi_company 
  ON users(dni) WHERE is_multi_company_manager = true;

CREATE INDEX IF NOT EXISTS idx_users_company_id_role 
  ON users(company_id, role);
