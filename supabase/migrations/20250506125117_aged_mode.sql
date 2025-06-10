/*
  # Fix Admin Role and Permissions

  1. Changes
    - Drop and recreate production plan policies
    - Update sync_user_role function
    - Fix role-based access controls
    
  2. Security
    - Maintain RLS
    - Simplify policy checks using JWT claims
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admin and production can create plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can update plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
END $$;

-- Create new policies with simplified role checks
CREATE POLICY "Admin and production can create plans"
  ON production_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('admin', 'production')
  );

CREATE POLICY "Admin and production can update plans"
  ON production_plans
  FOR UPDATE
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

-- Update the sync_user_role function
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
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