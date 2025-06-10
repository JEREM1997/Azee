-- Drop existing policies first
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Production management" ON production_plans;
  DROP POLICY IF EXISTS "Store productions management" ON store_productions;
  DROP POLICY IF EXISTS "Production items management" ON production_items;
  DROP POLICY IF EXISTS "Box productions management" ON box_productions;
END $$;

-- Create auth.role() function for easier role checks
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb)->>'role',
    'authenticated'
  );
$$;

-- Enable RLS
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_productions ENABLE ROW LEVEL SECURITY;

-- Create simplified policies using role() function
CREATE POLICY "Production management"
  ON production_plans
  FOR ALL
  TO authenticated
  USING (
    auth.role() = ANY (ARRAY['admin'::text, 'production'::text])
  )
  WITH CHECK (
    auth.role() = ANY (ARRAY['admin'::text, 'production'::text])
  );

CREATE POLICY "Store productions management"
  ON store_productions
  FOR ALL
  TO authenticated
  USING (
    auth.role() = ANY (ARRAY['admin'::text, 'production'::text])
  )
  WITH CHECK (
    auth.role() = ANY (ARRAY['admin'::text, 'production'::text])
  );

CREATE POLICY "Production items management"
  ON production_items
  FOR ALL
  TO authenticated
  USING (
    auth.role() = ANY (ARRAY['admin'::text, 'production'::text])
  )
  WITH CHECK (
    auth.role() = ANY (ARRAY['admin'::text, 'production'::text])
  );

CREATE POLICY "Box productions management"
  ON box_productions
  FOR ALL
  TO authenticated
  USING (
    auth.role() = ANY (ARRAY['admin'::text, 'production'::text])
  )
  WITH CHECK (
    auth.role() = ANY (ARRAY['admin'::text, 'production'::text])
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;