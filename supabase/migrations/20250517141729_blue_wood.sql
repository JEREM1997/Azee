/*
  # Create admin tables for store management

  1. New Tables
    - `stores`
      - `id` (uuid, primary key)
      - `name` (text)
      - `address` (text)
      - `phone` (text)
      - `email` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `donut_varieties`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `price` (decimal)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `donut_forms`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `box_configurations`
      - `id` (uuid, primary key)
      - `name` (text)
      - `capacity` (integer)
      - `price` (decimal)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read data
    - Add policies for admin users to manage data
*/

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create donut varieties table
CREATE TABLE IF NOT EXISTS donut_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create donut forms table
CREATE TABLE IF NOT EXISTS donut_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create box configurations table
CREATE TABLE IF NOT EXISTS box_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL,
  price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for stores
CREATE POLICY "Allow read access for authenticated users on stores"
  ON stores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all access for admin users on stores"
  ON stores
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create policies for donut varieties
CREATE POLICY "Allow read access for authenticated users on donut varieties"
  ON donut_varieties
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all access for admin users on donut varieties"
  ON donut_varieties
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create policies for donut forms
CREATE POLICY "Allow read access for authenticated users on donut forms"
  ON donut_forms
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all access for admin users on donut forms"
  ON donut_forms
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create policies for box configurations
CREATE POLICY "Allow read access for authenticated users on box configurations"
  ON box_configurations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all access for admin users on box configurations"
  ON box_configurations
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donut_varieties_updated_at
  BEFORE UPDATE ON donut_varieties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donut_forms_updated_at
  BEFORE UPDATE ON donut_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_box_configurations_updated_at
  BEFORE UPDATE ON box_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();