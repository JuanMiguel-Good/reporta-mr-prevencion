/*
  # Fix AI Cache Access for Super Admins
  
  1. Changes
    - Update RLS policy on ai_analysis_cache to allow super admins to access all cached analyses
    - This enables super admins to use AI features when impersonating other users
  
  2. Security
    - Super admins can view all cached analyses (needed for impersonation)
    - Regular users can only view their own company's cached analyses
*/

DROP POLICY IF EXISTS "Users can view company analysis cache" ON ai_analysis_cache;

CREATE POLICY "Users can view company analysis cache"
  ON ai_analysis_cache
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "System can insert analysis cache" ON ai_analysis_cache;

CREATE POLICY "System can insert analysis cache"
  ON ai_analysis_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM users 
      WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );
