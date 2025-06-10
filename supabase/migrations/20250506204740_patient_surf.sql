-- Drop existing policies and disable RLS for full access
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Production management" ON production_plans;
  DROP POLICY IF EXISTS "Store productions management" ON store_productions;
  DROP POLICY IF EXISTS "Production items management" ON production_items;
  DROP POLICY IF EXISTS "Box productions management" ON box_productions;
END $$;

-- Disable RLS on all tables
ALTER TABLE production_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions DISABLE ROW LEVEL SECURITY;

-- Update user_roles table
ALTER TABLE user_roles 
ALTER COLUMN store_ids SET DEFAULT '{}',
ALTER COLUMN store_ids SET NOT NULL;

-- Function to manage user roles
CREATE OR REPLACE FUNCTION manage_user_role(
  p_user_id uuid,
  p_role text,
  p_store_ids text[] DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  IF p_role NOT IN ('admin', 'production', 'store') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object(
    'role', p_role,
    'store_ids', p_store_ids,
    'updated_at', extract(epoch from now())
  )
  WHERE id = p_user_id;

  INSERT INTO user_roles (user_id, role, store_ids)
  VALUES (p_user_id, p_role, p_store_ids)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = p_role,
    store_ids = p_store_ids,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign stores to user
CREATE OR REPLACE FUNCTION assign_stores_to_user(
  p_user_id uuid,
  p_store_ids text[]
)
RETURNS void AS $$
DECLARE
  v_current_role text;
BEGIN
  SELECT role INTO v_current_role
  FROM user_roles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_current_role NOT IN ('store') AND array_length(p_store_ids, 1) > 0 THEN
    RAISE EXCEPTION 'Only store users can be assigned to stores';
  END IF;

  PERFORM manage_user_role(p_user_id, v_current_role, p_store_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's stores
CREATE OR REPLACE FUNCTION get_user_stores(p_user_id uuid)
RETURNS text[] AS $$
BEGIN
  RETURN (
    SELECT store_ids 
    FROM user_roles 
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION manage_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION assign_stores_to_user TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stores TO authenticated;