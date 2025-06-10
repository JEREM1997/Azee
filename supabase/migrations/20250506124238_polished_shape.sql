-- First, drop existing policies that we'll need to recreate
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Store users can view and update their store productions" ON store_productions;
  DROP POLICY IF EXISTS "Store users can view and update their production items" ON production_items;
  DROP POLICY IF EXISTS "Store users can view their box productions" ON box_productions;
END $$;

-- Modify user_roles table to support multiple stores
DO $$ 
BEGIN
  -- Drop the store_id column if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_roles'
    AND column_name = 'store_id'
  ) THEN
    ALTER TABLE user_roles DROP COLUMN store_id;
  END IF;

  -- Add store_ids array column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_roles'
    AND column_name = 'store_ids'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN store_ids text[] DEFAULT '{}';
  END IF;
END $$;

-- Update sync_user_role function
CREATE OR REPLACE FUNCTION sync_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user metadata when role or store_ids change
  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', NEW.role,
      'store_ids', NEW.store_ids
    )
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS sync_user_role_trigger ON user_roles;
CREATE TRIGGER sync_user_role_trigger
AFTER INSERT OR UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_user_role();

-- Create new policies with array checks
DO $$ 
BEGIN
  -- Store productions policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'store_productions' 
    AND policyname = 'Store users can view and update their store productions'
  ) THEN
    CREATE POLICY "Store users can view and update their store productions"
      ON store_productions
      FOR SELECT
      TO authenticated
      USING (
        auth.jwt() ->> 'role' = 'store' AND
        store_id = ANY((auth.jwt() ->> 'store_ids')::text[])
      );
  END IF;

  -- Production items policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'production_items' 
    AND policyname = 'Store users can view and update their production items'
  ) THEN
    CREATE POLICY "Store users can view and update their production items"
      ON production_items
      FOR SELECT
      TO authenticated
      USING (
        auth.jwt() ->> 'role' = 'store' AND
        store_production_id IN (
          SELECT id FROM store_productions
          WHERE store_id = ANY((auth.jwt() ->> 'store_ids')::text[])
        )
      );
  END IF;

  -- Box productions policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'box_productions' 
    AND policyname = 'Store users can view their box productions'
  ) THEN
    CREATE POLICY "Store users can view their box productions"
      ON box_productions
      FOR SELECT
      TO authenticated
      USING (
        auth.jwt() ->> 'role' = 'store' AND
        store_production_id IN (
          SELECT id FROM store_productions
          WHERE store_id = ANY((auth.jwt() ->> 'store_ids')::text[])
        )
      );
  END IF;
END $$;