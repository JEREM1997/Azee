import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase env vars');

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetDate = (body?.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) ? body.date : isoDate(new Date());

    const syncRes = await fetch(`${supabaseUrl}/functions/v1/sync-daily-features`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey
      },
      body: JSON.stringify({ date: targetDate })
    });
    const syncPayload = await syncRes.json().catch(() => ({}));
    if (!syncRes.ok) {
      throw new Error(`sync-daily-features failed: ${JSON.stringify(syncPayload)}`);
    }

    const endDate = targetDate;
    const start = new Date(`${targetDate}T00:00:00Z`);
    start.setDate(start.getDate() - 27);
    const startDate = isoDate(start);

    const backtestRes = await fetch(`${supabaseUrl}/functions/v1/forecast-backtest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey
      },
      body: JSON.stringify({ startDate, endDate })
    });
    const backtestPayload = await backtestRes.json().catch(() => ({}));
    if (!backtestRes.ok) {
      throw new Error(`forecast-backtest failed: ${JSON.stringify(backtestPayload)}`);
    }

    const global = backtestPayload?.global || {};
    const { error: snapshotErr } = await supabase
      .from('forecast_kpi_snapshots')
      .upsert({
        snapshot_date: targetDate,
        range_start: backtestPayload?.range?.startDate || startDate,
        range_end: backtestPayload?.range?.endDate || endDate,
        wape: global.wape ?? null,
        bias: global.bias ?? null,
        waste_rate: global.wasteRate ?? null,
        stockout_rate: global.stockoutRate ?? null,
        observed_count: global.observedCount ?? null,
        details: backtestPayload
      }, { onConflict: 'snapshot_date' });

    if (snapshotErr) throw snapshotErr;

    return new Response(JSON.stringify({
      ok: true,
      targetDate,
      sync: syncPayload,
      backtestSummary: {
        range: backtestPayload?.range,
        global: backtestPayload?.global,
        storesCount: backtestPayload?.storesCount
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
