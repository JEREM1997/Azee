/*
  # Add automatic user role assignment

  1. Changes
    - Add trigger to automatically create a user role entry when a new user is created
    - Default role will be 'store' with empty store_ids array
    
  2. Security
    - No changes to existing RLS policies
    - Maintains existing security model
*/

-- Function to create default user role
CREATE OR REPLACE FUNCTION public.create_default_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, store_ids)
  VALUES (NEW.id, 'store', '{}')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'create_default_user_role_trigger'
  ) THEN
    CREATE TRIGGER create_default_user_role_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_user_role();
  END IF;
END
$$;