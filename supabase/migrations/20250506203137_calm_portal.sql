-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Full access" ON production_plans;
  DROP POLICY IF EXISTS "Full store access" ON store_productions;
  DROP POLICY IF EXISTS "Full items access" ON production_items;
  DROP POLICY IF EXISTS "Full box access" ON box_productions;
END $$;

-- Enable RLS
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions ENABLE ROW LEVEL SECURITY;

-- Create simplified policies that grant full access to all authenticated users
CREATE POLICY "Full access"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full store access"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full items access"
  ON production_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full box access"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;