-- Add updated_at column to production_plans table
-- This fixes the error "Could not find the 'updated_at' column of 'production_plans' in the schema cache"

ALTER TABLE production_plans 
ADD COLUMN updated_at timestamptz DEFAULT now();

-- Create a trigger to automatically update the updated_at column when a record is modified
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_production_plans_updated_at 
    BEFORE UPDATE ON production_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 