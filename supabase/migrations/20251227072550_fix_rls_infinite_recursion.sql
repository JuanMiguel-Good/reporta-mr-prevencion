/*
  # Fix RLS Infinite Recursion

  1. Removes the problematic recursive policy on users table
  2. Simplifies RLS policies to avoid infinite recursion
  
  ## Changes
  - Drops the "Users can view colleagues in their company" policy that causes recursion
  - Super admins can still see all users
  - Users can still see their own profile
  - SST managers can still manage users in their company
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view colleagues in their company" ON users;

-- Users can only view their own profile (no recursion)
-- Super admins and SST managers already have separate policies that allow broader access
