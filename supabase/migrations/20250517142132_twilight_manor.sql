/*
  # Store Management Schema

  1. New Tables
    - `stores`
      - `id` (uuid, primary key)
      - `name` (text, store name)
      - `address` (text, store location)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `donut_varieties`
      - `id` (uuid, primary key)
      - `name` (text, variety name)
      - `description` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `donut_forms`
      - `id` (uuid, primary key)
      - `name` (text, form name)
      - `description` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `box_configurations`
      - `id` (uuid, primary key)
      - `name` (text, configuration name)
      - `capacity` (integer, number of donuts)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create donut_varieties table
CREATE TABLE IF NOT EXISTS donut_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create donut_forms table
CREATE TABLE IF NOT EXISTS donut_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create box_configurations table
CREATE TABLE IF NOT EXISTS box_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated users to read stores"
  ON stores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read donut varieties"
  ON donut_varieties
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read donut forms"
  ON donut_forms
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read box configurations"
  ON box_configurations
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for admin users (assuming they have is_admin = true in their profiles)
CREATE POLICY "Allow admin users to manage stores"
  ON stores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

CREATE POLICY "Allow admin users to manage donut varieties"
  ON donut_varieties
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

CREATE POLICY "Allow admin users to manage donut forms"
  ON donut_forms
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );

CREATE POLICY "Allow admin users to manage box configurations"
  ON box_configurations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id AND raw_user_meta_data->>'is_admin' = 'true'
    )
  );