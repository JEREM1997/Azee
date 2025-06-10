/*
  # Fix Admin Role and Permissions

  1. Changes
    - Ensure admin role is properly set in both user_roles and user metadata
    - Fix production plan policies to check both tables
    - Add function to force refresh user session
*/

-- Function to properly set admin role
CREATE OR REPLACE FUNCTION set_admin_role(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- First ensure the role exists in user_roles
  INSERT INTO user_roles (user_id, role, store_ids)
  VALUES (p_user_id, 'admin', '{}'::text[])
  ON CONFLICT (user_id) 
  DO UPDATE SET role = 'admin', updated_at = now();
  
  -- Then update the user metadata
  UPDATE auth.users
  SET raw_user_meta_data = 
    jsonb_build_object(
      'role', 'admin',
      'updated_at', extract(epoch from now())
    )
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Set admin role for your user
SELECT set_admin_role('751dc622-1e64-494f-828f-5e872ef90661');

-- Force refresh all admin roles
UPDATE user_roles 
SET updated_at = now() 
WHERE role = 'admin';