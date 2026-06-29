/*
  # Add description field to report photos

  1. Changes
    - Add `description` text field to `report_photos` table
    - This allows users to add a description when uploading evidence for report closure
    - Description is optional and particularly useful for evidence photos

  2. Notes
    - The description field is nullable to maintain backward compatibility
    - Existing photos without descriptions will have NULL values
*/

-- Add description field to report_photos table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'report_photos' AND column_name = 'description'
  ) THEN
    ALTER TABLE report_photos ADD COLUMN description text;
  END IF;
END $$;
