/*
  # Add DNI Lookup Function

  1. Creates a secure function to get email from DNI
  2. This allows login with DNI without requiring authentication first
  
  ## Security
  - Only returns email, not sensitive data
  - Rate limited by Supabase
*/

-- Function to get email from DNI (for login purposes)
CREATE OR REPLACE FUNCTION get_email_from_dni(user_dni text)
RETURNS text AS $$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email
  FROM users
  WHERE dni = user_dni AND active = true
  LIMIT 1;
  
  RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION get_email_from_dni(text) TO anon, authenticated;
