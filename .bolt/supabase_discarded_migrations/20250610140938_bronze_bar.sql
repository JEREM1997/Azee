/*
  # Fix duplicate RLS policies

  1. Changes
    - Drop all existing policies safely
    - Recreate policies with proper names
    - Ensure no duplicates exist
    
  2. Security
    - Maintain proper RLS on all tables
    - Admin users get full access
    - All authenticated users get read access
*/

-- Drop all existing policies safely (ignore errors if they don't exist)
DO $$ 
BEGIN
  -- Drop store policies
  DROP POLICY IF EXISTS "Admin users have full access to stores" ON stores;
  DROP POLICY IF EXISTS "Allow authenticated users to read stores" ON stores;
  DROP POLICY IF EXISTS "Authenticated users can read stores" ON stores;
  DROP POLICY IF EXISTS "admin_full_access_stores" ON stores;
  DROP POLICY IF EXISTS "read_access_stores" ON stores;
  
  -- Drop donut varieties policies
  DROP POLICY IF EXISTS "Admin users have full access to donut varieties" ON donut_varieties;
  DROP POLICY IF EXISTS "Allow authenticated users to read donut varieties" ON donut_varieties;
  DROP POLICY IF EXISTS "Authenticated users can read donut varieties" ON donut_varieties;
  DROP POLICY IF EXISTS "admin_full_access_varieties" ON donut_varieties;
  DROP POLICY IF EXISTS "read_access_varieties" ON donut_varieties;
  
  -- Drop donut forms policies
  DROP POLICY IF EXISTS "Admin users have full access to donut forms" ON donut_forms;
  DROP POLICY IF EXISTS "Allow authenticated users to read donut forms" ON donut_forms;
  DROP POLICY IF EXISTS "Authenticated users can read donut forms" ON donut_forms;
  DROP POLICY IF EXISTS "admin_full_access_forms" ON donut_forms;
  DROP POLICY IF EXISTS "read_access_forms" ON donut_forms;
  
  -- Drop box configurations policies
  DROP POLICY IF EXISTS "Admin users have full access to box configurations" ON box_configurations;
  DROP POLICY IF EXISTS "Allow authenticated users to read box configurations" ON box_configurations;
  DROP POLICY IF EXISTS "Authenticated users can read box configurations" ON box_configurations;
  DROP POLICY IF EXISTS "admin_full_access_boxes" ON box_configurations;
  DROP POLICY IF EXISTS "read_access_boxes" ON box_configurations;
  
  -- Drop box varieties policies
  DROP POLICY IF EXISTS "Admin users have full access to box varieties" ON box_varieties;
  DROP POLICY IF EXISTS "Allow authenticated users to read box varieties" ON box_varieties;
  DROP POLICY IF EXISTS "Authenticated users can read box varieties" ON box_varieties;
END $$;

-- Ensure RLS is enabled
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_varieties ENABLE ROW LEVEL SECURITY;

-- Create new policies with unique names
CREATE POLICY "stores_admin_access"
  ON stores FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "stores_read_access"
  ON stores FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "varieties_admin_access"
  ON donut_varieties FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "varieties_read_access"
  ON donut_varieties FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "forms_admin_access"
  ON donut_forms FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "forms_read_access"
  ON donut_forms FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "boxes_admin_access"
  ON box_configurations FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "boxes_read_access"
  ON box_configurations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "box_varieties_admin_access"
  ON box_varieties FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "box_varieties_read_access"
  ON box_varieties FOR SELECT TO authenticated
  USING (true);