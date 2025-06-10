-- Drop all existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin and production can manage plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
  DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
  DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
END $$;

-- Enable RLS
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for production_plans
CREATE POLICY "Admin and production can manage plans"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (
    auth.jwt()->>'role' IN ('admin', 'production')
  )
  WITH CHECK (
    auth.jwt()->>'role' IN ('admin', 'production')
  );

CREATE POLICY "Everyone can view plans"
  ON production_plans
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for user_roles
CREATE POLICY "Admins can manage user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    auth.jwt()->>'role' = 'admin'
  )
  WITH CHECK (
    auth.jwt()->>'role' = 'admin'
  );

CREATE POLICY "Users can view their own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure admin role is properly set
DO $$ 
DECLARE
  admin_id uuid := '751dc622-1e64-494f-828f-5e872ef90661';
BEGIN
  -- First update auth.users metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object(
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
GRANT ALL ON production_plans TO authenticated;
GRANT ALL ON store_productions TO authenticated;
GRANT ALL ON production_items TO authenticated;
GRANT ALL ON box_productions TO authenticated;
GRANT ALL ON user_roles TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;