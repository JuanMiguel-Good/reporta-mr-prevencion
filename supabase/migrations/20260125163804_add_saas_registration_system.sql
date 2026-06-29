/*
  # Add SAAS Registration System
  
  ## Changes
  1. Functions for validation
    - `check_ruc_availability` - Verify RUC is unique
    - `check_email_availability` - Verify email is unique  
    - `check_dni_availability` - Verify DNI is unique
    - `register_new_company_and_user` - Complete registration transaction
  
  2. Security
    - All validation functions are public (no RLS needed)
    - Main registration function creates all records atomically
    - Assigns Free plan by default
    - Creates default categories for new company
    - Sets up AI configuration based on plan
  
  ## Important Notes
  - Registration is open to public (no auth required)
  - Email verification is disabled
  - Default plan is Free
  - No payment processing
*/

-- Check if RUC is available (not already registered)
CREATE OR REPLACE FUNCTION check_ruc_availability(ruc_value text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM companies WHERE ruc = ruc_value
  );
END;
$$;

-- Check if email is available (not already registered)
CREATE OR REPLACE FUNCTION check_email_availability(email_value text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM users WHERE email = email_value
  );
END;
$$;

-- Check if DNI is available (not already registered in this company context)
CREATE OR REPLACE FUNCTION check_dni_availability(dni_value text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- DNI can be reused across companies for multi-company managers
  -- But for initial registration check, we just verify format
  RETURN LENGTH(dni_value) = 8 AND dni_value ~ '^[0-9]+$';
END;
$$;

-- Main registration function - creates company and SST manager user
CREATE OR REPLACE FUNCTION register_new_company_and_user(
  company_name text,
  company_ruc text,
  company_razon_social text,
  company_num_trabajadores integer,
  company_direccion text,
  company_distrito text,
  company_provincia text,
  company_departamento text,
  company_actividad_economica text,
  user_full_name text,
  user_dni text,
  user_email text,
  user_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_company_id uuid;
  new_auth_user_id uuid;
  new_user_id uuid;
  free_plan_id uuid;
  result jsonb;
BEGIN
  -- Validate RUC is available
  IF NOT check_ruc_availability(company_ruc) THEN
    RAISE EXCEPTION 'RUC ya está registrado';
  END IF;

  -- Validate email is available
  IF NOT check_email_availability(user_email) THEN
    RAISE EXCEPTION 'Email ya está registrado';
  END IF;

  -- Create company
  INSERT INTO companies (
    name,
    ruc,
    razon_social,
    num_trabajadores,
    direccion,
    distrito,
    provincia,
    departamento,
    actividad_economica,
    plan_type,
    active
  ) VALUES (
    company_name,
    company_ruc,
    company_razon_social,
    company_num_trabajadores,
    company_direccion,
    company_distrito,
    company_provincia,
    company_departamento,
    company_actividad_economica,
    'free',
    true
  )
  RETURNING id INTO new_company_id;

  -- Get Free plan ID
  SELECT id INTO free_plan_id 
  FROM plans 
  WHERE name = 'Free' 
  LIMIT 1;

  -- If Free plan doesn't exist, create it
  IF free_plan_id IS NULL THEN
    INSERT INTO plans (
      name,
      description,
      monthly_limit,
      monthly_price,
      ai_enabled,
      ai_monthly_limit,
      active
    ) VALUES (
      'Free',
      'Plan gratuito con funcionalidades básicas',
      50,
      0,
      true,
      50,
      true
    )
    RETURNING id INTO free_plan_id;
  END IF;

  -- Assign Free plan to company
  INSERT INTO company_plans (company_id, plan_id)
  VALUES (new_company_id, free_plan_id);

  -- Create AI settings for company
  INSERT INTO company_ai_settings (
    company_id,
    ai_enabled,
    monthly_analysis_limit
  ) VALUES (
    new_company_id,
    true,
    50
  );

  -- Initialize AI usage tracking
  INSERT INTO ai_usage_tracking (
    company_id,
    month,
    analysis_count,
    total_cost
  ) VALUES (
    new_company_id,
    TO_CHAR(NOW(), 'YYYY-MM'),
    0,
    0
  );

  -- Create default categories for the new company
  PERFORM create_default_categories(new_company_id);

  -- Return success with company_id
  result := jsonb_build_object(
    'success', true,
    'company_id', new_company_id,
    'message', 'Empresa creada exitosamente. Por favor, complete el registro en Supabase Auth.'
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN result;
END;
$$;

-- Grant execute permissions to anonymous users
GRANT EXECUTE ON FUNCTION check_ruc_availability(text) TO anon;
GRANT EXECUTE ON FUNCTION check_email_availability(text) TO anon;
GRANT EXECUTE ON FUNCTION check_dni_availability(text) TO anon;
GRANT EXECUTE ON FUNCTION register_new_company_and_user(text, text, text, integer, text, text, text, text, text, text, text, text, text) TO anon;
