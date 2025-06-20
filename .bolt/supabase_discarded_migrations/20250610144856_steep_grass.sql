/*
  # Fix Supabase Permissions Issues

  1. Changes
    - Drop all existing conflicting policies
    - Recreate clean policies with proper permissions
    - Ensure admin users have full access
    - Grant necessary table permissions
    
  2. Security
    - Maintain RLS on all tables
    - Admin users get full access to all admin tables
    - Authenticated users get read access where appropriate
*/

-- First, disable RLS temporarily to clean up
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties DISABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_varieties DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start clean
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on stores
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'stores' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON stores';
    END LOOP;
    
    -- Drop all policies on donut_varieties
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'donut_varieties' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON donut_varieties';
    END LOOP;
    
    -- Drop all policies on donut_forms
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'donut_forms' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON donut_forms';
    END LOOP;
    
    -- Drop all policies on box_configurations
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'box_configurations' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON box_configurations';
    END LOOP;
    
    -- Drop all policies on box_varieties
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'box_varieties' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON box_varieties';
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_varieties ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated role
GRANT ALL ON stores TO authenticated;
GRANT ALL ON donut_varieties TO authenticated;
GRANT ALL ON donut_forms TO authenticated;
GRANT ALL ON box_configurations TO authenticated;
GRANT ALL ON box_varieties TO authenticated;

-- Create new clean policies for stores
CREATE POLICY "stores_read_policy" 
  ON stores FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "stores_admin_policy" 
  ON stores FOR ALL 
  TO authenticated 
  USING (auth.jwt() ->> 'role' = 'admin') 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create new clean policies for donut_varieties
CREATE POLICY "donut_varieties_read_policy" 
  ON donut_varieties FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "donut_varieties_admin_policy" 
  ON donut_varieties FOR ALL 
  TO authenticated 
  USING (auth.jwt() ->> 'role' = 'admin') 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create new clean policies for donut_forms
CREATE POLICY "donut_forms_read_policy" 
  ON donut_forms FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "donut_forms_admin_policy" 
  ON donut_forms FOR ALL 
  TO authenticated 
  USING (auth.jwt() ->> 'role' = 'admin') 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create new clean policies for box_configurations
CREATE POLICY "box_configurations_read_policy" 
  ON box_configurations FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "box_configurations_admin_policy" 
  ON box_configurations FOR ALL 
  TO authenticated 
  USING (auth.jwt() ->> 'role' = 'admin') 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create new clean policies for box_varieties
CREATE POLICY "box_varieties_read_policy" 
  ON box_varieties FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "box_varieties_admin_policy" 
  ON box_varieties FOR ALL 
  TO authenticated 
  USING (auth.jwt() ->> 'role' = 'admin') 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Ensure all sequences have proper permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions on the schema itself
GRANT USAGE ON SCHEMA public TO authenticated;