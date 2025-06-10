/*
  # Fix Admin Permissions and Role Synchronization

  1. Changes
    - Ensure admin role exists in user_roles table
    - Update policies to check user_roles table
    - Fix role synchronization
    - Add proper error handling
    
  2. Security
    - Maintain RLS
    - Update policies for proper role checks
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin and production can create plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can update plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
END $$;

-- Create new policies that check user_roles table
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

-- Make sure your user ID has admin role
DO $$ 
DECLARE 
  user_exists boolean;
BEGIN
  -- Check if the user exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = '751dc622-1e64-494f-828f-5e872ef90661'
  ) INTO user_exists;

  -- Only insert if user exists
  IF user_exists THEN
    INSERT INTO user_roles (user_id, role, store_ids)
    VALUES ('751dc622-1e64-494f-828f-5e872ef90661', 'admin', '{}'::text[])
    ON CONFLICT (user_id) 
    DO UPDATE SET role = 'admin', updated_at = now();
  END IF;
END $$;

-- Update the sync_user_role function to properly sync roles
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user metadata when role changes
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

-- Refresh all user roles
DO $$ 
BEGIN
  UPDATE user_roles 
  SET updated_at = now() 
  WHERE role = 'admin';
END $$;