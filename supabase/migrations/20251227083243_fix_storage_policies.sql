/*
  # Fix Storage RLS Policies

  ## Changes
  
  1. **Update storage policies** to use helper function instead of subquery
     - Simplifies policy checks
     - Improves performance
     - Prevents RLS issues
  
  2. **Policy Updates**
     - Users can upload to their company folder
     - Uses `get_user_company()` function for cleaner checks
  
  ## Security
  - Maintains same security level
  - Authenticated users can only upload to their company folder
*/

-- Drop all existing storage policies
DROP POLICY IF EXISTS "Users can upload report photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view photos from their company" ON storage.objects;
DROP POLICY IF EXISTS "Public can view report photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Users can view voice notes from their company" ON storage.objects;

-- Recreate storage policies for report-photos with simplified checks
CREATE POLICY "Users can upload report photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'report-photos'
    AND (storage.foldername(name))[1] = get_user_company()::text
  );

CREATE POLICY "Users can view photos from their company"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'report-photos'
    AND (storage.foldername(name))[1] = get_user_company()::text
  );

CREATE POLICY "Public can view report photos"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'report-photos');

-- Recreate storage policies for voice-notes
CREATE POLICY "Users can upload voice notes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = get_user_company()::text
  );

CREATE POLICY "Users can view voice notes from their company"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = get_user_company()::text
  );
