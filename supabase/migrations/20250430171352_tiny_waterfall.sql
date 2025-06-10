/*
  # Production Plans Schema

  1. New Tables
    - `production_plans`
      - `id` (uuid, primary key)
      - `date` (date)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `total_production` (integer)
      - `status` (text)
    
    - `store_productions`
      - `id` (uuid, primary key)
      - `plan_id` (uuid, references production_plans)
      - `store_id` (text)
      - `store_name` (text)
      - `total_quantity` (integer)
      - `confirmed` (boolean)
      - `delivery_confirmed` (boolean)
      - `waste_reported` (boolean)

    - `production_items`
      - `id` (uuid, primary key)
      - `store_production_id` (uuid, references store_productions)
      - `variety_id` (text)
      - `variety_name` (text)
      - `form_id` (text)
      - `form_name` (text)
      - `quantity` (integer)
      - `received` (integer)
      - `waste` (integer)

    - `box_productions`
      - `id` (uuid, primary key)
      - `store_production_id` (uuid, references store_productions)
      - `box_id` (text)
      - `box_name` (text)
      - `quantity` (integer)

  2. Security
    - Enable RLS on all tables
    - Add policies for admin and production roles
*/

DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Admin and production can create plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can update plans" ON production_plans;
  DROP POLICY IF EXISTS "Everyone can view plans" ON production_plans;
  DROP POLICY IF EXISTS "Admin and production can manage store productions" ON store_productions;
  DROP POLICY IF EXISTS "Store users can view and update their store productions" ON store_productions;
  DROP POLICY IF EXISTS "Admin and production can manage production items" ON production_items;
  DROP POLICY IF EXISTS "Store users can view and update their production items" ON production_items;
  DROP POLICY IF EXISTS "Admin and production can manage box productions" ON box_productions;
  DROP POLICY IF EXISTS "Store users can view their box productions" ON box_productions;
END $$;

-- Create production_plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS production_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now(),
  total_production integer NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'confirmed', 'completed')),
  UNIQUE (date)
);

-- Create store_productions table if it doesn't exist
CREATE TABLE IF NOT EXISTS store_productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES production_plans ON DELETE CASCADE NOT NULL,
  store_id text NOT NULL,
  store_name text NOT NULL,
  total_quantity integer NOT NULL,
  confirmed boolean DEFAULT false,
  delivery_confirmed boolean DEFAULT false,
  waste_reported boolean DEFAULT false
);

-- Create production_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS production_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_production_id uuid REFERENCES store_productions ON DELETE CASCADE NOT NULL,
  variety_id text NOT NULL,
  variety_name text NOT NULL,
  form_id text NOT NULL,
  form_name text NOT NULL,
  quantity integer NOT NULL,
  received integer,
  waste integer
);

-- Create box_productions table if it doesn't exist
CREATE TABLE IF NOT EXISTS box_productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_production_id uuid REFERENCES store_productions ON DELETE CASCADE NOT NULL,
  box_id text NOT NULL,
  box_name text NOT NULL,
  quantity integer NOT NULL
);

-- Enable Row Level Security
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions ENABLE ROW LEVEL SECURITY;

-- Create policies for production_plans
CREATE POLICY "Admin and production can create plans"
  ON production_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'production'));

CREATE POLICY "Admin and production can update plans"
  ON production_plans
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'production'));

CREATE POLICY "Everyone can view plans"
  ON production_plans
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for store_productions
CREATE POLICY "Admin and production can manage store productions"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'production'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'production'));

CREATE POLICY "Store users can view and update their store productions"
  ON store_productions
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'store' AND
    store_id = (auth.jwt() ->> 'store_id')
  );

-- Create policies for production_items
CREATE POLICY "Admin and production can manage production items"
  ON production_items
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'production'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'production'));

CREATE POLICY "Store users can view and update their production items"
  ON production_items
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'store' AND
    store_production_id IN (
      SELECT id FROM store_productions
      WHERE store_id = (auth.jwt() ->> 'store_id')
    )
  );

-- Create policies for box_productions
CREATE POLICY "Admin and production can manage box productions"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'production'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'production'));

CREATE POLICY "Store users can view their box productions"
  ON box_productions
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'store' AND
    store_production_id IN (
      SELECT id FROM store_productions
      WHERE store_id = (auth.jwt() ->> 'store_id')
    )
  );