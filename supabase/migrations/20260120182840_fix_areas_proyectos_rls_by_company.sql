/*
  # Fix RLS for Areas and Proyectos

  ## Changes
  1. Drop old policies with USING (true)
  2. Create proper policies that filter by company_id
  
  ## Security
  - Users can only see areas/proyectos from their company
  - Admins and managers can manage areas/proyectos
*/

-- Drop old policies
DROP POLICY IF EXISTS "authenticated_full_access_areas" ON areas;
DROP POLICY IF EXISTS "authenticated_full_access_proyectos" ON proyectos;

-- Areas policies
CREATE POLICY "Users can view areas from their company"
  ON areas FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert areas"
  ON areas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND company_id = areas.company_id
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins can update areas"
  ON areas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND company_id = areas.company_id
      AND role IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND company_id = areas.company_id
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete areas"
  ON areas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND company_id = areas.company_id
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Proyectos policies
CREATE POLICY "Users can view proyectos from their company"
  ON proyectos FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert proyectos"
  ON proyectos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND company_id = proyectos.company_id
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins can update proyectos"
  ON proyectos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND company_id = proyectos.company_id
      AND role IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND company_id = proyectos.company_id
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete proyectos"
  ON proyectos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND company_id = proyectos.company_id
      AND role IN ('super_admin', 'admin', 'manager')
    )
  );
