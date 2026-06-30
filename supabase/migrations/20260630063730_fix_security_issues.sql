-- ============================================================
-- 1. Enable RLS on tables that have policies but RLS disabled
-- ============================================================
ALTER TABLE public.company_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Fix mutable search_path on all listed functions
--    SET search_path = '' prevents search_path injection attacks
-- ============================================================
ALTER FUNCTION public.approve_limit_request(uuid, uuid, boolean, text, integer)
  SET search_path = '';

ALTER FUNCTION public.auto_change_status_on_evidence()
  SET search_path = '';

ALTER FUNCTION public.check_ai_usage_limit(uuid)
  SET search_path = '';

ALTER FUNCTION public.create_ai_usage_notification()
  SET search_path = '';

ALTER FUNCTION public.create_default_categories(uuid)
  SET search_path = '';

ALTER FUNCTION public.get_ai_usage_detailed(uuid)
  SET search_path = '';

ALTER FUNCTION public.get_companies_for_dni(text)
  SET search_path = '';

ALTER FUNCTION public.get_email_from_dni(text)
  SET search_path = '';

ALTER FUNCTION public.get_user_company()
  SET search_path = '';

ALTER FUNCTION public.get_user_role()
  SET search_path = '';

ALTER FUNCTION public.increment_ai_usage(uuid, numeric)
  SET search_path = '';

ALTER FUNCTION public.is_multi_company_dni(text)
  SET search_path = '';

ALTER FUNCTION public.notify_evidence_uploaded()
  SET search_path = '';

ALTER FUNCTION public.notify_report_created()
  SET search_path = '';

ALTER FUNCTION public.notify_report_status_changed()
  SET search_path = '';

ALTER FUNCTION public.notify_responsible_assigned()
  SET search_path = '';

ALTER FUNCTION public.notify_user(uuid, text, text, jsonb)
  SET search_path = '';

ALTER FUNCTION public.request_limit_increase(uuid, uuid, integer, text)
  SET search_path = '';

ALTER FUNCTION public.reset_monthly_ai_limits()
  SET search_path = '';

ALTER FUNCTION public.set_main_photo_if_first()
  SET search_path = '';

ALTER FUNCTION public.sync_multi_company_manager_data(text, text, text)
  SET search_path = '';

ALTER FUNCTION public.track_report_status_change()
  SET search_path = '';

ALTER FUNCTION public.trigger_create_default_categories()
  SET search_path = '';

ALTER FUNCTION public.trigger_send_push_notification()
  SET search_path = '';

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = '';

-- ============================================================
-- 3. Revoke EXECUTE from anon on all SECURITY DEFINER functions
--    except login-flow lookups (get_email_from_dni,
--    get_companies_for_dni, is_multi_company_dni) which are
--    called before authentication.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.approve_limit_request(uuid, uuid, boolean, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_change_status_on_evidence() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_ai_usage_limit(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_ai_usage_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_default_categories(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_ai_usage_detailed(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_company() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_ai_usage(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_evidence_uploaded() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_report_created() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_report_status_changed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_responsible_assigned() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_limit_increase(uuid, uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_ai_limits() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_main_photo_if_first() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_multi_company_manager_data(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.track_report_status_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_create_default_categories() FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_send_push_notification() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;

-- ============================================================
-- 4. Revoke EXECUTE from authenticated on trigger/internal
--    functions that should only fire via DB triggers or
--    service_role cron jobs — not direct user RPC calls.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.auto_change_status_on_evidence() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_ai_usage_notification() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_evidence_uploaded() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_report_created() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_report_status_changed() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_responsible_assigned() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_monthly_ai_limits() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_main_photo_if_first() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.track_report_status_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_create_default_categories() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_send_push_notification() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
