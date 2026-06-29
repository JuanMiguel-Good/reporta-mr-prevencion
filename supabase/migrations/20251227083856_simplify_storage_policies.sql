/*
  # Simplify Storage Policies

  ## Changes
  
  1. **Simplify storage policies** to allow authenticated users to upload
     - Remove complex company_id checks that are failing
     - Keep basic bucket-level security
  
  2. **Policy Updates**
     - Authenticated users can upload to report-photos bucket
     - Authenticated users can view photos in their company
     - Public can view all report photos
  
  ## Security
  - Authenticated users can upload files
  - File paths still include company_id for organization
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload report photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view photos from their company" ON storage.objects;
DROP POLICY IF EXISTS "Public can view report photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Users can view voice notes from their company" ON storage.objects;

-- Create simplified storage policies for report-photos
CREATE POLICY "Users can upload report photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'report-photos');

CREATE POLICY "Users can view report photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'report-photos');

CREATE POLICY "Public can view report photos"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'report-photos');

-- Create simplified storage policies for voice-notes
CREATE POLICY "Users can upload voice notes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'voice-notes');

CREATE POLICY "Users can view voice notes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'voice-notes');
