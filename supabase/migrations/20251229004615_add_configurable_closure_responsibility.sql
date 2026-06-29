/*
  # Add Configurable Closure Responsibility System
  
  ## Overview
  This migration enables users of any role to be designated as responsible for uploading evidence
  to close reports, while maintaining that only SST Managers can validate and finalize closures.
  
  ## Changes
  
  ### 1. Users Table
    - Add `can_close_reports` (boolean, default false)
      - Indicates if a user can be assigned as responsible for closing reports
      - Can be enabled for users of any role
      - Allows SST Managers to flexibly assign closure responsibility
    - Create index on `can_close_reports` for efficient filtering during assignment
    - Migrate existing data: Users with role 'responsible' automatically get this enabled
  
  ### 2. Reports Table
    - Add `closed_by_id` (uuid, nullable, foreign key to users)
      - Tracks which SST Manager validated and closed each report
      - Provides complete audit trail of closure decisions
      - Separate from `assigned_to_id` which tracks evidence uploader
  
  ## Security
    - No RLS changes needed - existing policies cover the new fields
    - Only SST Managers can update `closed_by_id` through application logic
  
  ## Notes
    - This decouples closure responsibility from user roles
    - Provides organizational flexibility in assigning work
    - Maintains quality control through SST Manager validation
    - Full traceability: who was assigned + who validated
*/

-- Add can_close_reports field to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'can_close_reports'
  ) THEN
    ALTER TABLE users ADD COLUMN can_close_reports boolean DEFAULT false;
  END IF;
END $$;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_users_can_close_reports 
ON users(can_close_reports) 
WHERE can_close_reports = true;

-- Migrate existing responsible users
UPDATE users 
SET can_close_reports = true 
WHERE role = 'responsible' AND can_close_reports = false;

-- Add closed_by_id field to reports table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'closed_by_id'
  ) THEN
    ALTER TABLE reports ADD COLUMN closed_by_id uuid REFERENCES users(id);
  END IF;
END $$;

-- Create index for tracking who closed reports
CREATE INDEX IF NOT EXISTS idx_reports_closed_by_id 
ON reports(closed_by_id) 
WHERE closed_by_id IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN users.can_close_reports IS 'Indicates if user can be assigned as responsible for uploading closure evidence. Independent of role.';
COMMENT ON COLUMN reports.closed_by_id IS 'SST Manager who validated and closed this report. Null if report is not closed.';