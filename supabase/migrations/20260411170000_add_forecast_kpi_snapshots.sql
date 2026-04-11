-- Store periodic KPI snapshots produced by forecast-backtest

CREATE TABLE IF NOT EXISTS public.forecast_kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  range_start date NOT NULL,
  range_end date NOT NULL,
  wape numeric,
  bias numeric,
  waste_rate numeric,
  stockout_rate numeric,
  observed_count integer,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_forecast_kpi_snapshots_snapshot_date
  ON public.forecast_kpi_snapshots (snapshot_date DESC);

ALTER TABLE public.forecast_kpi_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read forecast_kpi_snapshots" ON public.forecast_kpi_snapshots;
CREATE POLICY "Authenticated read forecast_kpi_snapshots"
  ON public.forecast_kpi_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated write forecast_kpi_snapshots" ON public.forecast_kpi_snapshots;
CREATE POLICY "Authenticated write forecast_kpi_snapshots"
  ON public.forecast_kpi_snapshots
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_kpi_snapshots TO authenticated;
