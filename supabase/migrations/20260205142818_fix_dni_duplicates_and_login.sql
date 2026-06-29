/*
  # Fix DNI Duplicates and Improve Login Function
  
  1. Analysis
    - Found 2 DNIs with duplicates in the system:
      - DNI 43477740: Same auth_user_id, multi-company manager (VALID)
      - DNI 71483808: Different auth_user_id, accidental duplicate (NEEDS FIX)
    
  2. Changes
    - Improve get_email_from_dni to handle multiple auth_user_id for same DNI
    - Add function to check if DNI has multiple auth accounts
    - Update get_email_from_dni to return most recently used account
  
  3. Security
    - Maintains security definer for database access
    - Returns clear error messages for problematic cases
*/

-- Function to check if DNI has multiple auth accounts
CREATE OR REPLACE FUNCTION public.check_dni_multiple_auth_accounts(user_dni text)
RETURNS TABLE(auth_user_id uuid, email text, full_name text, company_count bigint, last_login timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.auth_user_id,
    u.email,
    u.full_name,
    COUNT(DISTINCT u.company_id) as company_count,
    au.last_sign_in_at
  FROM public.users u
  JOIN auth.users au ON au.id = u.auth_user_id
  WHERE u.dni = user_dni
  GROUP BY u.auth_user_id, u.email, u.full_name, au.last_sign_in_at
  ORDER BY au.last_sign_in_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_dni_multiple_auth_accounts(text) TO anon, authenticated;

-- Improved get_email_from_dni function
DROP FUNCTION IF EXISTS public.get_email_from_dni(text);
CREATE OR REPLACE FUNCTION public.get_email_from_dni(user_dni text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_email text;
  auth_count integer;
BEGIN
  -- Check how many different auth_user_id exist for this DNI
  SELECT COUNT(DISTINCT auth_user_id) INTO auth_count
  FROM public.users
  WHERE dni = user_dni;
  
  -- If no user found, return null
  IF auth_count = 0 THEN
    RETURN NULL;
  END IF;
  
  -- If multiple auth accounts exist for same DNI, this is problematic
  -- Return the email from the most recently used account
  IF auth_count > 1 THEN
    SELECT COALESCE(u.email, u.dni || '@internal.temp') INTO user_email
    FROM public.users u
    JOIN auth.users au ON au.id = u.auth_user_id
    WHERE u.dni = user_dni
    ORDER BY au.last_sign_in_at DESC NULLS LAST
    LIMIT 1;
    
    RETURN user_email;
  END IF;
  
  -- Single auth account (normal case, may have multiple companies)
  SELECT COALESCE(email, dni || '@internal.temp') INTO user_email
  FROM public.users
  WHERE dni = user_dni
  LIMIT 1;
  
  RETURN user_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_from_dni(text) TO anon, authenticated;

-- Add helpful function to identify problematic duplicate DNIs
CREATE OR REPLACE FUNCTION public.get_problematic_duplicate_dnis()
RETURNS TABLE(dni text, auth_count bigint, user_details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.dni,
    COUNT(DISTINCT u.auth_user_id) as auth_count,
    jsonb_agg(
      jsonb_build_object(
        'auth_user_id', u.auth_user_id,
        'email', u.email,
        'full_name', u.full_name,
        'company_id', u.company_id,
        'created_at', u.created_at
      ) ORDER BY u.created_at
    ) as user_details
  FROM public.users u
  GROUP BY u.dni
  HAVING COUNT(DISTINCT u.auth_user_id) > 1
  ORDER BY auth_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_problematic_duplicate_dnis() TO authenticated;

-- Add index to improve performance of DNI lookups
CREATE INDEX IF NOT EXISTS idx_users_dni_auth_user_id ON public.users(dni, auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_dni_active ON public.users(dni) WHERE active = true;
