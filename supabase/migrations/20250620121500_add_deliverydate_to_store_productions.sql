-- Add deliverydate column for UI and functions compatibility
-- Uses snake_case previously (delivery_date) but functions expect deliverydate without underscore.
-- We add both and keep them in sync via triggers for flexibility.

-- 1. Add column if not exists
ALTER TABLE store_productions
ADD COLUMN IF NOT EXISTS deliverydate date;

-- 2. Add legacy snake_case column if not exists and sync triggers (optional)
ALTER TABLE store_productions
ADD COLUMN IF NOT EXISTS delivery_date date;

-- 3. Create triggers to keep columns in sync (only if both present)
CREATE OR REPLACE FUNCTION sync_deliverydate_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.deliverydate IS NULL AND NEW.delivery_date IS NOT NULL THEN
      NEW.deliverydate := NEW.delivery_date;
    ELSIF NEW.delivery_date IS NULL AND NEW.deliverydate IS NOT NULL THEN
      NEW.delivery_date := NEW.deliverydate;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_deliverydate ON store_productions;
CREATE TRIGGER trg_sync_deliverydate
BEFORE INSERT OR UPDATE ON store_productions
FOR EACH ROW EXECUTE FUNCTION sync_deliverydate_columns(); 