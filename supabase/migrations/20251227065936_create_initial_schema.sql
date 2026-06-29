/*
  # Initial Database Schema for Safety Report App

  ## New Tables Created
  
  1. **companies** - Store company information
     - `id` (uuid, primary key)
     - `name` (text) - Company name
     - `plan_type` (text) - Subscription plan (free, basic, premium)
     - `max_users` (integer) - Maximum allowed users
     - `active` (boolean) - Company active status
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)
  
  2. **users** - Store user accounts with role-based access
     - `id` (uuid, primary key, references auth.users)
     - `email` (text, unique)
     - `dni` (text, unique) - National ID for login
     - `full_name` (text)
     - `role` (text) - worker, responsible, sst_manager, hr_observer, super_admin
     - `company_id` (uuid, references companies)
     - `active` (boolean)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)
  
  3. **categories** - Configurable categories per company
     - `id` (uuid, primary key)
     - `company_id` (uuid, references companies)
     - `name` (text)
     - `description` (text)
     - `display_order` (integer)
     - `active` (boolean)
     - `created_at` (timestamptz)
  
  4. **reports** - Main safety reports
     - `id` (uuid, primary key)
     - `company_id` (uuid, references companies)
     - `reporter_id` (uuid, references users)
     - `assigned_to_id` (uuid, references users)
     - `type` (text) - unsafe_act or unsafe_condition
     - `category_id` (uuid, references categories)
     - `description` (text)
     - `voice_note_url` (text)
     - `transcription` (text)
     - `proposed_closure` (text)
     - `status` (text) - reported, assigned, in_execution, executed, rejected, closed
     - `priority` (text) - low, medium, high, critical
     - `latitude` (decimal)
     - `longitude` (decimal)
     - `location_address` (text)
     - `rejection_reason` (text)
     - `closed_at` (timestamptz)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)
  
  5. **report_photos** - Multiple photos per report
     - `id` (uuid, primary key)
     - `report_id` (uuid, references reports)
     - `photo_url` (text)
     - `is_main` (boolean) - Main photo to display in gallery
     - `is_evidence` (boolean) - Evidence photo uploaded by responsible
     - `uploaded_by` (uuid, references users)
     - `created_at` (timestamptz)
  
  6. **report_history** - Track all status changes
     - `id` (uuid, primary key)
     - `report_id` (uuid, references reports)
     - `changed_by` (uuid, references users)
     - `previous_status` (text)
     - `new_status` (text)
     - `notes` (text)
     - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies based on user roles and company membership
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan_type text DEFAULT 'basic' CHECK (plan_type IN ('free', 'basic', 'premium')),
  max_users integer DEFAULT 50,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  dni text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('worker', 'responsible', 'sst_manager', 'hr_observer', 'super_admin')),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('unsafe_act', 'unsafe_condition')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  description text NOT NULL,
  voice_note_url text,
  transcription text,
  proposed_closure text,
  status text DEFAULT 'reported' CHECK (status IN ('reported', 'assigned', 'in_execution', 'executed', 'rejected', 'closed')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  location_address text,
  rejection_reason text,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create report_photos table
CREATE TABLE IF NOT EXISTS report_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  is_main boolean DEFAULT false,
  is_evidence boolean DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create report_history table
CREATE TABLE IF NOT EXISTS report_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_dni ON users(dni);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_categories_company ON categories(company_id);
CREATE INDEX IF NOT EXISTS idx_reports_company ON reports(company_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_assigned ON reports(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_report_photos_report ON report_photos(report_id);
CREATE INDEX IF NOT EXISTS idx_report_history_report ON report_history(report_id);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies
CREATE POLICY "Super admins can manage all companies"
  ON companies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM users WHERE users.id = auth.uid()
    )
  );

-- RLS Policies for users
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can view colleagues in their company"
  ON users FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "SST managers can manage users in their company"
  ON users FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'sst_manager'
    )
  );

CREATE POLICY "Super admins can manage all users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- RLS Policies for categories
CREATE POLICY "Users can view categories in their company"
  ON categories FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "SST managers can manage categories in their company"
  ON categories FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'sst_manager'
    )
  );

-- RLS Policies for reports
CREATE POLICY "Users can view reports in their company"
  ON reports FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can create reports in their company"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE users.id = auth.uid()
    )
    AND reporter_id = auth.uid()
  );

CREATE POLICY "SST managers can update reports in their company"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'sst_manager'
    )
  );

CREATE POLICY "Responsibles can update assigned reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    assigned_to_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'responsible'
    )
  );

-- RLS Policies for report_photos
CREATE POLICY "Users can view photos of reports in their company"
  ON report_photos FOR SELECT
  TO authenticated
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      INNER JOIN users u ON u.id = auth.uid()
      WHERE r.company_id = u.company_id
    )
  );

CREATE POLICY "Users can upload photos to reports they create"
  ON report_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    report_id IN (
      SELECT r.id FROM reports r
      WHERE r.reporter_id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Responsibles can upload evidence photos"
  ON report_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    report_id IN (
      SELECT r.id FROM reports r
      WHERE r.assigned_to_id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

-- RLS Policies for report_history
CREATE POLICY "Users can view history of reports in their company"
  ON report_history FOR SELECT
  TO authenticated
  USING (
    report_id IN (
      SELECT r.id FROM reports r
      INNER JOIN users u ON u.id = auth.uid()
      WHERE r.company_id = u.company_id
    )
  );

CREATE POLICY "System can create history entries"
  ON report_history FOR INSERT
  TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();