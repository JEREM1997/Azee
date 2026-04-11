import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type MetricAccumulator = {
  absError: number;
  signedError: number;
  sold: number;
  waste: number;
  received: number;
  stockoutCount: number;
  observedCount: number;
};

const emptyAcc = (): MetricAccumulator => ({
  absError: 0,
  signedError: 0,
  sold: 0,
  waste: 0,
  received: 0,
  stockoutCount: 0,
  observedCount: 0
});

const toIso = (d: Date) => d.toISOString().slice(0, 10);

const safeRange = (start?: string, end?: string) => {
  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() - 1); // yesterday

  const defaultStart = new Date(defaultEnd);
  defaultStart.setDate(defaultStart.getDate() - 27); // 4 weeks

  return {
    startDate: start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : toIso(defaultStart),
    endDate: end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : toIso(defaultEnd)
  };
};

const computeKpis = (acc: MetricAccumulator) => {
  const wape = acc.sold > 0 ? (acc.absError / acc.sold) * 100 : 0;
  const bias = acc.sold > 0 ? (acc.signedError / acc.sold) * 100 : 0;
  const wasteRate = acc.received > 0 ? (acc.waste / acc.received) * 100 : 0;
  const stockoutRate = acc.observedCount > 0 ? (acc.stockoutCount / acc.observedCount) * 100 : 0;

  return {
    wape: Number(wape.toFixed(2)),
    bias: Number(bias.toFixed(2)),
    wasteRate: Number(wasteRate.toFixed(2)),
    stockoutRate: Number(stockoutRate.toFixed(2)),
    observedCount: acc.observedCount
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase environment variables');

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { startDate, endDate } = safeRange(body?.startDate, body?.endDate);

    const { data: plans, error } = await supabase
      .from('production_plans')
      .select(`
        id,
        date,
        stores:store_productions!store_productions_plan_id_fkey (
          store_id,
          production_items (quantity, received, waste),
          box_productions (quantity, received, waste)
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

    const globalAcc = emptyAcc();
    const byStore = new Map<string, MetricAccumulator>();

    for (const plan of plans || []) {
      for (const sp of plan.stores || []) {
        const storeId = sp.store_id as string;
        const acc = byStore.get(storeId) || emptyAcc();

        const rows = [
          ...(sp.production_items || []),
          ...(sp.box_productions || [])
        ];

        for (const row of rows) {
          if (row.received == null || row.waste == null) continue;

          const planned = Number(row.quantity || 0);
          const received = Number(row.received || 0);
          const waste = Math.max(0, Number(row.waste || 0));
          const sold = Math.max(0, received - waste);

          const errorQty = planned - sold;
          const isStockout = received > 0 && waste === 0;

          acc.absError += Math.abs(errorQty);
          acc.signedError += errorQty;
          acc.sold += sold;
          acc.waste += waste;
          acc.received += received;
          acc.observedCount += 1;
          if (isStockout) acc.stockoutCount += 1;

          globalAcc.absError += Math.abs(errorQty);
          globalAcc.signedError += errorQty;
          globalAcc.sold += sold;
          globalAcc.waste += waste;
          globalAcc.received += received;
          globalAcc.observedCount += 1;
          if (isStockout) globalAcc.stockoutCount += 1;
        }

        byStore.set(storeId, acc);
      }
    }

    const stores = Array.from(byStore.entries()).map(([storeId, acc]) => ({
      storeId,
      ...computeKpis(acc)
    })).sort((a, b) => b.observedCount - a.observedCount);

    return new Response(JSON.stringify({
      range: { startDate, endDate },
      global: computeKpis(globalAcc),
      stores,
      storesCount: stores.length
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
