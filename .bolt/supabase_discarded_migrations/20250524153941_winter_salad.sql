-- Enable RLS on production_plans
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;

-- Create policies for production_plans
CREATE POLICY "Admin users can access all production plans"
ON production_plans
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'role' IN ('admin', 'production')
);

CREATE POLICY "Store users can access their store production plans"
ON production_plans
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'store' AND
  EXISTS (
    SELECT 1 FROM store_productions sp
    WHERE sp.plan_id = production_plans.id
    AND sp.store_id = ANY(string_to_array(auth.jwt() ->> 'store_ids', ','))
  )
);

-- Enable RLS on store_productions
ALTER TABLE store_productions ENABLE ROW LEVEL SECURITY;

-- Create policies for store_productions
CREATE POLICY "Admin users can access all store productions"
ON store_productions
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'role' IN ('admin', 'production')
);

CREATE POLICY "Store users can access their store productions"
ON store_productions
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'store' AND
  store_id = ANY(string_to_array(auth.jwt() ->> 'store_ids', ','))
);