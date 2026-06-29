/*
  # Create Areas and Proyectos Configuration Tables

  1. New Tables
    - `areas`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text, unique per company)
      - `active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `proyectos`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text, unique per company)
      - `active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Authenticated users have full access (consistent with categories)

  3. Important Notes
    - Existing area/proyecto values from users table will be migrated
    - Each company gets unique areas and proyectos
    - Soft delete using active flag
*/

-- Create areas table
CREATE TABLE IF NOT EXISTS areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT areas_company_name_unique UNIQUE (company_id, name)
);

-- Create proyectos table
CREATE TABLE IF NOT EXISTS proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT proyectos_company_name_unique UNIQUE (company_id, name)
);

-- Enable RLS
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;

-- Simple policies for authenticated users (consistent with categories table)
CREATE POLICY "authenticated_full_access_areas"
  ON areas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_full_access_proyectos"
  ON proyectos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Migrate existing areas from users table
INSERT INTO areas (company_id, name)
SELECT DISTINCT company_id, area
FROM users
WHERE area IS NOT NULL
  AND area != ''
  AND company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

-- Migrate existing proyectos from users table
INSERT INTO proyectos (company_id, name)
SELECT DISTINCT company_id, proyecto
FROM users
WHERE proyecto IS NOT NULL
  AND proyecto != ''
  AND company_id IS NOT NULL
ON CONFLICT (company_id, name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_areas_company_id ON areas(company_id);
CREATE INDEX IF NOT EXISTS idx_areas_active ON areas(active);
CREATE INDEX IF NOT EXISTS idx_proyectos_company_id ON proyectos(company_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_active ON proyectos(active);
