-- Allow created_by to be NULL so seed data can insert even when no user exists yet
ALTER TABLE production_plans
ALTER COLUMN created_by DROP NOT NULL; 