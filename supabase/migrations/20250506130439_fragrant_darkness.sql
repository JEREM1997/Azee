-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin and production can manage plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can create plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can update plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
END $$;

-- Create new simplified policies
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

-- Make sure the user_roles table exists and has the correct structure
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'production', 'store')),
  store_ids text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on user_roles if not already enabled
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

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
INSERT INTO user_roles (user_id, role, store_ids)
VALUES ('751dc622-1e64-494f-828f-5e872ef90661', 'admin', '{}'::text[])
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin', updated_at = now()
WHERE user_roles.role != 'admin';

-- Force refresh all admin roles to ensure metadata is synced
UPDATE user_roles 
SET updated_at = now() 
WHERE role = 'admin';