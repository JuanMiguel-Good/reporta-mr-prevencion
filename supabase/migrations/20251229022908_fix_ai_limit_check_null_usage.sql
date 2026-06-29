/*
  # Fix AI Limit Check for NULL Usage

  ## Problem
  When a company has no usage records for the current month in `ai_usage_tracking`,
  the `check_ai_usage_limit` function returns NULL instead of allowing AI usage.
  This prevents companies with valid plans from using AI analysis.

  ## Solution
  Initialize `current_usage` to 0 before querying, so that if no record exists,
  the function correctly returns true (allowing AI usage).

  ## Changes
  - Update `check_ai_usage_limit` function to initialize current_usage to 0
*/

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
BEGIN
  -- First, try to get limits from assigned plan
  SELECT 
    p.ai_enabled,
    p.ai_monthly_limit
  INTO ai_is_enabled, ai_limit
  FROM company_plans cp
  JOIN plans p ON p.id = cp.plan_id
  WHERE cp.company_id = company_id_param;

  -- If no plan assigned, fall back to company_ai_settings
  IF NOT FOUND THEN
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
  
  -- Initialize current_usage to 0
  current_usage := 0;

  -- Get current usage for this month (if exists)
  SELECT COALESCE(analysis_count, 0) INTO current_usage
  FROM ai_usage_tracking
  WHERE company_id = company_id_param
  AND month = current_month;

  -- If no record found, current_usage remains 0
  IF NOT FOUND THEN
    current_usage := 0;
  END IF;

  -- Return true if under limit
  RETURN current_usage < ai_limit;
END;
$$;
