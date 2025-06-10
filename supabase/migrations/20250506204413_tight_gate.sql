-- Drop existing policies and disable RLS for full access
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Production management" ON production_plans;
  DROP POLICY IF EXISTS "Store productions management" ON store_productions;
  DROP POLICY IF EXISTS "Production items management" ON production_items;
  DROP POLICY IF EXISTS "Box productions management" ON box_productions;
END $$;

-- Disable RLS on all tables to ensure full access
ALTER TABLE production_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions DISABLE ROW LEVEL SECURITY;

-- Update user_roles table to better handle store assignments
ALTER TABLE user_roles 
ALTER COLUMN store_ids SET DEFAULT '{}',
ALTER COLUMN store_ids SET NOT NULL;

-- Create function to manage user roles and store assignments
CREATE OR REPLACE FUNCTION manage_user_role(
  p_user_id uuid,
  p_role text,
  p_store_ids text[] DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  -- Update user metadata first
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object(
    'role', p_role,
    'store_ids', p_store_ids,
    'updated_at', extract(epoch from now())
  )
  WHERE id = p_user_id;

  -- Then update user_roles table
  INSERT INTO user_roles (user_id, role, store_ids)
  VALUES (p_user_id, p_role, p_store_ids)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = p_role,
    store_ids = p_store_ids,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to assign stores to user
CREATE OR REPLACE FUNCTION assign_stores_to_user(
  p_user_id uuid,
  p_store_ids text[]
)
RETURNS void AS $$
DECLARE
  v_current_role text;
BEGIN
  -- Get current role
  SELECT role INTO v_current_role
  FROM user_roles
  WHERE user_id = p_user_id;

  -- Update user metadata and role
  PERFORM manage_user_role(p_user_id, v_current_role, p_store_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION manage_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION assign_stores_to_user TO authenticated;