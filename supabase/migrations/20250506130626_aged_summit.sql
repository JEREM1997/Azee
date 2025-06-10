/*
  # Fix Production Plan Policies

  1. Changes
    - Drop existing policies before recreating them
    - Ensure proper permissions for authenticated users
    - Grant necessary sequence permissions

  2. Security
    - Maintain RLS
    - Update policies for proper role-based access
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin and production can manage plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "Admin and production can manage plans"
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

CREATE POLICY "Everyone can view plans"
  ON production_plans
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure proper grants
GRANT SELECT, INSERT, UPDATE, DELETE ON production_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON store_productions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON production_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON box_productions TO authenticated;

-- Ensure sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;