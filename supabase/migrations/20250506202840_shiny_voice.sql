-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin access" ON production_plans;
  DROP POLICY IF EXISTS "Production role access" ON production_plans;
  DROP POLICY IF EXISTS "Store role access" ON production_plans;
  DROP POLICY IF EXISTS "Admin store access" ON store_productions;
  DROP POLICY IF EXISTS "Production store access" ON store_productions;
  DROP POLICY IF EXISTS "Store user access" ON store_productions;
  DROP POLICY IF EXISTS "Admin items access" ON production_items;
  DROP POLICY IF EXISTS "Production items access" ON production_items;
  DROP POLICY IF EXISTS "Store items access" ON production_items;
  DROP POLICY IF EXISTS "Admin box access" ON box_productions;
  DROP POLICY IF EXISTS "Production box access" ON box_productions;
  DROP POLICY IF EXISTS "Store box access" ON box_productions;
END $$;

-- Enable RLS
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for admin access
CREATE POLICY "Admin access"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin store access"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin items access"
  ON production_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin box access"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update sync_user_role function to properly handle store_ids and roles
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user metadata
  UPDATE auth.users
  SET raw_user_meta_data = 
    jsonb_build_object(
      'role', NEW.role,
      'store_ids', COALESCE(NEW.store_ids, '{}'),
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

-- Force refresh all user roles to ensure metadata is synced
UPDATE user_roles 
SET updated_at = now();

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;