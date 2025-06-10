/*
  # Fix RLS policies for admin tables

  1. Changes
    - Drop existing policies safely
    - Recreate policies with proper names
    - Ensure no duplicates exist
    
  2. Security
    - Maintain proper RLS on all tables
    - Admin users get full access
    - All authenticated users get read access
*/

-- Ensure RLS is enabled on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_varieties ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for stores table
DROP POLICY IF EXISTS "Allow authenticated users to read stores" ON stores;
DROP POLICY IF EXISTS "Allow admin users to manage stores" ON stores;
DROP POLICY IF EXISTS "Admin users have full access to stores" ON stores;
DROP POLICY IF EXISTS "Authenticated users can read stores" ON stores;

-- Create policies for stores table
CREATE POLICY "Allow authenticated users to read stores" 
  ON stores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin users to manage stores" 
  ON stores FOR ALL TO authenticated 
  USING (auth.jwt() ->> 'role' = 'admin') 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Drop existing policies for donut_varieties table
DROP POLICY IF EXISTS "Allow authenticated users to read donut varieties" ON donut_varieties;
DROP POLICY IF EXISTS "Allow admin users to manage donut varieties" ON donut_varieties;
DROP POLICY IF EXISTS "Admin users have full access to donut varieties" ON donut_varieties;
DROP POLICY IF EXISTS "Authenticated users can read donut varieties" ON donut_varieties;

-- Create policies for donut_varieties table
CREATE POLICY "Allow authenticated users to read donut varieties" 
  ON donut_varieties FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin users to manage donut varieties" 
  ON donut_varieties FOR ALL TO authenticated 
  USING (auth.jwt() ->> 'role' = 'admin') 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Drop existing policies for donut_forms table
DROP POLICY IF EXISTS "Allow authenticated users to read donut forms" ON donut_forms;
DROP POLICY IF EXISTS "Allow admin users to manage donut forms" ON donut_forms;
DROP POLICY IF EXISTS "Admin users have full access to donut forms" ON donut_forms;
DROP POLICY IF EXISTS "Authenticated users can read donut forms" ON donut_forms;

-- Create policies for donut_forms table
CREATE POLICY "Allow authenticated users to read donut forms" 
  ON donut_forms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin users to manage donut forms" 
  ON donut_forms FOR ALL TO authenticated 
  USING (auth.jwt() ->> 'role' = 'admin') 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Drop existing policies for box_configurations table
DROP POLICY IF EXISTS "Allow authenticated users to read box configurations" ON box_configurations;
DROP POLICY IF EXISTS "Allow admin users to manage box configurations" ON box_configurations;
DROP POLICY IF EXISTS "Admin users have full access to box configurations" ON box_configurations;
DROP POLICY IF EXISTS "Authenticated users can read box configurations" ON box_configurations;

-- Create policies for box_configurations table
CREATE POLICY "Allow authenticated users to read box configurations" 
  ON box_configurations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin users to manage box configurations" 
  ON box_configurations FOR ALL TO authenticated 
  USING (auth.jwt() ->> 'role' = 'admin') 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Drop existing policies for box_varieties table
DROP POLICY IF EXISTS "Allow authenticated users to read box varieties" ON box_varieties;
DROP POLICY IF EXISTS "Allow admin users to manage box varieties" ON box_varieties;
DROP POLICY IF EXISTS "Admin users have full access to box varieties" ON box_varieties;
DROP POLICY IF EXISTS "Authenticated users can read box varieties" ON box_varieties;

-- Create policies for box_varieties table
CREATE POLICY "Allow authenticated users to read box varieties" 
  ON box_varieties FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin users to manage box varieties" 
  ON box_varieties FOR ALL TO authenticated 
  USING (auth.jwt() ->> 'role' = 'admin') 
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');