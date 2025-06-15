-- Add deliveryDate column to store_productions table
ALTER TABLE store_productions 
ADD COLUMN IF NOT EXISTS deliveryDate date; 