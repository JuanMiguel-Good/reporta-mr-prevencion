/*
  # Create Storage Buckets for Photos and Audio

  ## Storage Buckets
  
  1. **report-photos** - Store all report photos
     - Public access for viewing
     - Upload restricted to authenticated users
  
  2. **voice-notes** - Store voice recordings
     - Private access
     - Upload restricted to authenticated users
  
  3. **evidence-photos** - Store evidence photos uploaded by responsibles
     - Private access within company
     - Upload restricted to responsibles

  ## Security Policies
  - Users can upload files to their company's folders
  - Users can view files from their company
*/

-- Create storage bucket for report photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for voice notes
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-notes', 'voice-notes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for report-photos
CREATE POLICY "Users can upload report photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'report-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view photos from their company"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'report-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Public can view report photos"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'report-photos');

-- Storage policies for voice-notes
CREATE POLICY "Users can upload voice notes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view voice notes from their company"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM users WHERE id = auth.uid()
    )
  );