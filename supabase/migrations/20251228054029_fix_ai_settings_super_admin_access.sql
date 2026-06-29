/*
  # Fix AI Settings Access for Super Admins
  
  1. Changes
    - Update RLS policy on company_ai_settings to allow super admins to view all company settings
    - This enables super admins to use AI features when impersonating other users
  
  2. Security
    - Super admins can view all company AI settings (needed for impersonation)
    - Regular users can only view their own company's AI settings
    - Only SST managers and super admins can update settings
*/

DROP POLICY IF EXISTS "Users can view company AI settings" ON company_ai_settings;

CREATE POLICY "Users can view company AI settings"
  ON company_ai_settings
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
