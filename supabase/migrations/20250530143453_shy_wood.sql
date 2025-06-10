-- Drop all existing policies first
DO $$ 
BEGIN
  -- Drop store policies
  DROP POLICY IF EXISTS "Admin users have full access to stores" ON stores;
  DROP POLICY IF EXISTS "Allow authenticated users to read stores" ON stores;
  
  -- Drop donut varieties policies
  DROP POLICY IF EXISTS "Admin users have full access to donut varieties" ON donut_varieties;
  DROP POLICY IF EXISTS "Allow authenticated users to read donut varieties" ON donut_varieties;
  
  -- Drop donut forms policies
  DROP POLICY IF EXISTS "Admin users have full access to donut forms" ON donut_forms;
  DROP POLICY IF EXISTS "Allow authenticated users to read donut forms" ON donut_forms;
  
  -- Drop box configurations policies
  DROP POLICY IF EXISTS "Admin users have full access to box configurations" ON box_configurations;
  DROP POLICY IF EXISTS "Allow authenticated users to read box configurations" ON box_configurations;
END $$;

-- Create new policies
-- Store policies
CREATE POLICY "Admin users have full access to stores"
  ON stores FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow authenticated users to read stores"
  ON stores FOR SELECT TO authenticated
  USING (true);

-- Donut varieties policies
CREATE POLICY "Admin users have full access to donut varieties"
  ON donut_varieties FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow authenticated users to read donut varieties"
  ON donut_varieties FOR SELECT TO authenticated
  USING (true);

-- Donut forms policies
CREATE POLICY "Admin users have full access to donut forms"
  ON donut_forms FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow authenticated users to read donut forms"
  ON donut_forms FOR SELECT TO authenticated
  USING (true);

-- Box configurations policies
CREATE POLICY "Admin users have full access to box configurations"
  ON box_configurations FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Allow authenticated users to read box configurations"
  ON box_configurations FOR SELECT TO authenticated
  USING (true);