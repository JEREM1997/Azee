-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin and production can manage plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
END $$;

-- Enable RLS
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;

-- Create simplified policies using raw_user_meta_data
CREATE POLICY "Admin and production can manage plans"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (
    auth.jwt()->>'role' IN ('admin', 'production') OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  )
  WITH CHECK (
    auth.jwt()->>'role' IN ('admin', 'production') OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  );

CREATE POLICY "Everyone can view plans"
  ON production_plans
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure admin role is properly set in both places
DO $$ 
DECLARE
  admin_id uuid := '751dc622-1e64-494f-828f-5e872ef90661';
BEGIN
  -- Update auth.users metadata first
  UPDATE auth.users
  SET raw_user_meta_data = 
    jsonb_build_object(
      'role', 'admin',
      'store_ids', '{}',
      'updated_at', extract(epoch from now())
    )
  WHERE id = admin_id;

  -- Then ensure user_roles entry exists
  INSERT INTO user_roles (user_id, role, store_ids)
  VALUES (admin_id, 'admin', '{}'::text[])
  ON CONFLICT (user_id) 
  DO UPDATE SET role = 'admin', updated_at = now();
END $$;

-- Ensure proper grants
GRANT SELECT, INSERT, UPDATE, DELETE ON production_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON store_productions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON production_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON box_productions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_roles TO authenticated;

-- Ensure sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;