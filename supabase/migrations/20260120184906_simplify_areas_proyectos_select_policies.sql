/*
  # Simplify Areas and Proyectos SELECT policies

  ## Changes
  1. Make SELECT policies more permissive to allow viewing areas/proyectos
  2. Trust the frontend to filter by correct company_id
  
  ## Security
  - Users can only see areas/proyectos from companies they have access to
  - Insert/Update/Delete policies remain strict
*/

-- Drop and recreate SELECT policies with better logic
DROP POLICY IF EXISTS "Users can view areas from their company" ON areas;
DROP POLICY IF EXISTS "Users can view proyectos from their company" ON proyectos;

-- Areas SELECT policy
CREATE POLICY "Users can view areas from their company"
  ON areas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = areas.company_id
      AND users.active = true
    )
  );

-- Proyectos SELECT policy  
CREATE POLICY "Users can view proyectos from their company"
  ON proyectos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.company_id = proyectos.company_id
      AND users.active = true
    )
  );
