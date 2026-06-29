/*
  # Update RLS Policies for auth_user_id Column
  
  ## Changes
  1. Drop all existing RLS policies on users, reports, categories, etc.
  2. Recreate policies using auth_user_id instead of id for auth comparisons
  3. Ensure all policies work with multi-company setup
  
  ## Security
  - Maintains same security model but uses correct auth_user_id column
  - Users can only access data from their assigned companies
*/

-- Drop all existing policies on reports
DROP POLICY IF EXISTS "Users can view own reports" ON reports;
DROP POLICY IF EXISTS "Users can view company reports" ON reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON reports;
DROP POLICY IF EXISTS "Users can update own reports" ON reports;
DROP POLICY IF EXISTS "Managers can update assigned reports" ON reports;
DROP POLICY IF EXISTS "Super admins have full access to reports" ON reports;
DROP POLICY IF EXISTS "Workers can create reports" ON reports;
DROP POLICY IF EXISTS "Workers can view own reports" ON reports;
DROP POLICY IF EXISTS "Managers can view company reports" ON reports;
DROP POLICY IF EXISTS "Managers can update company reports" ON reports;
DROP POLICY IF EXISTS "HR observers can view company reports" ON reports;

-- Recreate report policies
CREATE POLICY "Workers can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = reports.company_id
      AND users.active = true
    )
  );

CREATE POLICY "Users can view company reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = reports.company_id
      AND users.active = true
    )
  );

CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.id = reports.reporter_id
      AND users.active = true
    )
  );

CREATE POLICY "Managers can update company reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = reports.company_id
      AND users.role IN ('sst_manager', 'super_admin')
      AND users.active = true
    )
  );

-- Update categories policies
DROP POLICY IF EXISTS "Users can view company categories" ON categories;
DROP POLICY IF EXISTS "Managers can manage categories" ON categories;
DROP POLICY IF EXISTS "Managers can insert categories" ON categories;
DROP POLICY IF EXISTS "Managers can update categories" ON categories;
DROP POLICY IF EXISTS "Managers can delete categories" ON categories;

CREATE POLICY "Users can view company categories"
  ON categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = categories.company_id
      AND users.active = true
    )
  );

CREATE POLICY "Managers can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = categories.company_id
      AND users.role IN ('sst_manager', 'super_admin')
      AND users.active = true
    )
  );

CREATE POLICY "Managers can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = categories.company_id
      AND users.role IN ('sst_manager', 'super_admin')
      AND users.active = true
    )
  );

CREATE POLICY "Managers can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = categories.company_id
      AND users.role IN ('sst_manager', 'super_admin')
      AND users.active = true
    )
  );

-- Update multi_company_managers policies
DROP POLICY IF EXISTS "Super admins can view all multi-company managers" ON multi_company_managers;
DROP POLICY IF EXISTS "Super admins can insert multi-company managers" ON multi_company_managers;
DROP POLICY IF EXISTS "Super admins can update multi-company managers" ON multi_company_managers;
DROP POLICY IF EXISTS "Super admins can delete multi-company managers" ON multi_company_managers;

CREATE POLICY "Super admins can view all multi-company managers"
  ON multi_company_managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert multi-company managers"
  ON multi_company_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update multi-company managers"
  ON multi_company_managers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete multi-company managers"
  ON multi_company_managers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );
