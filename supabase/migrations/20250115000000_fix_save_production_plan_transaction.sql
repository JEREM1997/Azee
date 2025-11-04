-- Migration: Add safe transaction function for saving production plans
-- This prevents data loss when saving production plans by wrapping delete+create in a transaction

CREATE OR REPLACE FUNCTION save_production_plan_safe(
  p_plan_id uuid,
  p_date date,
  p_total_production integer,
  p_status text,
  p_created_by uuid,
  p_store_productions text
) RETURNS uuid AS $$
DECLARE
  v_plan_id uuid;
  v_store_prod_id uuid;
  v_store jsonb;
  v_item jsonb;
  v_box jsonb;
  v_store_productions_jsonb jsonb;
BEGIN
  -- Parse JSON string to JSONB
  v_store_productions_jsonb := p_store_productions::jsonb;
  -- Start transaction (automatically handled by function)
  
  -- Update or insert the plan
  IF p_plan_id IS NOT NULL THEN
    -- Update existing plan
    UPDATE production_plans
    SET 
      total_production = p_total_production,
      status = p_status,
      updated_at = now()
    WHERE id = p_plan_id
    RETURNING id INTO v_plan_id;
    
    IF v_plan_id IS NULL THEN
      RAISE EXCEPTION 'Plan % not found', p_plan_id;
    END IF;
    
    -- Delete existing store productions (cascade will handle items and boxes)
    DELETE FROM store_productions WHERE plan_id = v_plan_id;
  ELSE
    -- Create new plan
    INSERT INTO production_plans (date, total_production, status, created_by)
    VALUES (p_date, p_total_production, p_status, p_created_by)
    RETURNING id INTO v_plan_id;
  END IF;

  -- Create store productions from JSONB
  FOR v_store IN SELECT * FROM jsonb_array_elements(v_store_productions_jsonb)
  LOOP
    -- Insert store production
    INSERT INTO store_productions (
      plan_id,
      store_id,
      store_name,
      total_quantity,
      deliverydate
    ) VALUES (
      v_plan_id,
      (v_store->>'store_id')::text,
      (v_store->>'store_name')::text,
      ((v_store->>'total_quantity')::integer),
      CASE WHEN v_store->>'delivery_date' IS NOT NULL 
        THEN (v_store->>'delivery_date')::date 
        ELSE NULL 
      END
    )
    RETURNING id INTO v_store_prod_id;

    -- Insert production items
    IF v_store->'items' IS NOT NULL AND jsonb_array_length(v_store->'items') > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_store->'items')
      LOOP
        INSERT INTO production_items (
          store_production_id,
          variety_id,
          variety_name,
          form_id,
          form_name,
          quantity
        ) VALUES (
          v_store_prod_id,
          (v_item->>'varietyId')::text,
          (v_item->>'varietyName')::text,
          (v_item->>'formId')::text,
          (v_item->>'formName')::text,
          ((v_item->>'quantity')::integer)
        );
      END LOOP;
    END IF;

    -- Insert box productions
    IF v_store->'boxes' IS NOT NULL AND jsonb_array_length(v_store->'boxes') > 0 THEN
      FOR v_box IN SELECT * FROM jsonb_array_elements(v_store->'boxes')
      LOOP
        INSERT INTO box_productions (
          store_production_id,
          box_id,
          box_name,
          quantity
        ) VALUES (
          v_store_prod_id,
          (v_box->>'boxId')::text,
          (v_box->>'boxName')::text,
          ((v_box->>'quantity')::integer)
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_plan_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction automatically rolls back on any error
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION save_production_plan_safe TO authenticated;
GRANT EXECUTE ON FUNCTION save_production_plan_safe TO service_role;

