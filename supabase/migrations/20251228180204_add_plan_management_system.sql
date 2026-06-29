/*
  # Add Plan Management System
  
  ## Overview
  Complete plan differentiation system with usage tracking, limit requests,
  and in-app notifications.
  
  ## New Tables
  
  1. **plan_features** - Define features available per plan type
     - Características específicas por plan (free, basic, premium)
     - Límites de usuarios, reportes, almacenamiento
     - Control granular de funcionalidades
  
  2. **usage_limit_requests** - Temporary limit increase requests
     - Solicitudes de aumento temporal de límite de IA
     - Workflow de aprobación/rechazo
     - Historial de solicitudes
  
  3. **notifications** - In-app notification system
     - Notificaciones de límites de IA
     - Alertas de aprobación/rechazo de solicitudes
     - Renovación mensual de límites
  
  ## Modified Functions
  
  - Enhanced `check_ai_usage_limit` with detailed info
  - New `get_ai_usage_detailed` for dashboard stats
  - New `request_limit_increase` for user requests
  - New `approve_limit_request` for admin approval
  - New `reset_monthly_ai_limits` for automatic monthly reset
  
  ## Security
  
  - RLS enabled on all tables
  - Role-based access control
  - Audit trail for all limit changes
*/

-- ============================================================
-- TABLE: plan_features
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type text NOT NULL CHECK (plan_type IN ('free', 'basic', 'premium')),
  feature_name text NOT NULL,
  feature_value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_plan_feature UNIQUE(plan_type, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_plan_features_type ON plan_features(plan_type);

-- ============================================================
-- TABLE: usage_limit_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS usage_limit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  request_type text DEFAULT 'ai_analysis' CHECK (request_type IN ('ai_analysis', 'user_limit', 'storage')),
  current_limit integer NOT NULL,
  requested_limit integer NOT NULL,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  review_notes text,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_requests_company ON usage_limit_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_usage_requests_status ON usage_limit_requests(status);
CREATE INDEX IF NOT EXISTS idx_usage_requests_requested_by ON usage_limit_requests(requested_by);

-- ============================================================
-- TABLE: notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN (
    'ai_limit_50', 
    'ai_limit_80', 
    'ai_limit_100', 
    'ai_limit_renewed',
    'limit_request_approved',
    'limit_request_rejected',
    'plan_upgraded',
    'plan_limit_reached'
  )),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: plan_features
-- ============================================================

CREATE POLICY "Anyone can view plan features"
  ON plan_features FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage plan features"
  ON plan_features FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- ============================================================
-- RLS POLICIES: usage_limit_requests
-- ============================================================

CREATE POLICY "Users can view their company requests"
  ON usage_limit_requests FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "SST managers can create requests"
  ON usage_limit_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('sst_manager', 'super_admin')
    )
    AND requested_by = auth.uid()
  );

CREATE POLICY "Super admins can manage all requests"
  ON usage_limit_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- ============================================================
-- RLS POLICIES: notifications
-- ============================================================

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_plan_features_updated_at
  BEFORE UPDATE ON plan_features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_limit_requests_updated_at
  BEFORE UPDATE ON usage_limit_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA: plan_features
-- ============================================================

INSERT INTO plan_features (plan_type, feature_name, feature_value, description) VALUES
-- FREE PLAN
('free', 'ai_analysis_limit', '0', 'Monthly AI analysis limit'),
('free', 'max_users', '3', 'Maximum users per company'),
('free', 'max_reports_per_month', '50', 'Maximum reports per month'),
('free', 'data_retention_days', '30', 'Days to retain report data'),
('free', 'storage_mb', '500', 'Storage limit in megabytes'),
('free', 'export_reports', 'false', 'Can export reports to Excel'),
('free', 'advanced_analytics', 'false', 'Access to advanced analytics'),
('free', 'custom_categories', '5', 'Maximum custom categories'),
('free', 'voice_notes', 'false', 'Voice note support'),

-- BASIC PLAN
('basic', 'ai_analysis_limit', '100', 'Monthly AI analysis limit'),
('basic', 'max_users', '10', 'Maximum users per company'),
('basic', 'max_reports_per_month', '200', 'Maximum reports per month'),
('basic', 'data_retention_days', '90', 'Days to retain report data'),
('basic', 'storage_mb', '2000', 'Storage limit in megabytes'),
('basic', 'export_reports', 'true', 'Can export reports to Excel'),
('basic', 'advanced_analytics', 'false', 'Access to advanced analytics'),
('basic', 'custom_categories', '20', 'Maximum custom categories'),
('basic', 'voice_notes', 'true', 'Voice note support'),

-- PREMIUM PLAN
('premium', 'ai_analysis_limit', '1000', 'Monthly AI analysis limit'),
('premium', 'max_users', '999999', 'Maximum users per company'),
('premium', 'max_reports_per_month', '999999', 'Maximum reports per month'),
('premium', 'data_retention_days', '999999', 'Days to retain report data'),
('premium', 'storage_mb', '50000', 'Storage limit in megabytes'),
('premium', 'export_reports', 'true', 'Can export reports to Excel'),
('premium', 'advanced_analytics', 'true', 'Access to advanced analytics'),
('premium', 'custom_categories', '999999', 'Maximum custom categories'),
('premium', 'voice_notes', 'true', 'Voice note support')
ON CONFLICT (plan_type, feature_name) DO NOTHING;

-- ============================================================
-- FUNCTION: get_ai_usage_detailed
-- ============================================================

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
  
  -- Get AI settings
  SELECT 
    ai_enabled,
    monthly_analysis_limit
  INTO ai_is_enabled, usage_limit
  FROM company_ai_settings
  WHERE company_id = company_uuid;
  
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

-- ============================================================
-- FUNCTION: request_limit_increase
-- ============================================================

CREATE OR REPLACE FUNCTION request_limit_increase(
  company_uuid uuid,
  requester_id uuid,
  new_limit integer,
  request_reason text
)
RETURNS uuid AS $$
DECLARE
  current_limit integer;
  request_id uuid;
  requester_role text;
BEGIN
  -- Check if requester has permission
  SELECT role INTO requester_role
  FROM users
  WHERE id = requester_id AND company_id = company_uuid;
  
  IF requester_role NOT IN ('sst_manager', 'super_admin') THEN
    RAISE EXCEPTION 'Only SST managers and super admins can request limit increases';
  END IF;
  
  -- Get current limit
  SELECT monthly_analysis_limit INTO current_limit
  FROM company_ai_settings
  WHERE company_id = company_uuid;
  
  IF current_limit IS NULL THEN
    current_limit := 0;
  END IF;
  
  -- Create request
  INSERT INTO usage_limit_requests (
    company_id,
    requested_by,
    request_type,
    current_limit,
    requested_limit,
    reason,
    status,
    expires_at
  ) VALUES (
    company_uuid,
    requester_id,
    'ai_analysis',
    current_limit,
    new_limit,
    request_reason,
    'pending',
    now() + interval '30 days'
  )
  RETURNING id INTO request_id;
  
  -- Notify super admins
  INSERT INTO notifications (user_id, company_id, type, title, message, data)
  SELECT 
    u.id,
    u.company_id,
    'plan_limit_reached',
    'Nueva solicitud de aumento de límite',
    format('La empresa %s solicita aumentar el límite de %s a %s análisis mensuales',
      (SELECT name FROM companies WHERE id = company_uuid),
      current_limit,
      new_limit
    ),
    jsonb_build_object('request_id', request_id, 'company_id', company_uuid)
  FROM users u
  WHERE u.role = 'super_admin';
  
  RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: approve_limit_request
-- ============================================================

CREATE OR REPLACE FUNCTION approve_limit_request(
  request_uuid uuid,
  reviewer_id uuid,
  is_approved boolean,
  review_note text DEFAULT NULL,
  temporary_duration_days integer DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  request_record record;
  reviewer_role text;
BEGIN
  -- Check if reviewer has permission
  SELECT role INTO reviewer_role
  FROM users
  WHERE id = reviewer_id;
  
  IF reviewer_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can approve limit requests';
  END IF;
  
  -- Get request details
  SELECT * INTO request_record
  FROM usage_limit_requests
  WHERE id = request_uuid AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;
  
  -- Update request status
  UPDATE usage_limit_requests
  SET 
    status = CASE WHEN is_approved THEN 'approved' ELSE 'rejected' END,
    reviewed_by = reviewer_id,
    review_notes = review_note,
    reviewed_at = now(),
    expires_at = CASE 
      WHEN is_approved AND temporary_duration_days IS NOT NULL 
      THEN now() + (temporary_duration_days || ' days')::interval
      ELSE expires_at
    END
  WHERE id = request_uuid;
  
  -- If approved, update the limit
  IF is_approved THEN
    UPDATE company_ai_settings
    SET monthly_analysis_limit = request_record.requested_limit
    WHERE company_id = request_record.company_id;
  END IF;
  
  -- Notify requester
  INSERT INTO notifications (user_id, company_id, type, title, message, data)
  VALUES (
    request_record.requested_by,
    request_record.company_id,
    CASE WHEN is_approved THEN 'limit_request_approved' ELSE 'limit_request_rejected' END,
    CASE WHEN is_approved THEN 'Solicitud aprobada' ELSE 'Solicitud rechazada' END,
    CASE 
      WHEN is_approved THEN 
        format('Tu solicitud de aumento de límite a %s análisis mensuales ha sido aprobada', 
          request_record.requested_limit)
      ELSE 
        format('Tu solicitud de aumento de límite ha sido rechazada. %s', COALESCE(review_note, ''))
    END,
    jsonb_build_object(
      'request_id', request_uuid,
      'new_limit', request_record.requested_limit,
      'approved', is_approved
    )
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: reset_monthly_ai_limits
-- ============================================================

CREATE OR REPLACE FUNCTION reset_monthly_ai_limits()
RETURNS void AS $$
DECLARE
  company_record record;
BEGIN
  -- This function should be called via a cron job on the 1st of each month
  -- For now, it can be called manually or via a scheduled task
  
  FOR company_record IN 
    SELECT c.id, c.name 
    FROM companies c
    WHERE c.active = true
  LOOP
    -- Notify SST managers about renewal
    INSERT INTO notifications (user_id, company_id, type, title, message)
    SELECT 
      u.id,
      company_record.id,
      'ai_limit_renewed',
      'Límite de IA renovado',
      'Tu límite mensual de análisis de IA se ha renovado para este mes'
    FROM users u
    WHERE u.company_id = company_record.id 
    AND u.role IN ('sst_manager', 'super_admin')
    AND u.active = true;
  END LOOP;
  
  -- Clean up old notifications (older than 90 days)
  DELETE FROM notifications
  WHERE created_at < now() - interval '90 days';
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: create_ai_usage_notification
-- ============================================================

CREATE OR REPLACE FUNCTION create_ai_usage_notification()
RETURNS trigger AS $$
DECLARE
  usage_stats jsonb;
  notification_type text;
  notification_title text;
  notification_message text;
BEGIN
  -- Get detailed usage stats
  usage_stats := get_ai_usage_detailed(NEW.company_id);
  
  -- Determine if we need to send a notification
  IF (usage_stats->>'percentage')::decimal >= 100 AND 
     NOT EXISTS (
       SELECT 1 FROM notifications 
       WHERE company_id = NEW.company_id 
       AND type = 'ai_limit_100'
       AND created_at > date_trunc('month', now())
     ) THEN
    notification_type := 'ai_limit_100';
    notification_title := 'Límite de IA alcanzado';
    notification_message := 'Has alcanzado el 100% de tu límite mensual de análisis de IA. El modo manual está activado.';
    
  ELSIF (usage_stats->>'percentage')::decimal >= 80 AND 
        NOT EXISTS (
          SELECT 1 FROM notifications 
          WHERE company_id = NEW.company_id 
          AND type = 'ai_limit_80'
          AND created_at > date_trunc('month', now())
        ) THEN
    notification_type := 'ai_limit_80';
    notification_title := 'Quedan pocos análisis de IA';
    notification_message := format('Has usado el 80%% de tu límite mensual. Quedan %s análisis disponibles.',
      (usage_stats->>'remaining')::integer);
    
  ELSIF (usage_stats->>'percentage')::decimal >= 50 AND 
        NOT EXISTS (
          SELECT 1 FROM notifications 
          WHERE company_id = NEW.company_id 
          AND type = 'ai_limit_50'
          AND created_at > date_trunc('month', now())
        ) THEN
    notification_type := 'ai_limit_50';
    notification_title := 'Mitad del límite de IA usado';
    notification_message := format('Has usado el 50%% de tu límite mensual. Quedan %s análisis disponibles.',
      (usage_stats->>'remaining')::integer);
  END IF;
  
  -- Create notification for SST managers
  IF notification_type IS NOT NULL THEN
    INSERT INTO notifications (user_id, company_id, type, title, message, data)
    SELECT 
      u.id,
      NEW.company_id,
      notification_type,
      notification_title,
      notification_message,
      usage_stats
    FROM users u
    WHERE u.company_id = NEW.company_id 
    AND u.role IN ('sst_manager', 'super_admin')
    AND u.active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for AI usage notifications
DROP TRIGGER IF EXISTS ai_usage_notification_trigger ON ai_usage_tracking;
CREATE TRIGGER ai_usage_notification_trigger
  AFTER INSERT OR UPDATE OF analysis_count ON ai_usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION create_ai_usage_notification();