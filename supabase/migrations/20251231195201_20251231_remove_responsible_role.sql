/*
  # Remove 'responsible' Role

  ## Overview
  This migration eliminates the 'responsible' role, as the system now uses
  the `can_close_reports` flag to designate closure responsibility independently of role.

  ## Changes

  ### 1. Data Migration
    - Convert all users with role='responsible' to role='worker'
    - Preserve their can_close_reports=true status

  ### 2. RLS Policy Updates
    - Remove policy that checks for role='responsible'
    - Replace with policy that checks assigned_to_id and can_close_reports

  ### 3. Constraint Update
    - Remove 'responsible' from users.role CHECK constraint

  ## Impact
  - Users previously marked as 'responsible' maintain closure permissions via can_close_reports flag
  - No functionality is lost
  - Simplifies role management
*/

-- Step 1: Migrate existing 'responsible' users to 'worker' (they already have can_close_reports=true)
UPDATE users
SET role = 'worker'
WHERE role = 'responsible';

-- Step 2: Drop the old RLS policy that checks for 'responsible' role
DROP POLICY IF EXISTS "Responsibles can update assigned reports" ON reports;

-- Step 3: Create new RLS policy based on assignment, not role
CREATE POLICY "Assigned users can update their reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    assigned_to_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.can_close_reports = true
    )
  );

-- Step 4: Update the CHECK constraint to remove 'responsible'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('worker', 'sst_manager', 'hr_observer', 'super_admin'));

-- Add helpful comment
COMMENT ON CONSTRAINT users_role_check ON users IS
  'Valid roles: worker, sst_manager, hr_observer, super_admin. Note: responsible role removed in favor of can_close_reports flag.';
