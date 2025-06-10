-- First drop existing policies that reference user_roles
DROP POLICY IF EXISTS "Production users can manage store productions" ON store_productions;
DROP POLICY IF EXISTS "Production users can manage production items" ON production_items;
DROP POLICY IF EXISTS "Production users can manage box productions" ON box_productions;
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Users with production or admin role can manage plans" ON production_plans;

-- Create role type enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'production', 'store');
  END IF;
END $$;

-- Create new table with enum type
CREATE TABLE IF NOT EXISTS user_roles_new (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'store',
  store_ids text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Copy data from old table to new table
INSERT INTO user_roles_new (user_id, role, store_ids, updated_at)
SELECT 
  user_id,
  role::user_role,
  store_ids,
  updated_at
FROM user_roles;

-- Drop old table and rename new table
DROP TABLE user_roles CASCADE;
ALTER TABLE user_roles_new RENAME TO user_roles;

-- Create function for role checking
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role
  FROM user_roles
  WHERE user_id = auth.uid()
$$;

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Recreate policies with proper role checks
CREATE POLICY "Admins can manage user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (auth.user_role() = 'admin'::user_role)
  WITH CHECK (auth.user_role() = 'admin'::user_role);

CREATE POLICY "Users can view their own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users with production or admin role can manage plans"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (auth.user_role() IN ('admin'::user_role, 'production'::user_role))
  WITH CHECK (auth.user_role() IN ('admin'::user_role, 'production'::user_role));

-- Recreate store production policies
CREATE POLICY "Production users can manage store productions"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (auth.user_role() IN ('admin'::user_role, 'production'::user_role))
  WITH CHECK (auth.user_role() IN ('admin'::user_role, 'production'::user_role));

CREATE POLICY "Production users can manage production items"
  ON production_items
  FOR ALL
  TO authenticated
  USING (auth.user_role() IN ('admin'::user_role, 'production'::user_role))
  WITH CHECK (auth.user_role() IN ('admin'::user_role, 'production'::user_role));

CREATE POLICY "Production users can manage box productions"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (auth.user_role() IN ('admin'::user_role, 'production'::user_role))
  WITH CHECK (auth.user_role() IN ('admin'::user_role, 'production'::user_role));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Recreate sync_user_role function and trigger
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', NEW.role,
      'store_ids', NEW.store_ids
    )
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_user_role_trigger ON user_roles;
CREATE TRIGGER sync_user_role_trigger
AFTER INSERT OR UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_user_role();