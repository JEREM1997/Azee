/*
  # Add User Roles Table
  
  1. New Tables
    - `user_roles`
      - `user_id` (uuid, primary key)
      - `role` (text)
      - `updated_at` (timestamptz)
      
  2. Security
    - Enable RLS
    - Add policies for admin access
*/

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