/*
  # Update User Role Column Type

  1. Changes
    - Create user_role enum type if it doesn't exist
    - Convert role column from text to user_role enum
    - Set proper constraints and defaults
    
  2. Security
    - Maintain existing RLS policies
    - No changes to security model
*/

-- First, make sure the user_role type exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'production', 'store');
  END IF;
END $$;

-- Add the new column
ALTER TABLE user_roles 
ADD COLUMN role_enum user_role;

-- Copy data with explicit casting
UPDATE user_roles 
SET role_enum = CASE role
  WHEN 'admin' THEN 'admin'::user_role
  WHEN 'production' THEN 'production'::user_role
  WHEN 'store' THEN 'store'::user_role
END;

-- Drop the old column and constraints
ALTER TABLE user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE user_roles 
DROP COLUMN role;

-- Set up the new column properly
ALTER TABLE user_roles 
ALTER COLUMN role_enum SET NOT NULL;

ALTER TABLE user_roles 
ALTER COLUMN role_enum SET DEFAULT 'store'::user_role;

ALTER TABLE user_roles 
RENAME COLUMN role_enum TO role;