/*
  # Fix Policies and Permissions

  1. Changes
    - Drop and recreate policies for production_plans and user_roles
    - Update role synchronization
    - Ensure proper grants and permissions
    
  2. Security
    - Maintain RLS on all tables
    - Update policies for proper role-based access
*/

-- Drop all existing policies first
DO $$ 
BEGIN
  -- Drop production_plans policies
  DROP POLICY IF EXISTS "Admin and production can manage plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
  
  -- Drop user_roles policies
  DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
  DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for production_plans
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

-- Create policies for user_roles
CREATE POLICY "Admins can manage user roles"
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

CREATE POLICY "Users can view their own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Update or create the sync_user_role function
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

-- Insert or update admin role for the user
DO $$ 
BEGIN
  -- First ensure the role exists in user_roles
  INSERT INTO user_roles (user_id, role, store_ids)
  VALUES ('751dc622-1e64-494f-828f-5e872ef90661', 'admin', '{}'::text[])
  ON CONFLICT (user_id) 
  DO UPDATE SET role = 'admin', updated_at = now();

  -- Then force update the user metadata
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', 'admin',
      'store_ids', '{}'::text[],
      'updated_at', extract(epoch from now())
    )
  WHERE id = '751dc622-1e64-494f-828f-5e872ef90661';
END $$;

-- Ensure proper grants
GRANT SELECT, INSERT, UPDATE, DELETE ON production_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON store_productions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON production_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON box_productions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_roles TO authenticated;

-- Ensure sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;