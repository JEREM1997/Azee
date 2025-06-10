-- First, make sure the user_role type exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'production', 'store');
  END IF;
END $$;

-- Add the new column and copy data
DO $$ 
BEGIN
  -- Add the new column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_roles' AND column_name = 'role_enum'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN role_enum user_role;
  END IF;

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

  -- Rename the new column
  ALTER TABLE user_roles 
  RENAME COLUMN role_enum TO role;

  -- Set up the constraints
  ALTER TABLE user_roles 
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'store'::user_role;
END $$;