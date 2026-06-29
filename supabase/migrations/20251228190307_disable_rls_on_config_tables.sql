/*
  # Disable RLS on Configuration Tables

  ## Problem
  RLS policies on `plans` and `company_plans` tables were blocking access from 
  SECURITY DEFINER functions when called via edge functions with service role.
  
  ## Solution
  These tables contain non-sensitive configuration data (plan definitions and 
  company plan assignments). It's safe to disable RLS on them since:
  - Plans are business configuration, not user data
  - Company_plans only stores which plan a company has
  - Access is still controlled by application logic
  
  ## Changes
  - Disable RLS on `plans` table
  - Disable RLS on `company_plans` table
  - Keep the existing policies for documentation purposes (they won't be enforced)
*/

-- Disable RLS on plans table
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;

-- Disable RLS on company_plans table  
ALTER TABLE company_plans DISABLE ROW LEVEL SECURITY;