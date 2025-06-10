-- Ensure the user has the correct role and permissions
DO $$ 
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the user ID for jeremie@krispykreme.ch
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'jeremie@krispykreme.ch';

  -- If user exists, update their role to admin
  IF target_user_id IS NOT NULL THEN
    -- Update user_roles table
    INSERT INTO user_roles (user_id, role, store_ids)
    VALUES (target_user_id, 'admin', '{}')
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      role = 'admin',
      store_ids = '{}',
      updated_at = now();

    -- Update user metadata directly
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object(
      'role', 'admin',
      'store_ids', '{}',
      'updated_at', extract(epoch from now())
    )
    WHERE id = target_user_id;
  END IF;
END $$;

-- Disable RLS on all tables to ensure full access
ALTER TABLE production_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions DISABLE ROW LEVEL SECURITY;
ALTER TABLE production_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;