/*
  # Fix RLS Policies - Auth User ID Mismatch

  ## Problem
  Multiple RLS policies on the reports table incorrectly compare `users.id` with `auth.uid()`.
  Since `auth.uid()` returns the `auth_user_id` (from Supabase Auth), these comparisons always fail,
  preventing users from creating reports and assigning responsibles.

  ## Changes
  1. Drop incorrect policies that use `users.id = auth.uid()`
  2. Recreate them using `users.auth_user_id = auth.uid()`
  
  ## Policies Fixed
  - "Users can create reports for their company" (INSERT)
  - "Assigned users can update their reports" (UPDATE)
  
  ## Security Notes
  - All policies maintain the same security intent
  - Only fixing the column reference from `id` to `auth_user_id`
  - Existing "authenticated_full_access_reports" policy provides fallback access
*/

-- Drop the incorrect INSERT policy
DROP POLICY IF EXISTS "Users can create reports for their company" ON reports;

-- Recreate with correct column reference
CREATE POLICY "Users can create reports for their company"
  ON reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT u.company_id
      FROM users u
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- Drop the incorrect UPDATE policy for assigned users
DROP POLICY IF EXISTS "Assigned users can update their reports" ON reports;

-- Recreate with correct column reference
CREATE POLICY "Assigned users can update their reports"
  ON reports
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to_id IN (
      SELECT users.id
      FROM users
      WHERE users.auth_user_id = auth.uid()
        AND users.can_close_reports = true
    )
  );
