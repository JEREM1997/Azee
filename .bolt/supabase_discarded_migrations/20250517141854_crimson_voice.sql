/*
  # Store and Donut Management Schema

  1. New Tables
    - `stores`
      - `id` (uuid, primary key)
      - `name` (text)
      - `address` (text)
      - `created_at` (timestamp)
    - `donut_varieties`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `created_at` (timestamp)
    - `donut_forms`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `created_at` (timestamp)
    - `box_configurations`
      - `id` (uuid, primary key)
      - `name` (text)
      - `capacity` (integer)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read data
*/

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now()
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

-- Create policies for authenticated users to read data
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