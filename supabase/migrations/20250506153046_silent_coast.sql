/*
  # Fix Production Policies

  1. Changes
    - Drop existing policies
    - Create new policies using auth.jwt() for role checks
    - Add proper permissions for authenticated users
    
  2. Security
    - Enable RLS on all tables
    - Add policies for admin and production roles
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Production management" ON production_plans;
  DROP POLICY IF EXISTS "Store productions management" ON store_productions;
  DROP POLICY IF EXISTS "Production items management" ON production_items;
  DROP POLICY IF EXISTS "Box productions management" ON box_productions;
END $$;

-- Enable RLS
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions ENABLE ROW LEVEL SECURITY;

-- Create policies using auth.jwt()
CREATE POLICY "Production management"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'production')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'production')
  );

CREATE POLICY "Store productions management"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'production')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'production')
  );

CREATE POLICY "Production items management"
  ON production_items
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'production')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'production')
  );

CREATE POLICY "Box productions management"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'production')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'production')
  );

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;