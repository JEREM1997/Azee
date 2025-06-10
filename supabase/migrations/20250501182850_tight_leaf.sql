/*
  # User Roles Schema Update

  1. Changes
    - Creates user_roles table with proper constraints
    - Adds RLS policies for role-based access
    - Creates performance index
    - Inserts initial admin user

  2. Security
    - Enables RLS
    - Adds policies for admin access and user viewing
*/

-- First, drop existing table and policies
DROP TABLE IF EXISTS user_roles CASCADE;

-- Create user_roles table
CREATE TABLE user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL,
  store_id text,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'production', 'store'))
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Create policies
CREATE POLICY "Admins can manage user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
  );

CREATE POLICY "Users can view their own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert initial admin user
INSERT INTO user_roles (user_id, role)
VALUES ('751dc622-1e64-494f-828f-5e872ef90661', 'admin')
ON CONFLICT (user_id) DO UPDATE
SET role = 'admin', updated_at = now();