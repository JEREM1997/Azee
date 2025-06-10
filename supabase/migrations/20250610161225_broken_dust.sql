/*
  # Add missing columns to stores table

  1. Changes
    - Add `available_varieties` column to stores table (text array)
    - Add `available_boxes` column to stores table (text array)
    
  2. Notes
    - Both columns are nullable with empty array defaults
    - These columns are needed for the store management functionality
*/

-- Add available_varieties column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'available_varieties'
  ) THEN
    ALTER TABLE stores ADD COLUMN available_varieties text[] DEFAULT '{}';
  END IF;
END $$;

-- Add available_boxes column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'available_boxes'
  ) THEN
    ALTER TABLE stores ADD COLUMN available_boxes text[] DEFAULT '{}';
  END IF;
END $$;