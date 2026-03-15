ALTER TABLE donut_varieties
  ADD COLUMN IF NOT EXISTS is_orderable boolean NOT NULL DEFAULT true;
