/*
  # Add missing columns to stores table
  
  1. Changes
    - Add available_varieties column to stores table
    - Add available_boxes column to stores table
    
  2. Security
    - No changes to existing RLS policies
*/

-- Add missing columns to stores table if they don't exist
DO $$
BEGIN
  -- Add available_varieties column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'available_varieties'
  ) THEN
    ALTER TABLE stores ADD COLUMN available_varieties text[] DEFAULT '{}';
  END IF;

  -- Add available_boxes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'available_boxes'
  ) THEN
    ALTER TABLE stores ADD COLUMN available_boxes text[] DEFAULT '{}';
  END IF;
END $$;