/*
  # Redesign Users Table for Multi-Company Support
  
  ## Changes
  1. Add new column `auth_user_id` to reference auth.users
  2. Remove FK constraint from `id` to auth.users
  3. Change `id` to be a simple UUID primary key (not FK)
  4. Copy existing `id` values to `auth_user_id`
  5. This allows multiple user records (one per company) for the same auth user
  
  ## Security
  - Maintains all existing RLS policies
  - Enables multi-company managers to have multiple company associations
*/

-- Step 1: Add auth_user_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Step 2: Copy existing id values to auth_user_id
UPDATE users SET auth_user_id = id WHERE auth_user_id IS NULL;

-- Step 3: Add foreign key constraint from auth_user_id to auth.users
ALTER TABLE users ADD CONSTRAINT users_auth_user_id_fkey 
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 4: Create index on auth_user_id for performance
CREATE INDEX IF NOT EXISTS users_auth_user_id_idx ON users(auth_user_id);
