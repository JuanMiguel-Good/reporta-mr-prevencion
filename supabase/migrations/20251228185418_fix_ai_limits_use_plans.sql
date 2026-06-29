/*
  # Fix AI Limits to Use Assigned Plans

  ## Changes Made

  1. **Updated `check_ai_usage_limit` function**
     - Now checks the plan assigned to the company through `company_plans`
     - Falls back to `company_ai_settings` if no plan is assigned (backward compatibility)
     - Uses `ai_enabled` and `ai_monthly_limit` from the assigned plan

  2. **Updated `get_ai_usage_detailed` function**
     - Now gets limits from the assigned plan instead of `company_ai_settings`
     - Falls back to `company_ai_settings` if no plan is assigned
     - Provides accurate usage statistics based on the company's plan

  ## Migration Details

  This migration ensures that when a company has an assigned plan, the AI usage
  limits come from that plan rather than from the deprecated `company_ai_settings` table.
*/

-- ============================================================
-- FUNCTION: check_ai_usage_limit (Updated)
-- ============================================================

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

  -- Get current usage for this month
  SELECT COALESCE(analysis_count, 0) INTO current_usage
  FROM ai_usage_tracking
  WHERE company_id = company_id_param
  AND month = current_month;

  -- Return true if under limit
  RETURN current_usage < ai_limit;
END;
$$;

-- ============================================================
-- FUNCTION: get_ai_usage_detailed (Updated)
-- ============================================================

DROP FUNCTION IF EXISTS public.get_ai_usage_detailed(uuid);

CREATE OR REPLACE FUNCTION get_ai_usage_detailed(company_uuid uuid)
RETURNS jsonb AS $$
DECLARE
  current_month text;
  result jsonb;
  usage_count integer;
  usage_limit integer;
  ai_is_enabled boolean;
  usage_percentage decimal;
  days_left integer;
  estimated_daily_usage decimal;
  will_exceed boolean;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  
  -- Get AI settings from assigned plan first
  SELECT 
    p.ai_enabled,
    p.ai_monthly_limit
  INTO ai_is_enabled, usage_limit
  FROM company_plans cp
  JOIN plans p ON p.id = cp.plan_id
  WHERE cp.company_id = company_uuid;
  
  -- If no plan assigned, fall back to company_ai_settings
  IF NOT FOUND THEN
    SELECT 
      ai_enabled,
      monthly_analysis_limit
    INTO ai_is_enabled, usage_limit
    FROM company_ai_settings
    WHERE company_id = company_uuid;
  END IF;
  
  -- Get current usage
  SELECT COALESCE(analysis_count, 0)
  INTO usage_count
  FROM ai_usage_tracking
  WHERE company_id = company_uuid 
  AND month = current_month;
  
  -- Calculate metrics
  IF usage_limit > 0 THEN
    usage_percentage := (usage_count::decimal / usage_limit::decimal) * 100;
  ELSE
    usage_percentage := 100;
  END IF;
  
  days_left := date_part('day', date_trunc('month', now() + interval '1 month') - now())::integer;
  
  IF days_left > 0 AND date_part('day', now()) > 1 THEN
    estimated_daily_usage := usage_count::decimal / date_part('day', now())::decimal;
    will_exceed := (usage_count + (estimated_daily_usage * days_left)) > usage_limit;
  ELSE
    estimated_daily_usage := 0;
    will_exceed := false;
  END IF;
  
  result := jsonb_build_object(
    'enabled', COALESCE(ai_is_enabled, false),
    'current_usage', usage_count,
    'limit', COALESCE(usage_limit, 0),
    'remaining', GREATEST(0, COALESCE(usage_limit, 0) - usage_count),
    'percentage', ROUND(usage_percentage, 2),
    'days_left_in_month', days_left,
    'estimated_daily_usage', ROUND(estimated_daily_usage, 2),
    'will_exceed_at_current_rate', will_exceed,
    'status', CASE
      WHEN NOT COALESCE(ai_is_enabled, false) THEN 'disabled'
      WHEN usage_count >= COALESCE(usage_limit, 0) THEN 'exceeded'
      WHEN usage_percentage >= 80 THEN 'warning'
      WHEN usage_percentage >= 50 THEN 'caution'
      ELSE 'ok'
    END
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;