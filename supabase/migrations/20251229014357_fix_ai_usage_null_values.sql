/*
  # Fix AI Usage Null Values
  
  ## Problem
  The `get_ai_usage_detailed` function can return null values for `percentage` 
  and `estimated_daily_usage` when:
  - No plan is assigned to a company
  - No company_ai_settings exist
  - Mathematical operations with NULL return NULL
  
  ## Solution
  Add COALESCE to ensure all numeric values are never NULL.
  This prevents JavaScript errors when calling .toFixed() on null values.
  
  ## Changes
  - Update `get_ai_usage_detailed` to use COALESCE on all calculated values
  - Ensure percentage defaults to 0 instead of NULL
  - Ensure estimated_daily_usage defaults to 0 instead of NULL
  - Ensure all other numeric fields have valid defaults
*/

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
  
  -- Ensure defaults for NULL values
  ai_is_enabled := COALESCE(ai_is_enabled, false);
  usage_limit := COALESCE(usage_limit, 0);
  
  -- Get current usage
  SELECT COALESCE(analysis_count, 0)
  INTO usage_count
  FROM ai_usage_tracking
  WHERE company_id = company_uuid 
  AND month = current_month;
  
  -- Ensure usage_count is not null
  usage_count := COALESCE(usage_count, 0);
  
  -- Calculate metrics with NULL safety
  IF usage_limit > 0 THEN
    usage_percentage := (usage_count::decimal / usage_limit::decimal) * 100;
  ELSE
    usage_percentage := 0;
  END IF;
  
  days_left := date_part('day', date_trunc('month', now() + interval '1 month') - now())::integer;
  
  IF days_left > 0 AND date_part('day', now()) > 1 THEN
    estimated_daily_usage := usage_count::decimal / date_part('day', now())::decimal;
    will_exceed := (usage_count + (estimated_daily_usage * days_left)) > usage_limit;
  ELSE
    estimated_daily_usage := 0;
    will_exceed := false;
  END IF;
  
  -- Build result with COALESCE on all values to ensure no NULLs
  result := jsonb_build_object(
    'enabled', COALESCE(ai_is_enabled, false),
    'current_usage', COALESCE(usage_count, 0),
    'limit', COALESCE(usage_limit, 0),
    'remaining', GREATEST(0, COALESCE(usage_limit, 0) - COALESCE(usage_count, 0)),
    'percentage', COALESCE(ROUND(usage_percentage, 2), 0),
    'days_left_in_month', COALESCE(days_left, 0),
    'estimated_daily_usage', COALESCE(ROUND(estimated_daily_usage, 2), 0),
    'will_exceed_at_current_rate', COALESCE(will_exceed, false),
    'status', CASE
      WHEN NOT COALESCE(ai_is_enabled, false) THEN 'disabled'
      WHEN COALESCE(usage_count, 0) >= COALESCE(usage_limit, 0) THEN 'exceeded'
      WHEN COALESCE(usage_percentage, 0) >= 80 THEN 'warning'
      WHEN COALESCE(usage_percentage, 0) >= 50 THEN 'caution'
      ELSE 'ok'
    END
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;