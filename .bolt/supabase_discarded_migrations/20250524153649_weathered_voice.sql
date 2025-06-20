-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create donut forms table
CREATE TABLE IF NOT EXISTS donut_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create donut varieties table
CREATE TABLE IF NOT EXISTS donut_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  form_id uuid REFERENCES donut_forms(id),
  production_cost decimal(10,2) NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create box configurations table
CREATE TABLE IF NOT EXISTS box_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  size integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create box varieties table
CREATE TABLE IF NOT EXISTS box_varieties (
  box_id uuid REFERENCES box_configurations(id) ON DELETE CASCADE,
  variety_id uuid REFERENCES donut_varieties(id) ON DELETE CASCADE,
  quantity integer NOT NULL,
  PRIMARY KEY (box_id, variety_id)
);

-- Create store varieties table
CREATE TABLE IF NOT EXISTS store_varieties (
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  variety_id uuid REFERENCES donut_varieties(id) ON DELETE CASCADE,
  PRIMARY KEY (store_id, variety_id)
);

-- Create store boxes table
CREATE TABLE IF NOT EXISTS store_boxes (
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  box_id uuid REFERENCES box_configurations(id) ON DELETE CASCADE,
  PRIMARY KEY (store_id, box_id)
);

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_boxes ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admin users have full access to stores"
  ON stores FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin users have full access to donut forms"
  ON donut_forms FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin users have full access to donut varieties"
  ON donut_varieties FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin users have full access to box configurations"
  ON box_configurations FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin users have full access to box varieties"
  ON box_varieties FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin users have full access to store varieties"
  ON store_varieties FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin users have full access to store boxes"
  ON store_boxes FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

-- Create policies for read access
CREATE POLICY "Authenticated users can read stores"
  ON stores FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read donut forms"
  ON donut_forms FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read donut varieties"
  ON donut_varieties FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read box configurations"
  ON box_configurations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read box varieties"
  ON box_varieties FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read store varieties"
  ON store_varieties FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read store boxes"
  ON store_boxes FOR SELECT TO authenticated
  USING (true);