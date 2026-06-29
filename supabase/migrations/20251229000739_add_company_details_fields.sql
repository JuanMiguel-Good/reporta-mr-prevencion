/*
  # Add Company Details Fields

  1. Changes to `companies` table
    - Add `razon_social` (text) - Legal company name
    - Add `ruc` (text) - Tax identification number (unique)
    - Add `num_trabajadores` (integer) - Number of employees
    - Add `direccion` (text) - Company address
    - Add `distrito` (text) - District
    - Add `provincia` (text) - Province
    - Add `departamento` (text) - Department/State
    - Add `actividad_economica` (text) - Economic activity description
    - Add `logo_url` (text) - Company logo URL

  2. Notes
    - All fields are optional to maintain compatibility with existing records
    - RUC field has a unique constraint since it's a tax ID
    - Logo will be stored in Supabase Storage and URL saved in this field
*/

-- Add new fields to companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'razon_social'
  ) THEN
    ALTER TABLE companies ADD COLUMN razon_social text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'ruc'
  ) THEN
    ALTER TABLE companies ADD COLUMN ruc text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'num_trabajadores'
  ) THEN
    ALTER TABLE companies ADD COLUMN num_trabajadores integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'direccion'
  ) THEN
    ALTER TABLE companies ADD COLUMN direccion text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'distrito'
  ) THEN
    ALTER TABLE companies ADD COLUMN distrito text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'provincia'
  ) THEN
    ALTER TABLE companies ADD COLUMN provincia text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'departamento'
  ) THEN
    ALTER TABLE companies ADD COLUMN departamento text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'actividad_economica'
  ) THEN
    ALTER TABLE companies ADD COLUMN actividad_economica text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE companies ADD COLUMN logo_url text;
  END IF;
END $$;

-- Add unique constraint on RUC if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_ruc_key'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_ruc_key UNIQUE (ruc);
  END IF;
END $$;