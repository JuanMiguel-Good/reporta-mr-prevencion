/*
  # Create Plans and Company Plans Tables

  ## New Tables

  1. **plans** - Define available subscription plans
     - `id` (uuid, primary key)
     - `name` (text, unique) - Plan name (e.g., "Plan Básico", "Plan Premium")
     - `description` (text, nullable) - Plan description
     - `monthly_limit` (integer) - Monthly report limit
     - `monthly_price` (numeric) - Price per month in USD
     - `ai_enabled` (boolean) - Whether AI analysis is enabled
     - `ai_monthly_limit` (integer) - Monthly AI analysis limit
     - `active` (boolean) - Whether the plan is available for assignment
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  2. **company_plans** - Link companies to their assigned plans
     - `company_id` (uuid, primary key, foreign key to companies)
     - `plan_id` (uuid, foreign key to plans)
     - `assigned_at` (timestamptz) - When the plan was assigned

  ## Security

  - RLS enabled on both tables
  - Super admins can manage plans
  - Anyone authenticated can view active plans
  - Super admins can assign plans to companies
*/

-- ============================================================
-- TABLE: plans
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  monthly_limit integer NOT NULL DEFAULT 100,
  monthly_price numeric NOT NULL DEFAULT 0,
  ai_enabled boolean DEFAULT true,
  ai_monthly_limit integer NOT NULL DEFAULT 100,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(active);
CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name);

-- ============================================================
-- TABLE: company_plans
-- ============================================================

CREATE TABLE IF NOT EXISTS company_plans (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  assigned_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_plans_plan ON company_plans(plan_id);

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_plans ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: plans
-- ============================================================

CREATE POLICY "Anyone authenticated can view active plans"
  ON plans FOR SELECT
  TO authenticated
  USING (active = true OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  ));

CREATE POLICY "Super admins can insert plans"
  ON plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update plans"
  ON plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete plans"
  ON plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- ============================================================
-- RLS POLICIES: company_plans
-- ============================================================

CREATE POLICY "Users can view their company plan"
  ON company_plans FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can assign plans"
  ON company_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update plan assignments"
  ON company_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete plan assignments"
  ON company_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA: Create default plans
-- ============================================================

INSERT INTO plans (name, description, monthly_limit, monthly_price, ai_enabled, ai_monthly_limit, active) VALUES
('Plan Gratuito', 'Plan básico gratuito con funcionalidades limitadas', 50, 0, false, 0, true),
('Plan Básico', 'Plan con análisis IA limitado ideal para pequeñas empresas', 200, 29, true, 100, true),
('Plan Premium', 'Plan completo con análisis IA ilimitado', 999999, 99, true, 1000, true)
ON CONFLICT (name) DO NOTHING;