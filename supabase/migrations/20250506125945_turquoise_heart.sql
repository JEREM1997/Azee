-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin and production can create plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can update plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
END $$;

-- Create new policies with proper role checks
CREATE POLICY "Admin and production can create plans"
  ON production_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'production')
    )
  );

CREATE POLICY "Admin and production can update plans"
  ON production_plans
  FOR UPDATE
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

-- Grant necessary permissions
GRANT ALL ON production_plans TO authenticated;
GRANT ALL ON store_productions TO authenticated;
GRANT ALL ON production_items TO authenticated;
GRANT ALL ON box_productions TO authenticated;

-- Ensure sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;