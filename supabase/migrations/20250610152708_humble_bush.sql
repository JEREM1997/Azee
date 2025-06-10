/*
  # Fix Donut Forms Creation

  1. Changes
    - Ensure proper RLS policies for donut_forms table
    - Fix any potential issues with the donut_forms table structure
    - Add proper constraints and defaults
    
  2. Security
    - Maintain existing RLS
    - Ensure admin users can properly create and manage forms
*/

-- First, drop all existing policies for donut_forms to avoid conflicts
DO $$ 
BEGIN
  -- Drop all policies on donut_forms
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'donut_forms' AND schemaname = 'public') LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON donut_forms';
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;

-- Create clean policies for donut_forms
CREATE POLICY "donut_forms_admin_access"
  ON donut_forms FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "donut_forms_read_access"
  ON donut_forms FOR SELECT TO authenticated
  USING (true);

-- Ensure the table has the correct structure
DO $$
BEGIN
  -- Make sure is_active has a default value
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'donut_forms' AND column_name = 'is_active'
    AND column_default IS NULL
  ) THEN
    ALTER TABLE donut_forms ALTER COLUMN is_active SET DEFAULT true;
  END IF;

  -- Make sure updated_at has a default value
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'donut_forms' AND column_name = 'updated_at'
    AND column_default IS NULL
  ) THEN
    ALTER TABLE donut_forms ALTER COLUMN updated_at SET DEFAULT now();
  END IF;
END $$;

-- Ensure the update_updated_at_column trigger exists and is properly attached
DO $$
BEGIN
  -- Create the function if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;

  -- Create the trigger if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_donut_forms_updated_at'
  ) THEN
    CREATE TRIGGER update_donut_forms_updated_at
    BEFORE UPDATE ON donut_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Grant necessary permissions
GRANT ALL ON donut_forms TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;