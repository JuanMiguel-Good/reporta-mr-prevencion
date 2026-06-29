/*
  # Add Area and Proyecto fields to Reports

  ## Changes
  
  1. **Modified Tables**
    - `reports`
      - Add `area` (text, nullable) - Work area where the report was made
      - Add `proyecto` (text, nullable) - Project where the report was made
      - Add index for better query performance

  ## Notes
  - These fields are nullable to maintain compatibility with existing reports
  - They allow tracking where unsafe acts/conditions are observed
*/

-- Add area and proyecto columns to reports table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'area'
  ) THEN
    ALTER TABLE reports ADD COLUMN area text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'proyecto'
  ) THEN
    ALTER TABLE reports ADD COLUMN proyecto text;
  END IF;
END $$;

-- Create index for area and proyecto for better filtering
CREATE INDEX IF NOT EXISTS idx_reports_area ON reports(area);
CREATE INDEX IF NOT EXISTS idx_reports_proyecto ON reports(proyecto);