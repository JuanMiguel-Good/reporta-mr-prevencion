/*
  # Fix Super Admin User Creation

  1. Changes
    - Drop the problematic create_new_super_admin function
    - Clean up any incorrectly created auth users
    - Ensure only the original super admin exists with correct setup

  2. Security
    - Super admins must be created through Supabase Dashboard or CLI
    - This prevents database corruption from manual auth.users inserts
*/

-- Drop the problematic function
DROP FUNCTION IF EXISTS create_new_super_admin(text, text, text, text);

-- Clean up any auth.users that were created manually and may be corrupted
DELETE FROM auth.users 
WHERE email = 'veronica.ortiz@goodsolutions.pe'
AND id = 'fa329de7-5bc1-426c-97df-23e7f13dfed7';

-- Clean up the corresponding users table entry
DELETE FROM public.users 
WHERE email = 'veronica.ortiz@goodsolutions.pe'
AND id = 'fa329de7-5bc1-426c-97df-23e7f13dfed7';

-- Add a note to the database about super admin creation
COMMENT ON TABLE public.users IS 'Super admin users must be created through Supabase Auth Dashboard or using Supabase CLI. Do not manually insert into auth.users table.';
