-- Schedule daily maintenance orchestration (sync features + backtest + snapshot)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_run_forecast_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_url text := current_setting('app.settings.supabase_url', true);
  service_key text := current_setting('app.settings.service_role_key', true);
  target_date text := (now() AT TIME ZONE 'utc')::date::text;
BEGIN
  IF base_url IS NULL OR service_key IS NULL THEN
    RAISE EXCEPTION 'Missing app.settings.supabase_url or app.settings.service_role_key';
  END IF;

  PERFORM net.http_post(
    url := base_url || '/functions/v1/run-forecast-maintenance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key,
      'apikey', service_key
    ),
    body := jsonb_build_object('date', target_date)::text
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-forecast-maintenance-daily') THEN
    PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'run-forecast-maintenance-daily' LIMIT 1));
  END IF;

  PERFORM cron.schedule(
    'run-forecast-maintenance-daily',
    '30 4 * * *',
    $$SELECT public.trigger_run_forecast_maintenance();$$
  );
END $$;
