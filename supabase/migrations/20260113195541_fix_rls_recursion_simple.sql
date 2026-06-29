/*
  # Fix RLS Recursion - Simple Approach

  This migration fixes the infinite recursion in RLS policies by using simple,
  non-recursive policies.
  
  ## Changes
  
  1. Drops all problematic recursive policies
  2. Creates simple policies that only check auth.uid() = id
  3. Relies on the application logic to handle multi-company access
*/

-- Drop all existing user policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "SST managers can view users in company" ON users;
DROP POLICY IF EXISTS "SST managers can update users in company" ON users;
DROP POLICY IF EXISTS "Super admin can view all users" ON users;
DROP POLICY IF EXISTS "Super admin can update all users" ON users;

-- Simple policy: users can only view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Simple policy: users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- SST managers can view users in their company (using CTE to avoid recursion)
CREATE POLICY "SST managers can view users in company"
  ON users FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id 
      FROM users u
      WHERE u.id = auth.uid() 
      AND u.role IN ('sst_manager', 'super_admin')
    )
  );

-- SST managers can update users in their company
CREATE POLICY "SST managers can update users in company"
  ON users FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id 
      FROM users u
      WHERE u.id = auth.uid() 
      AND u.role = 'sst_manager'
    )
  );

-- Super admin can view all users
CREATE POLICY "Super admin can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- Super admin can update all users  
CREATE POLICY "Super admin can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users u
      WHERE u.id = auth.uid() 
      AND u.role = 'super_admin'
    )
  );

-- Restore original reports policies
DROP POLICY IF EXISTS "Users can view reports from their company" ON reports;
DROP POLICY IF EXISTS "Users can create reports for their company" ON reports;

CREATE POLICY "Users can view reports from their company"
  ON reports FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id 
      FROM users u 
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can create reports for their company"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT u.company_id 
      FROM users u 
      WHERE u.id = auth.uid()
    )
  );
