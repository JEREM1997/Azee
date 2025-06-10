/*
  # Fix user roles validation

  1. Changes
    - Drop and recreate the role check constraint to ensure proper validation
    - Add missing roles if they don't exist
  
  2. Security
    - Maintain existing RLS policies
    - No changes to existing security model
*/

DO $$ 
BEGIN
  -- First check if the constraint exists and drop it if it does
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_roles_role_check'
    AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check;
  END IF;

  -- Recreate the constraint with the correct roles
  ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_role_check
    CHECK (role IN ('admin', 'production', 'store'));

END $$;