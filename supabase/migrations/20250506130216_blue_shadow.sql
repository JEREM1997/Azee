/*
  # Fix Production Plan Policies

  1. Changes
    - Simplify policies to use a single policy for all operations
    - Ensure proper role checks
    - Remove unnecessary grants
    
  2. Security
    - Maintain RLS
    - Check user_roles table for permissions
*/

-- Create new policies with proper role checks
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Admin and production can manage plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can create plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can update plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;

  -- Create new simplified policies
  CREATE POLICY "Admin and production can manage plans"
    ON production_plans
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'production')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'production')
      )
    );

  CREATE POLICY "Everyone can view plans"
    ON production_plans
    FOR SELECT
    TO authenticated
    USING (true);
END $$;