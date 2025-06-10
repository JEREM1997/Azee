/*
  # Update production plans policies

  1. Security Changes
    - Add policies for production plans table to allow authenticated users with production or admin roles to manage plans
    - Remove dependency on admin role and use user_roles table instead

  2. Changes
    - Add new RLS policies for production_plans table
    - Add new RLS policies for store_productions table
    - Add new RLS policies for production_items table
    - Add new RLS policies for box_productions table
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- production_plans policies
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'production_plans'
  ) THEN
    DROP POLICY IF EXISTS "Production management" ON production_plans;
  END IF;
END $$;

-- Create new policies for production_plans
CREATE POLICY "Users with production or admin role can manage plans"
ON production_plans
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'production')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'production')
  )
);

-- Update store_productions policies
CREATE POLICY "Production users can manage store productions"
ON store_productions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'production')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'production')
  )
);

-- Update production_items policies
CREATE POLICY "Production users can manage production items"
ON production_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'production')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'production')
  )
);

-- Update box_productions policies
CREATE POLICY "Production users can manage box productions"
ON box_productions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'production')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'production')
  )
);