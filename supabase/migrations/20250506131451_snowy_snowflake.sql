/*
  # Fix table permissions

  1. Changes
    - Drop and recreate RLS policies
    - Grant proper permissions to authenticated role
    - Ensure admin role is set correctly
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin and production can manage plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
END $$;

-- Enable RLS
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "Admin and production can manage plans"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'production')
    )
  );

CREATE POLICY "Everyone can view plans"
  ON production_plans
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant proper permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

-- Ensure admin role is properly set
DO $$ 
DECLARE
  admin_id uuid := '751dc622-1e64-494f-828f-5e872ef90661';
BEGIN
  -- Update auth.users metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object(
    'role', 'admin',
    'store_ids', '{}',
    'updated_at', extract(epoch from now())
  )
  WHERE id = admin_id;
END $$;