-- Sample seed data for local testing and demos
-- This inserts some stores, donut forms, varieties, box configurations and their relations.
-- It is safe to run multiple times thanks to ON CONFLICT DO NOTHING.

-- 1. Insert stores
INSERT INTO stores (id, name, location, is_active)
VALUES
  (gen_random_uuid(), 'Lausanne', 'Lausanne, CH', true),
  (gen_random_uuid(), 'Geneva', 'Geneva, CH', true),
  (gen_random_uuid(), 'Crissier', 'Crissier, CH', true)
ON CONFLICT DO NOTHING;

-- 2. Insert donut forms
INSERT INTO donut_forms (id, name, description, is_active)
VALUES
  (gen_random_uuid(), 'Ring', 'Classic ring-shaped doughnut', true),
  (gen_random_uuid(), 'Filled', 'Doughnut with a sweet filling', true),
  (gen_random_uuid(), 'Cake', 'Denser cake-style doughnut', true)
ON CONFLICT (name) DO NOTHING;

-- 3. Insert donut varieties
INSERT INTO donut_varieties (id, name, description, form_id, production_cost, is_active)
VALUES
  (gen_random_uuid(), 'Original Glazed', 'Signature glazed ring', (SELECT id FROM donut_forms WHERE name='Ring'), 0.35, true),
  (gen_random_uuid(), 'Chocolate Iced', 'Ring with chocolate icing', (SELECT id FROM donut_forms WHERE name='Ring'), 0.40, true),
  (gen_random_uuid(), 'Strawberry Sprinkles', 'Ring with strawberry icing & sprinkles', (SELECT id FROM donut_forms WHERE name='Ring'), 0.42, true),
  (gen_random_uuid(), 'Custard Filled', 'Filled with smooth custard', (SELECT id FROM donut_forms WHERE name='Filled'), 0.50, true),
  (gen_random_uuid(), 'Raspberry Filled', 'Filled with raspberry jam', (SELECT id FROM donut_forms WHERE name='Filled'), 0.50, true),
  (gen_random_uuid(), 'Cinnamon Cake', 'Cinnamon-coated cake doughnut', (SELECT id FROM donut_forms WHERE name='Cake'), 0.38, true)
ON CONFLICT (name) DO NOTHING;

-- 4. Insert box configurations
INSERT INTO box_configurations (id, name, size, is_active)
VALUES
  (gen_random_uuid(), 'Dozen Box', 12, true),
  (gen_random_uuid(), 'Half-Dozen Box', 6, true),
  (gen_random_uuid(), '3-Pack Box', 3, true)
ON CONFLICT (name) DO NOTHING;

-- 5. Assign varieties and boxes to stores (simplified)
--    Each active store gets all varieties & all box sizes.
INSERT INTO store_varieties (store_id, variety_id)
SELECT s.id, v.id
FROM stores s
JOIN donut_varieties v ON v.is_active = true
ON CONFLICT (store_id, variety_id) DO NOTHING;

INSERT INTO store_boxes (store_id, box_id)
SELECT s.id, b.id
FROM stores s
JOIN box_configurations b ON b.is_active = true
ON CONFLICT (store_id, box_id) DO NOTHING;

-- 6. (Optional) Insert a sample production plan for today so the UI has data immediately
DO $$
DECLARE
  plan_id uuid;
BEGIN
  -- Only insert if there is no plan for today
  IF NOT EXISTS (SELECT 1 FROM production_plans WHERE date = CURRENT_DATE) THEN
    INSERT INTO production_plans (id, date, created_by, total_production, status)
    VALUES (gen_random_uuid(), CURRENT_DATE, (SELECT id FROM auth.users LIMIT 1), 0, 'draft')
    RETURNING id INTO plan_id;

    -- For each store, create a store_production row and some items
    INSERT INTO store_productions (id, plan_id, store_id, store_name, total_quantity)
    SELECT gen_random_uuid(), plan_id, s.id::text, s.name, 0
    FROM stores s;

    -- Assign each store three random varieties with quantity 24
    INSERT INTO production_items (id, store_production_id, variety_id, variety_name, form_id, form_name, quantity)
    SELECT gen_random_uuid(), sp.id, v.id::text, v.name, v.form_id::text, (SELECT name FROM donut_forms f WHERE f.id = v.form_id), 24
    FROM store_productions sp
    JOIN donut_varieties v ON v.is_active
    WHERE sp.plan_id = plan_id
    ORDER BY random()
    LIMIT 30; -- approx

    -- Update total quantities in store_productions and plan
    UPDATE store_productions sp
    SET total_quantity = (
      SELECT COALESCE(SUM(quantity),0) FROM production_items pi WHERE pi.store_production_id = sp.id
    )
    WHERE sp.plan_id = plan_id;

    UPDATE production_plans pp
    SET total_production = (
      SELECT COALESCE(SUM(total_quantity),0) FROM store_productions WHERE plan_id = pp.id
    )
    WHERE pp.id = plan_id;
  END IF;
END $$; 