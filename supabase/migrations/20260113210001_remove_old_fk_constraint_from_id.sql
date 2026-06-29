/*
  # Remove Old Foreign Key from users.id
  
  ## Changes
  1. Drop the foreign key constraint from users.id to auth.users(id)
  2. Only auth_user_id should reference auth.users
  3. users.id should be a simple UUID primary key
  
  ## Security
  - No security changes, just fixing the constraint
*/

-- Drop the old foreign key constraint from id to auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_id_fkey'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_id_fkey;
  END IF;
END $$;
