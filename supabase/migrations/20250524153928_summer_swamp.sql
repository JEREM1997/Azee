-- Enable RLS on all tables
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions ENABLE ROW LEVEL SECURITY;

-- Production Plans policies
CREATE POLICY "Allow admins to read all production plans"
ON production_plans
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY "Allow production users to read all production plans"
ON production_plans
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'production'
);

CREATE POLICY "Allow store users to read their store production plans"
ON production_plans
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'store' AND
  EXISTS (
    SELECT 1 FROM store_productions sp
    WHERE sp.plan_id = id
    AND sp.store_id = ANY((auth.jwt() ->> 'store_ids')::text[])
  )
);

-- Store Productions policies
CREATE POLICY "Allow admins to read all store productions"
ON store_productions
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY "Allow production users to read all store productions"
ON store_productions
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'production'
);

CREATE POLICY "Allow store users to read their own store productions"
ON store_productions
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'store' AND
  EXISTS (
    SELECT 1 FROM store_productions sp
    WHERE sp.id = store_production_id
    AND sp.store_id = ANY((auth.jwt() ->> 'store_ids')::text[])
  )
);

-- Production Items policies
CREATE POLICY "Allow admins to read all production items"
ON production_items
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY "Allow production users to read all production items"
ON production_items
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'production'
);

CREATE POLICY "Allow store users to read their store production items"
ON production_items
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'store' AND
  EXISTS (
    SELECT 1 FROM store_productions sp
    WHERE sp.id = store_production_id
    AND sp.store_id = ANY((auth.jwt() ->> 'store_ids')::text[])
  )
);

-- Box Productions policies
CREATE POLICY "Allow admins to read all box productions"
ON box_productions
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin'
);

CREATE POLICY "Allow production users to read all box productions"
ON box_productions
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'production'
);

CREATE POLICY "Allow store users to read their store box productions"
ON box_productions
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'store' AND
  EXISTS (
    SELECT 1 FROM store_productions sp
    WHERE sp.id = store_production_id
    AND sp.store_id = ANY((auth.jwt() ->> 'store_ids')::text[])
  )
);