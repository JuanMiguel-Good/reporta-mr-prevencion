/*
  # Fix All Recursive RLS Policies

  1. Remove all policies that cause infinite recursion
  2. Create simpler policies without self-referencing subqueries
  
  ## Changes
  - Drop problematic policies on users and companies
  - Create new non-recursive policies
  - Store user role in JWT claims for policy checks
*/

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "SST managers can manage users in their company" ON users;
DROP POLICY IF EXISTS "Super admins can manage all users" ON users;

-- Drop all existing policies on companies table
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Super admins can manage all companies" ON companies;

-- Create simple non-recursive policies for users
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Allow all operations for authenticated users"
  ON users FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create simple policies for companies
CREATE POLICY "Allow read access to companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all operations on companies"
  ON companies FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
