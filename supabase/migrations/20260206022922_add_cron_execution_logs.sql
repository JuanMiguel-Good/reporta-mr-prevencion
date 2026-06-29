/*
  # Add Cron Job Execution Logging System

  1. New Tables
    - `cron_execution_logs`
      - `id` (uuid, primary key)
      - `job_name` (text) - Name of the cron job (e.g., 'send-daily-reminders')
      - `status` (text) - success, failed, partial
      - `started_at` (timestamptz) - When the job started
      - `completed_at` (timestamptz) - When the job finished
      - `stats` (jsonb) - Statistics about the execution
      - `errors` (jsonb) - Array of errors encountered
      - `created_at` (timestamptz)

    - `cron_company_logs`
      - `id` (uuid, primary key)
      - `execution_id` (uuid) - FK to cron_execution_logs
      - `company_id` (uuid) - FK to companies
      - `company_name` (text)
      - `status` (text) - processed, skipped, failed
      - `pending_reports_count` (integer)
      - `managers_notified` (integer)
      - `emails_queued` (integer)
      - `error_message` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Only super_admin and sst_managers can view logs
*/

-- Create cron_execution_logs table
CREATE TABLE IF NOT EXISTS cron_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  stats jsonb DEFAULT '{}'::jsonb,
  errors jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create cron_company_logs table
CREATE TABLE IF NOT EXISTS cron_company_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES cron_execution_logs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  status text NOT NULL,
  pending_reports_count integer DEFAULT 0,
  managers_notified integer DEFAULT 0,
  emails_queued integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cron_execution_logs_job_name ON cron_execution_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_execution_logs_started_at ON cron_execution_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_company_logs_execution_id ON cron_company_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_cron_company_logs_company_id ON cron_company_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_cron_company_logs_status ON cron_company_logs(status);

-- Enable RLS
ALTER TABLE cron_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_company_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cron_execution_logs
CREATE POLICY "Super admins can view all execution logs"
  ON cron_execution_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'super_admin'
      AND users.active = true
    )
  );

CREATE POLICY "SST managers can view execution logs"
  ON cron_execution_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'sst_manager'
      AND users.active = true
    )
  );

-- RLS Policies for cron_company_logs
CREATE POLICY "Super admins can view all company logs"
  ON cron_company_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'super_admin'
      AND users.active = true
    )
  );

CREATE POLICY "SST managers can view their company logs"
  ON cron_company_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = cron_company_logs.company_id
      AND users.role = 'sst_manager'
      AND users.active = true
    )
  );
