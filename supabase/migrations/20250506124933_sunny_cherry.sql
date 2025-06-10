-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin and production can create plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can update plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
END $$;

-- Create new policies with fixed conditions
CREATE POLICY "Admin and production can create plans"
  ON production_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.id = auth.uid()
      AND (
        u.raw_user_meta_data->>'role' IN ('admin', 'production') OR
        ur.role IN ('admin', 'production')
      )
    )
  );

CREATE POLICY "Admin and production can update plans"
  ON production_plans
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.id = auth.uid()
      AND (
        u.raw_user_meta_data->>'role' IN ('admin', 'production') OR
        ur.role IN ('admin', 'production')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.id = auth.uid()
      AND (
        u.raw_user_meta_data->>'role' IN ('admin', 'production') OR
        ur.role IN ('admin', 'production')
      )
    )
  );

CREATE POLICY "Everyone can view plans"
  ON production_plans
  FOR SELECT
  TO authenticated
  USING (true);