-- Migration: Add single draft production plan for 20-Aug-2025
-- Inserts only if a plan for that date does not already exist.

DO $$
DECLARE
  plan_uuid uuid;
BEGIN
  -- Only insert if there is no plan for 2025-08-20
  IF NOT EXISTS (
    SELECT 1 FROM production_plans WHERE date::date = '2025-08-20'
  ) THEN
    INSERT INTO production_plans (id, date, created_by, total_production, status)
    VALUES (
      gen_random_uuid(),
      '2025-08-20',
      (SELECT id FROM auth.users LIMIT 1),
      0,
      'draft'
    )
    RETURNING id INTO plan_uuid;

    -- Insert an empty store_production for each active store so the plan appears in UI
    INSERT INTO store_productions (id, plan_id, store_id, store_name, total_quantity)
    SELECT gen_random_uuid(), plan_uuid, s.id::text, s.name, 0
    FROM stores s
    WHERE s.is_active = true;
  END IF;
END $$; 