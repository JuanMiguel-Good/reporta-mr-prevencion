/*
  # Fix Multi-Company Manager Constraints
  
  ## Changes
  1. Remove UNIQUE constraint from email column (allow same email across companies)
  2. Remove UNIQUE constraint from dni column (allow same DNI across companies)
  3. Add composite UNIQUE constraint on (dni, company_id) to prevent duplicate users in same company
  4. This allows multi-company managers to use same DNI/email for multiple companies
  
  ## Security
  - Maintains data integrity by preventing duplicates within same company
  - Enables multi-company access with single authentication
*/

-- Drop existing UNIQUE constraints on email and dni
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_dni_key;

-- Add composite UNIQUE constraint to prevent duplicate DNI in same company
-- This allows same DNI across different companies
ALTER TABLE users ADD CONSTRAINT users_dni_company_unique UNIQUE (dni, company_id);
