/*
  # Fix Production Plan Permissions

  1. Changes
    - Update policies for production plans
    - Add proper role-based access control
    - Fix permission issues for authenticated users

  2. Security
    - Maintain RLS
    - Update policies to use role checks
*/

-- Create new policies with proper role checks
DO $$ 
BEGIN
  -- Only create policies if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'production_plans' 
    AND policyname = 'Admin and production can manage plans'
  ) THEN
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
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'production_plans' 
    AND policyname = 'Everyone can view plans'
  ) THEN
    CREATE POLICY "Everyone can view plans"
      ON production_plans
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;