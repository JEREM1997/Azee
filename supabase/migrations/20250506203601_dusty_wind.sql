-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Production management" ON production_plans;
  DROP POLICY IF EXISTS "Store productions management" ON store_productions;
  DROP POLICY IF EXISTS "Production items management" ON production_items;
  DROP POLICY IF EXISTS "Box productions management" ON box_productions;
  DROP POLICY IF EXISTS "Full access" ON production_plans;
  DROP POLICY IF EXISTS "Full store access" ON store_productions;
  DROP POLICY IF EXISTS "Full items access" ON production_items;
  DROP POLICY IF EXISTS "Full box access" ON box_productions;
END $$;

-- Disable RLS on all tables
ALTER TABLE production_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions DISABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;