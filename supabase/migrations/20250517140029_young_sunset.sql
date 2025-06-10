/*
  # Add RLS policies for admin access

  1. Changes
    - Enable RLS on all store management tables
    - Add policies to allow admin users full access to:
      - stores
      - donut_varieties
      - donut_forms
      - box_configurations
    
  2. Security
    - Enables RLS on all tables
    - Creates policies that check for admin role
    - Ensures only authenticated admin users can access the data
*/

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for stores table
CREATE POLICY "Allow full access for admin users on stores"
ON stores
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Create policies for donut_varieties table
CREATE POLICY "Allow full access for admin users on donut_varieties"
ON donut_varieties
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Create policies for donut_forms table
CREATE POLICY "Allow full access for admin users on donut_forms"
ON donut_forms
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Create policies for box_configurations table
CREATE POLICY "Allow full access for admin users on box_configurations"
ON box_configurations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);