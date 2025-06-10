-- Create roles if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin') THEN
    CREATE ROLE admin;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'production') THEN
    CREATE ROLE production;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'store') THEN
    CREATE ROLE store;
  END IF;
END $$;

-- Drop existing policies before recreating
DROP POLICY IF EXISTS "Admin and production can manage production plans" ON production_plans;

-- Create new policies
CREATE POLICY "Admin and production can manage production plans"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'production')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'production')
    )
  );

-- Ensure RLS is enabled on all tables
ALTER TABLE IF EXISTS production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS store_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS box_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to roles
GRANT SELECT, INSERT, UPDATE ON production_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON store_productions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON box_productions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON production_items TO authenticated;
GRANT SELECT ON user_roles TO authenticated;