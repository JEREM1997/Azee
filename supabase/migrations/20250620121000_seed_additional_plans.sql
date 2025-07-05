-- Additional sample plans for testing UI on fixed future dates
-- Inserts production plans for each day of July 2025 with basic store and item data.
-- Assumes seed_data.sql has already inserted stores, donut varieties, etc.

DO $$
DECLARE
  target_start date := '2025-07-01';
  target_end   date := '2025-07-31';
  current_date_iter date;
  plan_uuid uuid;
BEGIN
  current_date_iter := target_start;
  WHILE current_date_iter <= target_end LOOP
    -- Skip if plan already exists for the date
    IF NOT EXISTS (SELECT 1 FROM production_plans WHERE date::date = current_date_iter) THEN
      INSERT INTO production_plans (id, date, created_by, total_production, status)
      VALUES (gen_random_uuid(), current_date_iter::text, (SELECT id FROM auth.users LIMIT 1), 0, 'draft')
      RETURNING id INTO plan_uuid;

      -- For each existing store, create a store_production with 72 total (example)
      INSERT INTO store_productions (id, plan_id, store_id, store_name, total_quantity)
      SELECT gen_random_uuid(), plan_uuid, s.id::text, s.name, 72
      FROM stores s;

      -- For each store_production, attach three fixed varieties from the catalog with quantities
      INSERT INTO production_items (id, store_production_id, variety_id, variety_name, form_id, form_name, quantity)
      SELECT gen_random_uuid(), sp.id, v.id::text, v.name, v.form_id::text,
             (SELECT name FROM donut_forms f WHERE f.id = v.form_id), 24
      FROM store_productions sp
      JOIN (
        SELECT id, name, form_id FROM donut_varieties ORDER BY name LIMIT 3
      ) v ON TRUE
      WHERE sp.plan_id = plan_uuid;

      -- Update store_production totals
      UPDATE store_productions sp
      SET total_quantity = (
        SELECT COALESCE(SUM(quantity),0) FROM production_items pi WHERE pi.store_production_id = sp.id
      )
      WHERE sp.plan_id = plan_uuid;

      -- Update plan total
      UPDATE production_plans pp
      SET total_production = (
        SELECT COALESCE(SUM(total_quantity),0) FROM store_productions WHERE plan_id = pp.id
      )
      WHERE pp.id = plan_uuid;
    END IF;

    -- Next day
    current_date_iter := current_date_iter + INTERVAL '1 day';
  END LOOP;
END $$; 