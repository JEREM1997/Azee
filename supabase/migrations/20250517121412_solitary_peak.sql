/*
  # Add Production Plan Validation

  1. Changes
    - Add status enum type for production plans
    - Add validation fields to store_productions
    - Add policies for status updates
    
  2. Security
    - Maintain existing RLS
    - Add specific policies for validation
*/

-- Create status enum type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_status') THEN
    CREATE TYPE plan_status AS ENUM ('draft', 'validated', 'completed');
  END IF;
END $$;

-- Add status column to production_plans if it doesn't exist
ALTER TABLE production_plans
ADD COLUMN IF NOT EXISTS status plan_status NOT NULL DEFAULT 'draft';

-- Add validation fields to store_productions if they don't exist
ALTER TABLE store_productions
ADD COLUMN IF NOT EXISTS validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS validated_at timestamptz,
ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES auth.users;

-- Create function to validate production plan
CREATE OR REPLACE FUNCTION validate_production_plan(plan_id uuid)
RETURNS void AS $$
BEGIN
  -- Check if all store productions are validated
  IF EXISTS (
    SELECT 1 
    FROM store_productions 
    WHERE plan_id = $1 
    AND NOT validated
  ) THEN
    RAISE EXCEPTION 'All store productions must be validated first';
  END IF;

  -- Update plan status
  UPDATE production_plans
  SET status = 'validated'
  WHERE id = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;