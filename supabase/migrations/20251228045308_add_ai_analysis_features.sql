/*
  # Add AI Analysis Features

  ## Overview
  This migration adds support for AI-powered image analysis using OpenAI GPT-4 Vision.
  It includes caching, usage tracking, and company-level AI settings.

  ## New Tables
  
  1. **ai_analysis_cache** - Cache AI analysis results to avoid reanalyzing identical images
     - `id` (uuid, primary key)
     - `company_id` (uuid, references companies)
     - `image_hash` (text, unique) - SHA-256 hash of image for deduplication
     - `analysis_result` (jsonb) - Complete AI analysis result
     - `confidence_score` (decimal) - AI confidence level (0.0-1.0)
     - `created_at` (timestamptz)
  
  2. **ai_usage_tracking** - Track monthly AI usage per company
     - `id` (uuid, primary key)
     - `company_id` (uuid, references companies)
     - `month` (text) - Format: YYYY-MM
     - `analysis_count` (integer) - Number of analyses performed
     - `total_cost` (decimal) - Estimated cost in USD
     - `created_at` (timestamptz)
     - Unique constraint on (company_id, month)
  
  3. **company_ai_settings** - AI configuration per company
     - `id` (uuid, primary key)
     - `company_id` (uuid, references companies, unique)
     - `ai_enabled` (boolean) - Enable/disable AI analysis
     - `monthly_analysis_limit` (integer) - Max analyses per month
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  ## Modified Tables
  
  **reports** - Add AI-related columns
    - `ai_analysis` (jsonb) - Stored AI analysis result
    - `ai_confidence_score` (decimal) - Confidence level
    - `manual_override` (boolean) - User manually edited AI suggestions

  ## Security
  
  - Enable RLS on all new tables
  - Users can view AI cache for their company
  - Only SST managers can view usage tracking
  - Users can view their company's AI settings
  - SST managers can update AI settings

  ## Helper Functions
  
  - `check_ai_usage_limit` - Verify if company can use AI analysis
  - `increment_ai_usage` - Track AI usage after analysis
*/

-- Create ai_analysis_cache table
CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  image_hash text UNIQUE NOT NULL,
  analysis_result jsonb NOT NULL,
  confidence_score decimal(3,2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_company ON ai_analysis_cache(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON ai_analysis_cache(image_hash);

-- Create ai_usage_tracking table
CREATE TABLE IF NOT EXISTS ai_usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  month text NOT NULL,
  analysis_count integer DEFAULT 0,
  total_cost decimal(10,4) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_company_month UNIQUE(company_id, month)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_company_month ON ai_usage_tracking(company_id, month);

-- Create company_ai_settings table
CREATE TABLE IF NOT EXISTS company_ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE UNIQUE NOT NULL,
  ai_enabled boolean DEFAULT true,
  monthly_analysis_limit integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add AI columns to reports table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reports' AND column_name = 'ai_analysis'
  ) THEN
    ALTER TABLE reports ADD COLUMN ai_analysis jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reports' AND column_name = 'ai_confidence_score'
  ) THEN
    ALTER TABLE reports ADD COLUMN ai_confidence_score decimal(3,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reports' AND column_name = 'manual_override'
  ) THEN
    ALTER TABLE reports ADD COLUMN manual_override boolean DEFAULT false;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_ai_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_analysis_cache
CREATE POLICY "Users can view company AI cache"
  ON ai_analysis_cache FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert AI cache"
  ON ai_analysis_cache FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- RLS Policies for ai_usage_tracking
CREATE POLICY "SST managers can view AI usage"
  ON ai_usage_tracking FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('sst_manager', 'super_admin')
    )
  );

CREATE POLICY "System can insert AI usage"
  ON ai_usage_tracking FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "System can update AI usage"
  ON ai_usage_tracking FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- RLS Policies for company_ai_settings
CREATE POLICY "Users can view company AI settings"
  ON company_ai_settings FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "SST managers can update AI settings"
  ON company_ai_settings FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('sst_manager', 'super_admin')
    )
  );

CREATE POLICY "System can insert AI settings"
  ON company_ai_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('sst_manager', 'super_admin')
    )
  );

-- Initialize AI settings for all existing companies
INSERT INTO company_ai_settings (company_id, ai_enabled, monthly_analysis_limit)
SELECT 
  id,
  CASE 
    WHEN plan_type = 'free' THEN false
    ELSE true
  END,
  CASE 
    WHEN plan_type = 'free' THEN 0
    WHEN plan_type = 'basic' THEN 100
    WHEN plan_type = 'premium' THEN 1000
    ELSE 100
  END
FROM companies
WHERE id NOT IN (SELECT company_id FROM company_ai_settings);

-- Helper function: Check if company can use AI analysis
CREATE OR REPLACE FUNCTION check_ai_usage_limit(company_uuid uuid)
RETURNS boolean AS $$
DECLARE
  current_month text;
  current_usage integer;
  usage_limit integer;
  ai_is_enabled boolean;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  
  -- Check if AI is enabled for this company
  SELECT ai_enabled INTO ai_is_enabled
  FROM company_ai_settings
  WHERE company_id = company_uuid;
  
  IF NOT ai_is_enabled OR ai_is_enabled IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get current usage
  SELECT analysis_count INTO current_usage
  FROM ai_usage_tracking
  WHERE company_id = company_uuid AND month = current_month;
  
  IF current_usage IS NULL THEN
    current_usage := 0;
  END IF;
  
  -- Get usage limit
  SELECT monthly_analysis_limit INTO usage_limit
  FROM company_ai_settings
  WHERE company_id = company_uuid;
  
  IF usage_limit IS NULL THEN
    usage_limit := 0;
  END IF;
  
  RETURN current_usage < usage_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Increment AI usage tracking
CREATE OR REPLACE FUNCTION increment_ai_usage(
  company_uuid uuid,
  cost_estimate decimal DEFAULT 0.015
)
RETURNS void AS $$
DECLARE
  current_month text;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  
  INSERT INTO ai_usage_tracking (company_id, month, analysis_count, total_cost)
  VALUES (company_uuid, current_month, 1, cost_estimate)
  ON CONFLICT (company_id, month) 
  DO UPDATE SET 
    analysis_count = ai_usage_tracking.analysis_count + 1,
    total_cost = ai_usage_tracking.total_cost + cost_estimate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;