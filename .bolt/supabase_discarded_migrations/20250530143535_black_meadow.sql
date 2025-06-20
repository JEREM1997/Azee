-- First drop all existing policies
DO $$ 
BEGIN
  -- Drop store policies
  DROP POLICY IF EXISTS "Admin users have full access to stores" ON stores;
  DROP POLICY IF EXISTS "Allow authenticated users to read stores" ON stores;
  DROP POLICY IF EXISTS "Admins have full access to stores" ON stores;
  
  -- Drop donut varieties policies
  DROP POLICY IF EXISTS "Admin users have full access to donut varieties" ON donut_varieties;
  DROP POLICY IF EXISTS "Allow authenticated users to read donut varieties" ON donut_varieties;
  DROP POLICY IF EXISTS "Admins have full access to donut varieties" ON donut_varieties;
  
  -- Drop donut forms policies
  DROP POLICY IF EXISTS "Admin users have full access to donut forms" ON donut_forms;
  DROP POLICY IF EXISTS "Allow authenticated users to read donut forms" ON donut_forms;
  DROP POLICY IF EXISTS "Admins have full access to donut forms" ON donut_forms;
  
  -- Drop box configurations policies
  DROP POLICY IF EXISTS "Admin users have full access to box configurations" ON box_configurations;
  DROP POLICY IF EXISTS "Allow authenticated users to read box configurations" ON box_configurations;
  DROP POLICY IF EXISTS "Admins have full access to box configurations" ON box_configurations;
END $$;

-- Disable RLS temporarily
ALTER TABLE stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties DISABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;

-- Create new policies with unique names
CREATE POLICY "admin_full_access_stores"
  ON stores FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "read_access_stores"
  ON stores FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_full_access_varieties"
  ON donut_varieties FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "read_access_varieties"
  ON donut_varieties FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_full_access_forms"
  ON donut_forms FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "read_access_forms"
  ON donut_forms FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_full_access_boxes"
  ON box_configurations FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "read_access_boxes"
  ON box_configurations FOR SELECT TO authenticated
  USING (true);