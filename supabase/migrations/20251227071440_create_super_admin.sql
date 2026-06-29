/*
  # Create Super Admin User

  1. Creates admin company if not exists
  2. Creates super admin authentication user
  3. Links to users table

  ## Credentials
  - Email: admin@safetyreport.com
  - DNI: 00000000
  - Password: admin123456
  - Role: super_admin
*/

-- Create admin company if not exists
INSERT INTO companies (id, name, plan_type, max_users, active)
VALUES (
  'e3fbe629-276e-4cde-b4f1-7261031b3f7b'::uuid,
  'Sistema Admin',
  'premium',
  999,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Create function to create super admin user
CREATE OR REPLACE FUNCTION create_super_admin()
RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Insert into auth.users (this requires admin privileges)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@safetyreport.com',
    crypt('admin123456', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Insert into users table
  INSERT INTO users (
    id,
    email,
    dni,
    full_name,
    role,
    company_id,
    active
  )
  VALUES (
    new_user_id,
    'admin@safetyreport.com',
    '00000000',
    'Super Admin',
    'super_admin',
    'e3fbe629-276e-4cde-b4f1-7261031b3f7b'::uuid,
    true
  );

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to create the super admin
SELECT create_super_admin();

-- Drop the function after use
DROP FUNCTION create_super_admin();
