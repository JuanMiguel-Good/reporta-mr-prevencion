/*
  # Add Proposed Closure Date to Reports

  1. Changes
    - Add `proposed_closure_date` column to `reports` table
      - Type: date (nullable)
      - Used by SST managers to set expected closure date when assigning reports
  
  2. Notes
    - Field is optional and only set when a report is assigned to a responsible
    - Helps track deadlines and manage report resolution timelines
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'proposed_closure_date'
  ) THEN
    ALTER TABLE reports ADD COLUMN proposed_closure_date date;
  END IF;
END $$;