/*
  # Fix Areas and Proyectos RLS policies
  
  1. Problem
    - Current RLS policies use auth.uid() which doesn't work with frontend impersonation
    - Super admins cannot see areas/proyectos when impersonating users
    - Some users cannot see their own areas/proyectos
  
  2. Solution
    - Add policies allowing super_admins to view all areas/proyectos
    - Simplify existing policies to ensure they work correctly
    - Ensure impersonation mode works properly
  
  3. Changes
    - Add super admin bypass policies for SELECT on areas table
    - Add super admin bypass policies for SELECT on proyectos table
    - Keep existing policies for regular users
*/

-- Drop and recreate areas SELECT policy with super admin support
DROP POLICY IF EXISTS "Users can view areas from their company" ON areas;

CREATE POLICY "Users can view areas from their company"
  ON areas
  FOR SELECT
  TO authenticated
  USING (
    -- Regular users: see areas from their company
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.company_id = areas.company_id
        AND users.active = true
    )
    OR
    -- Super admins: see all areas
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'super_admin'
        AND users.active = true
    )
  );

-- Drop and recreate proyectos SELECT policy with super admin support
DROP POLICY IF EXISTS "Users can view proyectos from their company" ON proyectos;

CREATE POLICY "Users can view proyectos from their company"
  ON proyectos
  FOR SELECT
  TO authenticated
  USING (
    -- Regular users: see proyectos from their company
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.company_id = proyectos.company_id
        AND users.active = true
    )
    OR
    -- Super admins: see all proyectos
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.role = 'super_admin'
        AND users.active = true
    )
  );

-- Update areas modification policies to include super admin
DROP POLICY IF EXISTS "Managers can insert areas" ON areas;
DROP POLICY IF EXISTS "Managers can update areas" ON areas;
DROP POLICY IF EXISTS "Managers can delete areas" ON areas;

CREATE POLICY "Managers can insert areas"
  ON areas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND (
          (users.company_id = areas.company_id AND users.role IN ('sst_manager', 'super_admin'))
          OR users.role = 'super_admin'
        )
        AND users.active = true
    )
  );

CREATE POLICY "Managers can update areas"
  ON areas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND (
          (users.company_id = areas.company_id AND users.role IN ('sst_manager', 'super_admin'))
          OR users.role = 'super_admin'
        )
        AND users.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND (
          (users.company_id = areas.company_id AND users.role IN ('sst_manager', 'super_admin'))
          OR users.role = 'super_admin'
        )
        AND users.active = true
    )
  );

CREATE POLICY "Managers can delete areas"
  ON areas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND (
          (users.company_id = areas.company_id AND users.role IN ('sst_manager', 'super_admin'))
          OR users.role = 'super_admin'
        )
        AND users.active = true
    )
  );

-- Update proyectos modification policies to include super admin
DROP POLICY IF EXISTS "Managers can insert proyectos" ON proyectos;
DROP POLICY IF EXISTS "Managers can update proyectos" ON proyectos;
DROP POLICY IF EXISTS "Managers can delete proyectos" ON proyectos;

CREATE POLICY "Managers can insert proyectos"
  ON proyectos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND (
          (users.company_id = proyectos.company_id AND users.role IN ('sst_manager', 'super_admin'))
          OR users.role = 'super_admin'
        )
        AND users.active = true
    )
  );

CREATE POLICY "Managers can update proyectos"
  ON proyectos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND (
          (users.company_id = proyectos.company_id AND users.role IN ('sst_manager', 'super_admin'))
          OR users.role = 'super_admin'
        )
        AND users.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND (
          (users.company_id = proyectos.company_id AND users.role IN ('sst_manager', 'super_admin'))
          OR users.role = 'super_admin'
        )
        AND users.active = true
    )
  );

CREATE POLICY "Managers can delete proyectos"
  ON proyectos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND (
          (users.company_id = proyectos.company_id AND users.role IN ('sst_manager', 'super_admin'))
          OR users.role = 'super_admin'
        )
        AND users.active = true
    )
  );
