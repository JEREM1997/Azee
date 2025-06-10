-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin and production can create plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can update plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
END $$;

-- Create new policies that check both metadata and user_roles
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

-- Function to ensure user has admin role
CREATE OR REPLACE FUNCTION ensure_admin_role(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO user_roles (user_id, role, store_ids)
  VALUES (p_user_id, 'admin', '{}'::text[])
  ON CONFLICT (user_id) 
  DO UPDATE SET role = 'admin', updated_at = now();
  
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', 'admin', 'updated_at', extract(epoch from now()))
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the sync_user_role function
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', NEW.role,
      'store_ids', NEW.store_ids,
      'updated_at', extract(epoch from now())
    )
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS sync_user_role_trigger ON user_roles;
CREATE TRIGGER sync_user_role_trigger
AFTER INSERT OR UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_user_role();

-- Ensure your user has admin role
SELECT ensure_admin_role('751dc622-1e64-494f-828f-5e872ef90661');

-- Refresh all admin roles
UPDATE user_roles 
SET updated_at = now() 
WHERE role = 'admin';