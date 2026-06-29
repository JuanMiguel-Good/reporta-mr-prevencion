/*
  # Add function to create super admin users

  1. New Functions
    - `create_new_super_admin(p_email, p_dni, p_full_name, p_password)`
      - Creates a new super admin user
      - Inserts into auth.users and users tables
      - Can only be executed by existing super admins
      - Returns the new user ID

  2. Security
    - Function has SECURITY DEFINER to allow auth.users insert
    - Only callable by authenticated super_admin users
    - Validates input parameters
*/

CREATE OR REPLACE FUNCTION create_new_super_admin(
  p_email text,
  p_dni text,
  p_full_name text,
  p_password text
)
RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
  calling_user_role text;
BEGIN
  -- Check if the calling user is a super admin
  SELECT role INTO calling_user_role
  FROM users
  WHERE id = auth.uid();
  
  IF calling_user_role IS NULL OR calling_user_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can create new super admins';
  END IF;

  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  
  IF p_dni IS NULL OR p_dni = '' THEN
    RAISE EXCEPTION 'DNI is required';
  END IF;
  
  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;

  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists';
  END IF;

  -- Check if DNI already exists
  IF EXISTS (SELECT 1 FROM users WHERE dni = p_dni) THEN
    RAISE EXCEPTION 'DNI already exists';
  END IF;

  -- Insert into auth.users
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
    p_email,
    crypt(p_password, gen_salt('bf')),
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
    p_email,
    p_dni,
    p_full_name,
    'super_admin',
    'e3fbe629-276e-4cde-b4f1-7261031b3f7b'::uuid,
    true
  );

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (function itself checks for super_admin role)
GRANT EXECUTE ON FUNCTION create_new_super_admin(text, text, text, text) TO authenticated;