-- Forecast external signals tables (weather / holiday / promo)

CREATE TABLE IF NOT EXISTS public.weather_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date date NOT NULL,
  temp_max numeric,
  temp_min numeric,
  rain_mm numeric,
  weather_code text,
  source text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, date)
);

CREATE TABLE IF NOT EXISTS public.store_daily_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_holiday boolean NOT NULL DEFAULT false,
  holiday_name text,
  rain_mm numeric,
  promo_flag boolean NOT NULL DEFAULT false,
  promo_intensity numeric,
  weather_source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, date)
);

CREATE INDEX IF NOT EXISTS idx_weather_daily_store_date
  ON public.weather_daily (store_id, date);

CREATE INDEX IF NOT EXISTS idx_store_daily_features_store_date
  ON public.store_daily_features (store_id, date);

ALTER TABLE public.weather_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_daily_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read weather_daily" ON public.weather_daily;
CREATE POLICY "Authenticated read weather_daily"
  ON public.weather_daily
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated write weather_daily" ON public.weather_daily;
CREATE POLICY "Authenticated write weather_daily"
  ON public.weather_daily
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read store_daily_features" ON public.store_daily_features;
CREATE POLICY "Authenticated read store_daily_features"
  ON public.store_daily_features
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated write store_daily_features" ON public.store_daily_features;
CREATE POLICY "Authenticated write store_daily_features"
  ON public.store_daily_features
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weather_daily TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_daily_features TO authenticated;
