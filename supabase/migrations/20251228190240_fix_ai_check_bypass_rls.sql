/*
  # Fix AI Check to Bypass RLS

  ## Problem
  The `check_ai_usage_limit` function was failing because RLS policies on the `plans` 
  table were blocking access when called from the edge function (no auth.uid()).

  ## Solution
  Grant the function permission to bypass RLS by granting it to the function owner role.
  The function already has SECURITY DEFINER, so it runs with elevated privileges.

  ## Changes
  - Grant SELECT on plans and company_plans tables to bypass RLS in SECURITY DEFINER functions
*/

-- Grant permissions to the authenticated role to read from these tables
-- when called from SECURITY DEFINER functions
GRANT SELECT ON plans TO authenticated;
GRANT SELECT ON company_plans TO authenticated;

-- Recreate the function to ensure it can read the tables
DROP FUNCTION IF EXISTS public.check_ai_usage_limit(uuid);

CREATE OR REPLACE FUNCTION public.check_ai_usage_limit(company_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  ai_is_enabled boolean;
  ai_limit integer;
  current_usage integer;
  current_month text;
  plan_record RECORD;
BEGIN
  -- First, try to get limits from assigned plan (bypass RLS with direct query)
  BEGIN
    SELECT 
      p.ai_enabled,
      p.ai_monthly_limit
    INTO ai_is_enabled, ai_limit
    FROM company_plans cp
    JOIN plans p ON p.id = cp.plan_id
    WHERE cp.company_id = company_id_param;
  EXCEPTION
    WHEN OTHERS THEN
      -- If plan query fails, set to null to fall back
      ai_is_enabled := NULL;
      ai_limit := NULL;
  END;

  -- If no plan assigned, fall back to company_ai_settings
  IF ai_is_enabled IS NULL THEN
    SELECT 
      ai_enabled,
      monthly_analysis_limit
    INTO ai_is_enabled, ai_limit
    FROM company_ai_settings
    WHERE company_id = company_id_param;
    
    -- If still not found or AI is disabled, return false
    IF NOT FOUND OR NOT ai_is_enabled THEN
      RETURN false;
    END IF;
  END IF;

  -- If AI is not enabled in the plan, return false
  IF NOT ai_is_enabled THEN
    RETURN false;
  END IF;

  current_month := to_char(CURRENT_DATE, 'YYYY-MM');

  -- Get current usage for this month
  SELECT COALESCE(analysis_count, 0) INTO current_usage
  FROM ai_usage_tracking
  WHERE company_id = company_id_param
  AND month = current_month;

  -- Return true if under limit
  RETURN current_usage < ai_limit;
END;
$$;