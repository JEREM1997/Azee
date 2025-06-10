-- Create new policies with proper role checks
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Admin and production can manage plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can create plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can update plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;

  -- Create new simplified policies
  CREATE POLICY "Admin and production can manage plans"
    ON production_plans
    FOR ALL
    TO authenticated
    USING (
      auth.jwt() ->> 'role' IN ('admin', 'production')
    )
    WITH CHECK (
      auth.jwt() ->> 'role' IN ('admin', 'production')
    );

  CREATE POLICY "Everyone can view plans"
    ON production_plans
    FOR SELECT
    TO authenticated
    USING (true);
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

-- Make sure your user has admin role
DO $$ 
BEGIN
  -- First ensure the role exists in user_roles
  INSERT INTO user_roles (user_id, role, store_ids)
  VALUES ('751dc622-1e64-494f-828f-5e872ef90661', 'admin', '{}'::text[])
  ON CONFLICT (user_id) 
  DO UPDATE SET role = 'admin', updated_at = now();
END $$;