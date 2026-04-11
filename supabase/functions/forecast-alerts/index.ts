import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase env vars');

    const maxWape = Number(Deno.env.get('ALERT_MAX_WAPE') || '20');
    const maxStockout = Number(Deno.env.get('ALERT_MAX_STOCKOUT') || '15');
    const webhookUrl = Deno.env.get('ALERT_WEBHOOK_URL') || '';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: latest, error } = await supabase
      .from('forecast_kpi_snapshots')
      .select('snapshot_date, wape, stockout_rate, waste_rate, bias, observed_count')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!latest) {
      return new Response(JSON.stringify({ ok: true, message: 'No KPI snapshot found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const breaches: string[] = [];
    if ((latest.wape ?? 0) > maxWape) breaches.push(`WAPE ${(latest.wape ?? 0).toFixed(2)}% > ${maxWape}%`);
    if ((latest.stockout_rate ?? 0) > maxStockout) breaches.push(`Stockout ${(latest.stockout_rate ?? 0).toFixed(2)}% > ${maxStockout}%`);

    let webhookSent = false;
    if (breaches.length > 0 && webhookUrl) {
      const msg = {
        text: `⚠️ Forecast KPI alert (${latest.snapshot_date})\n${breaches.join('\n')}`
      };
      const hookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg)
      });
      webhookSent = hookRes.ok;
    }

    return new Response(JSON.stringify({
      ok: true,
      snapshot: latest,
      thresholds: { maxWape, maxStockout },
      breaches,
      webhookConfigured: Boolean(webhookUrl),
      webhookSent
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
