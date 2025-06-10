-- Drop existing junction tables if they exist
DROP TABLE IF EXISTS store_varieties;
DROP TABLE IF EXISTS store_boxes;

-- Add array columns to stores table if they don't exist
DO $$ 
BEGIN
  -- Add available_varieties column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stores' AND column_name = 'available_varieties'
  ) THEN
    ALTER TABLE stores 
    ADD COLUMN available_varieties text[] DEFAULT '{}';
  END IF;

  -- Add available_boxes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stores' AND column_name = 'available_boxes'
  ) THEN
    ALTER TABLE stores 
    ADD COLUMN available_boxes text[] DEFAULT '{}';
  END IF;

  -- Add is_active column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stores' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE stores 
    ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Update RLS policies for stores table
DROP POLICY IF EXISTS "Admin users have full access to stores" ON stores;
CREATE POLICY "Admin users have full access to stores"
  ON stores FOR ALL TO authenticated
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');