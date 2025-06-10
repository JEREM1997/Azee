-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Production management" ON production_plans;
  DROP POLICY IF EXISTS "Store productions management" ON store_productions;
  DROP POLICY IF EXISTS "Production items management" ON production_items;
  DROP POLICY IF EXISTS "Box productions management" ON box_productions;
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
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'admin'
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'admin'
  );

CREATE POLICY "Production role access"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'production'
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'production'
  );

CREATE POLICY "Store role access"
  ON production_plans
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'store' AND
    EXISTS (
      SELECT 1 FROM store_productions sp
      WHERE sp.plan_id = id
      AND sp.store_id = ANY(COALESCE((current_setting('request.jwt.claims', true)::jsonb->>'store_ids')::text[], '{}'))
    )
  );

-- Create policies for store productions
CREATE POLICY "Admin store access"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'admin'
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'admin'
  );

CREATE POLICY "Production store access"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'production'
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'production'
  );

CREATE POLICY "Store user access"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'store' AND
    store_id = ANY(COALESCE((current_setting('request.jwt.claims', true)::jsonb->>'store_ids')::text[], '{}'))
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'store' AND
    store_id = ANY(COALESCE((current_setting('request.jwt.claims', true)::jsonb->>'store_ids')::text[], '{}'))
  );

-- Create policies for production items
CREATE POLICY "Admin items access"
  ON production_items
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'admin'
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'admin'
  );

CREATE POLICY "Production items access"
  ON production_items
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'production'
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'production'
  );

CREATE POLICY "Store items access"
  ON production_items
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'store' AND
    EXISTS (
      SELECT 1 FROM store_productions sp
      WHERE sp.id = store_production_id
      AND sp.store_id = ANY(COALESCE((current_setting('request.jwt.claims', true)::jsonb->>'store_ids')::text[], '{}'))
    )
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'store' AND
    EXISTS (
      SELECT 1 FROM store_productions sp
      WHERE sp.id = store_production_id
      AND sp.store_id = ANY(COALESCE((current_setting('request.jwt.claims', true)::jsonb->>'store_ids')::text[], '{}'))
    )
  );

-- Create policies for box productions
CREATE POLICY "Admin box access"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'admin'
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'admin'
  );

CREATE POLICY "Production box access"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'production'
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'production'
  );

CREATE POLICY "Store box access"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'store' AND
    EXISTS (
      SELECT 1 FROM store_productions sp
      WHERE sp.id = store_production_id
      AND sp.store_id = ANY(COALESCE((current_setting('request.jwt.claims', true)::jsonb->>'store_ids')::text[], '{}'))
    )
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'store' AND
    EXISTS (
      SELECT 1 FROM store_productions sp
      WHERE sp.id = store_production_id
      AND sp.store_id = ANY(COALESCE((current_setting('request.jwt.claims', true)::jsonb->>'store_ids')::text[], '{}'))
    )
  );

-- Update sync_user_role function to properly handle store_ids and roles
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure store_ids is an array
  IF NEW.store_ids IS NULL THEN
    NEW.store_ids := '{}';
  END IF;

  -- Update user metadata
  UPDATE auth.users
  SET raw_user_meta_data = 
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

-- Force refresh all user roles to ensure metadata is synced
UPDATE user_roles 
SET updated_at = now();

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;