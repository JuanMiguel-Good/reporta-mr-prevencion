/*
  # Add WhatsApp Contact Fields to Users Table

  1. Changes
    - Add `whatsapp_country_code` (text) - Country code for WhatsApp number (e.g., '+51', '+1')
    - Add `whatsapp_number` (text) - WhatsApp phone number without country code
    - Both fields are optional for existing users but required for new SST Manager registrations

  2. Purpose
    - Enable WhatsApp contact for SST Managers during company registration
    - Support international phone numbers with country code selection
    - Default to Peru (+51) but allow selection of other countries

  3. Security
    - No RLS changes needed (inherits existing users table policies)
*/

-- Add WhatsApp fields to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'whatsapp_country_code'
  ) THEN
    ALTER TABLE users ADD COLUMN whatsapp_country_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE users ADD COLUMN whatsapp_number text;
  END IF;
END $$;