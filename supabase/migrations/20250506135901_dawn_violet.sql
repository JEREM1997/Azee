-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin access" ON user_roles;
  DROP POLICY IF EXISTS "View own role" ON user_roles;
  DROP POLICY IF EXISTS "Admin and production access" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production store access" ON store_productions;
  DROP POLICY IF EXISTS "Admin and production items access" ON production_items;
  DROP POLICY IF EXISTS "Admin and production box access" ON box_productions;
END $$;

-- Make sure user_roles table exists with correct structure
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL,
  store_ids text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions ENABLE ROW LEVEL SECURITY;

-- Create simple policies using metadata
CREATE POLICY "Admin access"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "View own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin and production access"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  );

CREATE POLICY "Admin and production store access"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  );

CREATE POLICY "Admin and production items access"
  ON production_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  );

CREATE POLICY "Admin and production box access"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  );

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert admin user if not exists
DO $$ 
BEGIN
  -- First update auth.users metadata
  UPDATE auth.users
  SET raw_user_meta_data = 
    jsonb_build_object(
      'role', 'admin',
      'store_ids', '{}',
      'updated_at', extract(epoch from now())
    )
  WHERE id = '751dc622-1e64-494f-828f-5e872ef90661';

  -- Then ensure user_roles entry exists
  INSERT INTO user_roles (user_id, role)
  VALUES ('751dc622-1e64-494f-828f-5e872ef90661', 'admin')
  ON CONFLICT (user_id) DO UPDATE 
  SET role = 'admin', updated_at = now();
END $$;