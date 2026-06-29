/*
  # Fix DNI login for users without email

  This migration fixes the login issue for users who don't have an email address.
  
  ## Problem
  - Users can be created without an email (email field is null)
  - Supabase Auth requires an email, so a temporary email is generated: `{dni}@internal.temp`
  - The get_email_from_dni function returns null when email is null
  - Login fails because it can't find the auth email
  
  ## Solution
  - Update get_email_from_dni to return the generated temporary email when email is null
  - This allows users without email to login using only their DNI
  - Users with email can login with either their DNI or email
*/

DROP FUNCTION IF EXISTS public.get_email_from_dni(text);
CREATE FUNCTION public.get_email_from_dni(user_dni text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT COALESCE(email, dni || '@internal.temp') INTO user_email
  FROM public.users
  WHERE dni = user_dni
  LIMIT 1;
  
  RETURN user_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_from_dni(text) TO anon, authenticated;
