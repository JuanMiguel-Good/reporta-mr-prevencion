/*
  # Add area and proyecto fields to users table

  1. Changes
    - Add `area` column to users table (text, nullable)
    - Add `proyecto` column to users table (text, nullable)
  
  2. Purpose
    - Allow storing organizational information for users
    - Track which area and project each user belongs to
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'area'
  ) THEN
    ALTER TABLE users ADD COLUMN area text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'proyecto'
  ) THEN
    ALTER TABLE users ADD COLUMN proyecto text;
  END IF;
END $$;