/*
  # Fix user role type to use enum

  1. Changes
    - Convert role column from text to user_role enum type
    - Maintain existing data during conversion
    - Keep default value and constraints
    
  2. Security
    - Maintain existing RLS policies
    - No changes to security model
*/

-- First, add a temporary column with the correct type
ALTER TABLE user_roles 
ADD COLUMN role_enum user_role;

-- Update the temporary column with the converted values
UPDATE user_roles 
SET role_enum = role::user_role;

-- Drop the old column
ALTER TABLE user_roles 
DROP CONSTRAINT user_roles_role_check;

ALTER TABLE user_roles 
DROP COLUMN role;

-- Set the new column as NOT NULL with default
ALTER TABLE user_roles 
ALTER COLUMN role_enum SET NOT NULL,
ALTER COLUMN role_enum SET DEFAULT 'store'::user_role;

-- Rename the new column
ALTER TABLE user_roles 
RENAME role_enum TO role;