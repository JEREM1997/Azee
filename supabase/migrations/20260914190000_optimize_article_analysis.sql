-- Indexes matching the filtered article-analysis access path.
CREATE INDEX IF NOT EXISTS idx_store_productions_plan_store ON public.store_productions (plan_id, store_id);
CREATE INDEX IF NOT EXISTS idx_production_items_variety_store ON public.production_items (variety_id, store_production_id);
CREATE INDEX IF NOT EXISTS idx_box_productions_box_store ON public.box_productions (box_id, store_production_id);
