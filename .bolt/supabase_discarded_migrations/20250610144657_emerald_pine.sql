/*
  # Create user role history table

  1. New Tables
    - `user_role_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `old_role` (text)
      - `new_role` (text)
      - `reason` (text)
      - `changed_by` (uuid, references auth.users)
      - `changed_at` (timestamptz)

  2. Security
    - Enable RLS on user_role_history table
    - Add policies for admin access only
*/

-- Create user_role_history table
CREATE TABLE IF NOT EXISTS user_role_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  old_role text NOT NULL,
  new_role text NOT NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id) NOT NULL,
  changed_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE user_role_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user_role_history
CREATE POLICY "Admin users can access role history"
  ON user_role_history FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_role_history_user_id ON user_role_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_history_changed_at ON user_role_history(changed_at DESC);