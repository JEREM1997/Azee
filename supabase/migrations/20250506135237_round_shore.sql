/*
  # Fix user role type and policies

  1. Changes
    - Drop dependent policies first
    - Update user role type
    - Recreate policies with fixed role checks
    
  2. Security
    - Maintain existing RLS
    - Update policies to use proper role checks
*/

-- First drop all dependent policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users with production or admin role can manage plans" ON production_plans;
  DROP POLICY IF EXISTS "Production users can manage store productions" ON store_productions;
  DROP POLICY IF EXISTS "Production users can manage production items" ON production_items;
  DROP POLICY IF EXISTS "Production users can manage box productions" ON box_productions;
  DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
  DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
END $$;

-- Update the user_roles table to use text instead of enum
ALTER TABLE user_roles 
  ALTER COLUMN role TYPE text;

-- Recreate policies with text comparison
CREATE POLICY "Users with production or admin role can manage plans"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'production'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'production'));

CREATE POLICY "Production users can manage store productions"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'production'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'production'));

CREATE POLICY "Production users can manage production items"
  ON production_items
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'production'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'production'));

CREATE POLICY "Production users can manage box productions"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'production'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'production'));

CREATE POLICY "Admins can manage user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view their own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add constraint to ensure valid roles
ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'production', 'store'));