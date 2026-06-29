/*
  # Fix Security and Performance Issues

  ## Changes

  1. **Add Missing Indexes for Foreign Keys**
     - Add index on `report_history.changed_by`
     - Add index on `report_photos.uploaded_by`
     - Add index on `reports.category_id`

  2. **Optimize RLS Policies**
     - Replace `auth.uid()` with `(select auth.uid())` to prevent re-evaluation per row
     - Consolidate duplicate policies on `ai_analysis_cache` table

  3. **Remove Unused Indexes**
     - Drop `idx_reports_area`
     - Drop `idx_reports_proyecto`
     - Drop `idx_ai_cache_company`

  4. **Fix Function Search Paths**
     - Set search_path for all functions to prevent role mutable issues
*/

-- ============================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_report_history_changed_by 
  ON public.report_history (changed_by);

CREATE INDEX IF NOT EXISTS idx_report_photos_uploaded_by 
  ON public.report_photos (uploaded_by);

CREATE INDEX IF NOT EXISTS idx_reports_category_id 
  ON public.reports (category_id);

-- ============================================
-- 2. REMOVE UNUSED INDEXES
-- ============================================

DROP INDEX IF EXISTS public.idx_reports_area;
DROP INDEX IF EXISTS public.idx_reports_proyecto;
DROP INDEX IF EXISTS public.idx_ai_cache_company;

-- ============================================
-- 3. OPTIMIZE RLS POLICIES - AI ANALYSIS CACHE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view company AI cache" ON public.ai_analysis_cache;
DROP POLICY IF EXISTS "Users can view company analysis cache" ON public.ai_analysis_cache;
DROP POLICY IF EXISTS "Users can insert AI cache" ON public.ai_analysis_cache;
DROP POLICY IF EXISTS "System can insert analysis cache" ON public.ai_analysis_cache;

-- Create optimized consolidated policies
CREATE POLICY "Users can view company analysis cache"
  ON public.ai_analysis_cache
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE id = (select auth.uid())
    )
    OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Users can insert analysis cache"
  ON public.ai_analysis_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE id = (select auth.uid())
    )
  );

-- ============================================
-- 4. OPTIMIZE RLS POLICIES - AI USAGE TRACKING
-- ============================================

DROP POLICY IF EXISTS "SST managers can view AI usage" ON public.ai_usage_tracking;
DROP POLICY IF EXISTS "System can insert AI usage" ON public.ai_usage_tracking;
DROP POLICY IF EXISTS "System can update AI usage" ON public.ai_usage_tracking;

CREATE POLICY "SST managers can view AI usage"
  ON public.ai_usage_tracking
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('sst_manager', 'super_admin')
    )
  );

CREATE POLICY "System can insert AI usage"
  ON public.ai_usage_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE id = (select auth.uid())
    )
  );

CREATE POLICY "System can update AI usage"
  ON public.ai_usage_tracking
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE id = (select auth.uid())
    )
  );

-- ============================================
-- 5. OPTIMIZE RLS POLICIES - COMPANY AI SETTINGS
-- ============================================

DROP POLICY IF EXISTS "Users can view company AI settings" ON public.company_ai_settings;
DROP POLICY IF EXISTS "SST managers can update AI settings" ON public.company_ai_settings;
DROP POLICY IF EXISTS "System can insert AI settings" ON public.company_ai_settings;

CREATE POLICY "Users can view company AI settings"
  ON public.company_ai_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "SST managers can update AI settings"
  ON public.company_ai_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE id = (select auth.uid()) 
      AND role IN ('sst_manager', 'super_admin')
    )
  );

CREATE POLICY "System can insert AI settings"
  ON public.company_ai_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE id = (select auth.uid())
    )
  );

-- ============================================
-- 6. FIX FUNCTION SEARCH PATHS
-- ============================================

-- Drop and recreate get_email_from_dni
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
  SELECT email INTO user_email
  FROM public.users
  WHERE dni = user_dni
  LIMIT 1;
  
  RETURN user_email;
END;
$$;

-- Drop and recreate track_report_status_change
DROP FUNCTION IF EXISTS public.track_report_status_change() CASCADE;
CREATE FUNCTION public.track_report_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.report_history (report_id, changed_by, previous_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER track_report_status_changes
  AFTER UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.track_report_status_change();

-- Drop and recreate set_main_photo_if_first
DROP FUNCTION IF EXISTS public.set_main_photo_if_first() CASCADE;
CREATE FUNCTION public.set_main_photo_if_first()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.report_photos 
    WHERE report_id = NEW.report_id 
    AND id != NEW.id
  ) THEN
    NEW.is_main := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER set_first_photo_as_main
  BEFORE INSERT ON public.report_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_main_photo_if_first();

-- Drop and recreate update_updated_at_column
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Drop and recreate get_user_role
DROP FUNCTION IF EXISTS public.get_user_role();
CREATE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN user_role;
END;
$$;

-- Drop and recreate get_user_company
DROP FUNCTION IF EXISTS public.get_user_company();
CREATE FUNCTION public.get_user_company()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_company uuid;
BEGIN
  SELECT company_id INTO user_company
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN user_company;
END;
$$;

-- Drop and recreate create_default_categories
DROP FUNCTION IF EXISTS public.create_default_categories(uuid);
CREATE FUNCTION public.create_default_categories(company_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.categories (company_id, name, description, display_order)
  VALUES
    (company_id_param, 'Orden y Limpieza', 'Problemas relacionados con orden y limpieza', 1),
    (company_id_param, 'EPP', 'Equipos de protección personal', 2),
    (company_id_param, 'Maquinaria', 'Condiciones inseguras en maquinaria', 3),
    (company_id_param, 'Instalaciones', 'Problemas en instalaciones', 4),
    (company_id_param, 'Ergonomía', 'Problemas ergonómicos', 5),
    (company_id_param, 'Otro', 'Otras condiciones inseguras', 6);
END;
$$;

-- Drop and recreate trigger_create_default_categories
DROP FUNCTION IF EXISTS public.trigger_create_default_categories() CASCADE;
CREATE FUNCTION public.trigger_create_default_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.create_default_categories(NEW.id);
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER create_default_categories_on_company
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_default_categories();

-- Drop and recreate auto_change_status_on_evidence
DROP FUNCTION IF EXISTS public.auto_change_status_on_evidence() CASCADE;
CREATE FUNCTION public.auto_change_status_on_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_evidence = true THEN
    UPDATE public.reports
    SET status = 'in_review'
    WHERE id = NEW.report_id
    AND status = 'assigned';
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER auto_status_change_on_evidence
  AFTER INSERT OR UPDATE ON public.report_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_change_status_on_evidence();

-- Drop and recreate check_ai_usage_limit
DROP FUNCTION IF EXISTS public.check_ai_usage_limit(uuid);
CREATE FUNCTION public.check_ai_usage_limit(company_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  settings_record RECORD;
  current_usage integer;
  current_month text;
BEGIN
  SELECT * INTO settings_record
  FROM public.company_ai_settings
  WHERE company_id = company_id_param;

  IF NOT FOUND OR NOT settings_record.ai_enabled THEN
    RETURN false;
  END IF;

  current_month := to_char(CURRENT_DATE, 'YYYY-MM');

  SELECT COALESCE(analysis_count, 0) INTO current_usage
  FROM public.ai_usage_tracking
  WHERE company_id = company_id_param
  AND month = current_month;

  RETURN current_usage < settings_record.monthly_analysis_limit;
END;
$$;

-- Drop and recreate increment_ai_usage
DROP FUNCTION IF EXISTS public.increment_ai_usage(uuid, numeric);
CREATE FUNCTION public.increment_ai_usage(company_id_param uuid, cost_param numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_month text;
BEGIN
  current_month := to_char(CURRENT_DATE, 'YYYY-MM');

  INSERT INTO public.ai_usage_tracking (company_id, month, analysis_count, total_cost)
  VALUES (company_id_param, current_month, 1, cost_param)
  ON CONFLICT (company_id, month)
  DO UPDATE SET
    analysis_count = ai_usage_tracking.analysis_count + 1,
    total_cost = ai_usage_tracking.total_cost + cost_param;
END;
$$;
