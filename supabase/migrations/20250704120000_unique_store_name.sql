-- Ensure each store name is unique so ON CONFLICT(name) works
ALTER TABLE stores
ADD CONSTRAINT stores_name_key UNIQUE (name);