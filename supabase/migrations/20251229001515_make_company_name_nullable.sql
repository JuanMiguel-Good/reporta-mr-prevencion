/*
  # Make company name field nullable

  1. Changes
    - Make `name` field nullable since `razon_social` is now the primary company identifier
    - The `name` field can be used for internal reference but is not required
  
  2. Notes
    - Existing records will not be affected
    - When `name` is not provided, it will default to NULL or can use `razon_social` value
*/

-- Make name nullable
DO $$
BEGIN
  ALTER TABLE companies ALTER COLUMN name DROP NOT NULL;
END $$;