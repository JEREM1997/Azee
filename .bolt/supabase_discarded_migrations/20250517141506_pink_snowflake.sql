/*
  # Create store management tables

  1. New Tables
    - `stores`
      - `id` (uuid, primary key)
      - `name` (text, store name)
      - `address` (text, store location)
      - `phone` (text, contact number)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `donut_varieties`
      - `id` (uuid, primary key)
      - `name` (text, variety name)
      - `description` (text)
      - `created_at` (timestamp)
    - `donut_forms`
      - `id` (uuid, primary key)
      - `name` (text, form name)
      - `description` (text)
      - `created_at` (timestamp)
    - `box_configurations`
      - `id` (uuid, primary key)
      - `name` (text, configuration name)
      - `capacity` (integer, number of donuts)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create donut varieties table
CREATE TABLE IF NOT EXISTS donut_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create donut forms table
CREATE TABLE IF NOT EXISTS donut_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create box configurations table
CREATE TABLE IF NOT EXISTS box_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for stores
CREATE POLICY "Allow authenticated users to read stores"
  ON stores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert stores"
  ON stores
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update stores"
  ON stores
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for donut varieties
CREATE POLICY "Allow authenticated users to read donut varieties"
  ON donut_varieties
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert donut varieties"
  ON donut_varieties
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policies for donut forms
CREATE POLICY "Allow authenticated users to read donut forms"
  ON donut_forms
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert donut forms"
  ON donut_forms
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policies for box configurations
CREATE POLICY "Allow authenticated users to read box configurations"
  ON box_configurations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert box configurations"
  ON box_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for stores
CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();