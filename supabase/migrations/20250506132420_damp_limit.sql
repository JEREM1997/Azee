-- Drop all existing policies
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

-- Create simple policies using direct JWT claims with correct role name
CREATE POLICY "Production management"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'administrateur'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'administrateur'
  );

CREATE POLICY "Store productions management"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'administrateur'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'administrateur'
  );

CREATE POLICY "Production items management"
  ON production_items
  FOR ALL
  TO authenticated
  USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'administrateur'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'administrateur'
  );

CREATE POLICY "Box productions management"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'administrateur'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'administrateur'
  );

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;