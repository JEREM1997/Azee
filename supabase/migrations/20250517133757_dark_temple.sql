-- Create tables for store management
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS donut_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS box_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  size integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS box_varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid REFERENCES box_configurations(id) ON DELETE CASCADE,
  variety_id uuid REFERENCES donut_varieties(id),
  quantity integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_varieties (
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  variety_id uuid REFERENCES donut_varieties(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (store_id, variety_id)
);

CREATE TABLE IF NOT EXISTS store_boxes (
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  box_id uuid REFERENCES box_configurations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (store_id, box_id)
);

-- Enable RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE donut_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_boxes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow admin to manage stores"
  ON stores FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin to manage donut forms"
  ON donut_forms FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin to manage donut varieties"
  ON donut_varieties FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin to manage box configurations"
  ON box_configurations FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin to manage box varieties"
  ON box_varieties FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin to manage store varieties"
  ON store_varieties FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Allow admin to manage store boxes"
  ON store_boxes FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create view policies for all users
CREATE POLICY "Allow all users to view stores"
  ON stores FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow all users to view donut forms"
  ON donut_forms FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow all users to view donut varieties"
  ON donut_varieties FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow all users to view box configurations"
  ON box_configurations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow all users to view box varieties"
  ON box_varieties FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow all users to view store varieties"
  ON store_varieties FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow all users to view store boxes"
  ON store_boxes FOR SELECT TO authenticated
  USING (true);