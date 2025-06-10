-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin access" ON user_roles;
  DROP POLICY IF EXISTS "View own role" ON user_roles;
  DROP POLICY IF EXISTS "Admin and production access" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production store access" ON store_productions;
  DROP POLICY IF EXISTS "Admin and production items access" ON production_items;
  DROP POLICY IF EXISTS "Admin and production box access" ON box_productions;
END $$;

-- Enable RLS
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions ENABLE ROW LEVEL SECURITY;

-- Create simple policies for production management
CREATE POLICY "Production management"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Store productions management"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Production items management"
  ON production_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Box productions management"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;