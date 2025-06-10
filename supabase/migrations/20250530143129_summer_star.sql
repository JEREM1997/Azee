/*
  # Add store configuration columns

  1. Changes
    - Add `available_varieties` column to `stores` table (text array)
    - Add `available_boxes` column to `stores` table (text array)
    
  2. Notes
    - Both columns are nullable since not all stores may have varieties/boxes configured
    - Using text[] type to store UUIDs of available varieties and boxes
    - Default to empty array to avoid null handling issues
*/

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
END $$;