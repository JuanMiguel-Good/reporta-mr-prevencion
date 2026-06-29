/*
  # Fix RLS for Multi-Company Managers

  This migration updates RLS policies to properly support multi-company managers.
  
  ## Changes
  
  1. Updates user policies to allow multi-company managers to access all their records
     - Checks if user's DNI matches AND is_multi_company_manager = true
     - Falls back to standard auth.uid() = id check for regular users
  
  2. Ensures multi-company managers can:
     - View all their user records across companies
     - Update their profile information
     - Access data from all their assigned companies
*/

-- Drop existing user policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Create new policies that support multi-company managers
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (
    -- Standard case: user's auth ID matches record ID
    auth.uid() = id
    OR
    -- Multi-company manager case: auth user's DNI matches record DNI
    (
      is_multi_company_manager = true
      AND dni IN (
        SELECT u.dni 
        FROM users u 
        WHERE u.id = auth.uid() 
        AND u.is_multi_company_manager = true
      )
    )
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR
    (
      is_multi_company_manager = true
      AND dni IN (
        SELECT u.dni 
        FROM users u 
        WHERE u.id = auth.uid() 
        AND u.is_multi_company_manager = true
      )
    )
  )
  WITH CHECK (
    auth.uid() = id
    OR
    (
      is_multi_company_manager = true
      AND dni IN (
        SELECT u.dni 
        FROM users u 
        WHERE u.id = auth.uid() 
        AND u.is_multi_company_manager = true
      )
    )
  );

-- Update reports policies to allow multi-company managers to access reports from all their companies
DROP POLICY IF EXISTS "Users can view reports from their company" ON reports;

CREATE POLICY "Users can view reports from their company"
  ON reports FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT u.company_id 
      FROM users u 
      WHERE u.id = auth.uid()
      OR (
        u.is_multi_company_manager = true
        AND u.dni IN (
          SELECT u2.dni 
          FROM users u2 
          WHERE u2.id = auth.uid() 
          AND u2.is_multi_company_manager = true
        )
      )
    )
  );

-- Update other related policies
DROP POLICY IF EXISTS "Users can create reports for their company" ON reports;

CREATE POLICY "Users can create reports for their company"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT u.company_id 
      FROM users u 
      WHERE u.id = auth.uid()
      OR (
        u.is_multi_company_manager = true
        AND u.dni IN (
          SELECT u2.dni 
          FROM users u2 
          WHERE u2.id = auth.uid() 
          AND u2.is_multi_company_manager = true
        )
      )
    )
  );
