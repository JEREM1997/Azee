-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Production plans access" ON production_plans;
  DROP POLICY IF EXISTS "Store productions access" ON store_productions;
  DROP POLICY IF EXISTS "Production items access" ON production_items;
  DROP POLICY IF EXISTS "Box productions access" ON box_productions;
END $$;

-- Disable RLS temporarily to ensure clean state
ALTER TABLE production_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions DISABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create function to check user role in public schema instead
CREATE OR REPLACE FUNCTION public.check_user_role(required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = required_role
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;