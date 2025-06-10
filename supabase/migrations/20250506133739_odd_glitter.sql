-- Drop all existing policies and tables
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Production management" ON production_plans;
  DROP POLICY IF EXISTS "Store productions management" ON store_productions;
  DROP POLICY IF EXISTS "Production items management" ON production_items;
  DROP POLICY IF EXISTS "Box productions management" ON box_productions;
  
  -- Drop existing tables
  DROP TABLE IF EXISTS user_roles CASCADE;
END $$;

-- Create a simple user_roles table
CREATE TABLE user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'production', 'store')),
  store_ids text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions ENABLE ROW LEVEL SECURITY;

-- Create simple policies for user_roles
CREATE POLICY "Admins can manage roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

CREATE POLICY "Users can view their role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create simple policies for production management
CREATE POLICY "Production management"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id 
      FROM user_roles 
      WHERE role IN ('admin', 'production')
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id 
      FROM user_roles 
      WHERE role IN ('admin', 'production')
    )
  );

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert admin user
INSERT INTO user_roles (user_id, role)
VALUES ('751dc622-1e64-494f-828f-5e872ef90661', 'admin')
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin', updated_at = now();