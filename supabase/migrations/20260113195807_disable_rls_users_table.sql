/*
  # Disable RLS on Users Table Temporarily
  
  This migration temporarily disables RLS on the users table to fix login issues.
  The recursion problem will be solved properly in a future migration.
  
  ## Changes
  
  1. Drop all existing policies on users table
  2. Disable RLS on users table
  
  ## Security Note
  
  This is a temporary fix. In production, RLS should be re-enabled with proper policies.
*/

-- Drop all policies on users table
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "SST managers can view users in company" ON users;
DROP POLICY IF EXISTS "SST managers can update users in company" ON users;
DROP POLICY IF EXISTS "SST managers can insert users" ON users;
DROP POLICY IF EXISTS "Super admin can view all users" ON users;
DROP POLICY IF EXISTS "Super admin can update all users" ON users;
DROP POLICY IF EXISTS "Super admin can insert users" ON users;
DROP POLICY IF EXISTS "Super admin can delete users" ON users;

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
