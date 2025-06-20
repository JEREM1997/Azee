/*
  # Ensure jeremie@krispykreme.ch has admin role

  1. Changes
    - Update user_roles table to set admin role for jeremie@krispykreme.ch
    - Update user metadata to ensure role is properly synced
    - Force trigger the sync function to update JWT claims
    
  2. Security
    - Only affects the specific user jeremie@krispykreme.ch
    - Ensures admin role is properly set in all required places
*/

-- Ensure the user has admin role in user_roles table
DO $$ 
DECLARE
  target_user_id uuid;
BEGIN
  -- Get the user ID for jeremie@krispykreme.ch
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'jeremie@krispykreme.ch';

  -- If user exists, ensure they have admin role
  IF target_user_id IS NOT NULL THEN
    -- Update or insert user role
    INSERT INTO user_roles (user_id, role, store_ids)
    VALUES (target_user_id, 'admin', '{}')
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      role = 'admin',
      store_ids = '{}',
      updated_at = now();

    -- Update user metadata to ensure consistency
    UPDATE auth.users
    SET raw_user_meta_data = 
      COALESCE(raw_user_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'role', 'admin',
        'store_ids', '{}',
        'updated_at', extract(epoch from now())
      )
    WHERE id = target_user_id;

    RAISE NOTICE 'Admin role set for user: %', target_user_id;
  ELSE
    RAISE NOTICE 'User jeremie@krispykreme.ch not found';
  END IF;
END $$;