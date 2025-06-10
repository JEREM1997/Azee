/*
  # User Roles Schema

  1. New Tables
    - `user_roles`
      - `user_id` (uuid, primary key, references auth.users)
      - `role` (text, enum: admin, production, store)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on user_roles table
    - Add policy for admins to manage roles
    - Add policy for users to view their own role
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
  DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
END $$;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users,
  role text NOT NULL CHECK (role IN ('admin', 'production', 'store')),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create policies
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