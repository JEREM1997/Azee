/*
  # Fix production plans permissions

  1. Changes
    - Add RLS policies for production plans table to allow admin and production roles to create plans
    - Add RLS policies for store productions table
    - Add RLS policies for box productions table
    - Add RLS policies for production items table

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on their role
*/

-- Production Plans Policies
CREATE POLICY "Allow admin and production to create plans"
ON production_plans
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'role')::text IN ('admin', 'production')
);

CREATE POLICY "Allow admin and production to read plans"
ON production_plans
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'role')::text IN ('admin', 'production')
);

-- Store Productions Policies
CREATE POLICY "Allow admin and production to create store productions"
ON store_productions
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'role')::text IN ('admin', 'production')
);

-- Box Productions Policies
CREATE POLICY "Allow admin and production to create box productions"
ON box_productions
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'role')::text IN ('admin', 'production')
);

-- Production Items Policies
CREATE POLICY "Allow admin and production to create production items"
ON production_items
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'role')::text IN ('admin', 'production')
);