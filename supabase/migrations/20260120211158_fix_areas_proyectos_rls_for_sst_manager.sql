/*
  # Fix Areas and Proyectos RLS for SST Manager role

  ## Changes
  1. Update INSERT/UPDATE/DELETE policies for areas and proyectos
  2. Allow sst_manager role to manage areas and proyectos
  
  ## Security
  - Only users with sst_manager or super_admin roles can manage areas/proyectos
  - All users can view areas/proyectos from their company
*/

-- Drop existing policies for areas
DROP POLICY IF EXISTS "Admins can insert areas" ON areas;
DROP POLICY IF EXISTS "Admins can update areas" ON areas;
DROP POLICY IF EXISTS "Admins can delete areas" ON areas;

-- Drop existing policies for proyectos
DROP POLICY IF EXISTS "Admins can insert proyectos" ON proyectos;
DROP POLICY IF EXISTS "Admins can update proyectos" ON proyectos;
DROP POLICY IF EXISTS "Admins can delete proyectos" ON proyectos;

-- Recreate areas policies with sst_manager support
CREATE POLICY "Managers can insert areas"
  ON areas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = areas.company_id
      AND users.role IN ('super_admin', 'sst_manager')
      AND users.active = true
    )
  );

CREATE POLICY "Managers can update areas"
  ON areas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = areas.company_id
      AND users.role IN ('super_admin', 'sst_manager')
      AND users.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = areas.company_id
      AND users.role IN ('super_admin', 'sst_manager')
      AND users.active = true
    )
  );

CREATE POLICY "Managers can delete areas"
  ON areas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = areas.company_id
      AND users.role IN ('super_admin', 'sst_manager')
      AND users.active = true
    )
  );

-- Recreate proyectos policies with sst_manager support
CREATE POLICY "Managers can insert proyectos"
  ON proyectos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = proyectos.company_id
      AND users.role IN ('super_admin', 'sst_manager')
      AND users.active = true
    )
  );

CREATE POLICY "Managers can update proyectos"
  ON proyectos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = proyectos.company_id
      AND users.role IN ('super_admin', 'sst_manager')
      AND users.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = proyectos.company_id
      AND users.role IN ('super_admin', 'sst_manager')
      AND users.active = true
    )
  );

CREATE POLICY "Managers can delete proyectos"
  ON proyectos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = proyectos.company_id
      AND users.role IN ('super_admin', 'sst_manager')
      AND users.active = true
    )
  );
