/*
  # Configure Runtime Settings for Email Queue Processing

  1. Purpose
    - Set PostgreSQL runtime settings for Supabase URL and keys
    - Enable automatic email queue processing via triggers
    - Allow database functions to call Supabase Edge Functions

  2. What it does
    - Stores Supabase URL and service role key in PostgreSQL settings
    - Makes these settings available to triggers and functions
    - Enables immediate email processing instead of waiting for cron jobs

  3. Security
    - Uses SECURITY DEFINER to set settings safely
    - Settings are only accessible within database context
*/

-- Function to configure Supabase settings
CREATE OR REPLACE FUNCTION configure_supabase_settings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set Supabase URL
  PERFORM set_config('app.settings.supabase_url', 'https://yrkjelaleitrfinopdzy.supabase.co', false);
  
  -- Set Supabase Service Role Key
  PERFORM set_config('app.settings.supabase_service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlya2plbGFsZWl0cmZpbm9wZHp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTI4ODM4NCwiZXhwIjoyMDUwODY0Mzg0fQ.Hn2y1Qv4_Ht0dflJ-D8GFJT_ykJoYFRk6pYST_N1wSg', false);
END;
$$;

-- Execute configuration
SELECT configure_supabase_settings();
