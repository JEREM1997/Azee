DO $$
DECLARE
  primary_id uuid;
  duplicate_id uuid;
BEGIN
  -- Deduplicate donut_forms by keeping the first id for each name
  WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
    FROM donut_forms
  )
  DELETE FROM donut_forms d
  USING duplicates dup
  WHERE d.id = dup.id AND dup.rn > 1;

  -- Handle donut_varieties duplicates carefully due to foreign key references
  FOR primary_id, duplicate_id IN
    WITH duplicates AS (
      SELECT id,
             FIRST_VALUE(id) OVER (PARTITION BY name ORDER BY id) as kept_id,
             ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
      FROM donut_varieties
    )
    SELECT kept_id, id
    FROM duplicates
    WHERE rn > 1
  LOOP
    -- Delete any store_varieties entries that would cause duplicates after the update
    DELETE FROM store_varieties sv1
    WHERE sv1.variety_id = duplicate_id
    AND EXISTS (
      SELECT 1 FROM store_varieties sv2
      WHERE sv2.store_id = sv1.store_id
      AND sv2.variety_id = primary_id
    );

    -- Delete any box_varieties entries that would cause duplicates after the update
    DELETE FROM box_varieties bv1
    WHERE bv1.variety_id = duplicate_id
    AND EXISTS (
      SELECT 1 FROM box_varieties bv2
      WHERE bv2.box_id = bv1.box_id
      AND bv2.variety_id = primary_id
    );

    -- Now safe to update remaining references
    UPDATE box_varieties
    SET variety_id = primary_id
    WHERE variety_id = duplicate_id;

    UPDATE store_varieties
    SET variety_id = primary_id
    WHERE variety_id = duplicate_id;

    UPDATE production_items
    SET variety_id = primary_id::text
    WHERE variety_id = duplicate_id::text;

    -- Now safe to delete the duplicate
    DELETE FROM donut_varieties WHERE id = duplicate_id;
  END LOOP;

  -- Deduplicate box_configurations
  FOR primary_id, duplicate_id IN
    WITH duplicates AS (
      SELECT id,
             FIRST_VALUE(id) OVER (PARTITION BY name ORDER BY id) as kept_id,
             ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
      FROM box_configurations
    )
    SELECT kept_id, id
    FROM duplicates
    WHERE rn > 1
  LOOP
    -- Delete any store_boxes entries that would cause duplicates after the update
    DELETE FROM store_boxes sb1
    WHERE sb1.box_id = duplicate_id
    AND EXISTS (
      SELECT 1 FROM store_boxes sb2
      WHERE sb2.store_id = sb1.store_id
      AND sb2.box_id = primary_id
    );

    -- Delete any box_varieties entries that would cause duplicates after the update
    DELETE FROM box_varieties bv1
    WHERE bv1.box_id = duplicate_id
    AND EXISTS (
      SELECT 1 FROM box_varieties bv2
      WHERE bv2.variety_id = bv1.variety_id
      AND bv2.box_id = primary_id
    );

    -- Now safe to update remaining references
    UPDATE box_varieties
    SET box_id = primary_id
    WHERE box_id = duplicate_id;

    UPDATE store_boxes
    SET box_id = primary_id
    WHERE box_id = duplicate_id;

    UPDATE box_productions
    SET box_id = primary_id::text
    WHERE box_id = duplicate_id::text;

    -- Now safe to delete the duplicate
    DELETE FROM box_configurations WHERE id = duplicate_id;
  END LOOP;

  -- Deduplicate stores (if duplicates exist)
  FOR primary_id, duplicate_id IN
    WITH duplicates AS (
      SELECT id,
             FIRST_VALUE(id) OVER (PARTITION BY name ORDER BY id) as kept_id,
             ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS rn
      FROM stores
    )
    SELECT kept_id, id
    FROM duplicates
    WHERE rn > 1
  LOOP
    -- Delete any store_varieties entries that would cause duplicates after the update
    DELETE FROM store_varieties sv1
    WHERE sv1.store_id = duplicate_id
    AND EXISTS (
      SELECT 1 FROM store_varieties sv2
      WHERE sv2.variety_id = sv1.variety_id
      AND sv2.store_id = primary_id
    );

    -- Delete any store_boxes entries that would cause duplicates after the update
    DELETE FROM store_boxes sb1
    WHERE sb1.store_id = duplicate_id
    AND EXISTS (
      SELECT 1 FROM store_boxes sb2
      WHERE sb2.box_id = sb1.box_id
      AND sb2.store_id = primary_id
    );

    -- Now safe to update remaining references
    UPDATE store_varieties
    SET store_id = primary_id
    WHERE store_id = duplicate_id;

    UPDATE store_boxes
    SET store_id = primary_id
    WHERE store_id = duplicate_id;

    UPDATE store_productions
    SET store_id = primary_id::text
    WHERE store_id = duplicate_id::text;

    -- Now safe to delete the duplicate
    DELETE FROM stores WHERE id = duplicate_id;
  END LOOP;
END $$;

-- Now add unique constraints
ALTER TABLE donut_forms
  ADD CONSTRAINT donut_forms_name_key UNIQUE (name);

ALTER TABLE donut_varieties
  ADD CONSTRAINT donut_varieties_name_key UNIQUE (name);

ALTER TABLE box_configurations
  ADD CONSTRAINT box_configurations_name_key UNIQUE (name);

ALTER TABLE stores
  ADD CONSTRAINT stores_name_key UNIQUE (name);