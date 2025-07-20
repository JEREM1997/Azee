import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Config defaults – can be overridden via env secrets
const CONFIG = {
  BUFFER_INITIAL: parseFloat(Deno.env.get('AI_BUFFER_INITIAL') || '0.25'),
  BUFFER_MIN: parseFloat(Deno.env.get('AI_BUFFER_MIN') || '0.10'),
  BUFFER_STEP: parseFloat(Deno.env.get('AI_BUFFER_STEP') || '0.05'),
  MAX_WASTE_RATIO: parseFloat(Deno.env.get('AI_MAX_WASTE') || '0.30'),
  HISTORICAL_DAYS: parseInt(Deno.env.get('AI_HISTORICAL_DAYS') || '35', 10), // up to 5 weeks
  MIN_REQUIRED_DAYS: parseInt(Deno.env.get('AI_MIN_DAYS') || '1', 10),
  DEFAULT_LAUNCH_QTY: parseInt(Deno.env.get('AI_DEFAULT_LAUNCH') || '10', 10)
};

const weekdayToNumber: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

// Helper
function cleanUUID(value: string | null | undefined) {
  return (value || '').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing env vars');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await req.json();
    const targetDayStr: string = (body?.target_production_day || '').toString().toLowerCase();
    if (!weekdayToNumber.hasOwnProperty(targetDayStr)) {
      return new Response(JSON.stringify({ error: 'Invalid target_production_day' }), { status: 400, headers: corsHeaders });
    }

    const targetDow = weekdayToNumber[targetDayStr];

    // 1. Fetch historical plans within horizon
    const horizonStart = new Date();
    horizonStart.setDate(horizonStart.getDate() - CONFIG.HISTORICAL_DAYS);

    const { data: plans, error: planErr } = await supabase
      .from('production_plans')
      .select(`id,date,stores:store_productions!store_productions_plan_id_fkey (*, production_items (*), box_productions (*))`)
      .gte('date', horizonStart.toISOString().split('T')[0]);

    if (planErr) throw planErr;

    const filteredPlans = (plans || []).filter((p: any) => {
      const dow = new Date(p.date).getDay();
      return dow === targetDow;
    });

    if (filteredPlans.length < CONFIG.MIN_REQUIRED_DAYS) {
      return new Response(JSON.stringify({ error: 'Not enough historical data – at least 1 complete past production day for the same weekday is required to generate the AI prediction.' }), { status: 400, headers: corsHeaders });
    }

    // Map to store/product stats
    type Key = string; // `${store_id}|${product_id}|kind` where kind = 'variety' | 'box'

    interface Stats { qty: number; net: number; n: number; }
    const stats = new Map<Key, Stats>();

    for (const plan of filteredPlans) {
      for (const sp of plan.stores || []) {
        // varieties
        for (const item of sp.production_items || []) {
          if (item.received == null || item.waste == null) continue; // skip incomplete
          const key: Key = `${sp.store_id}|${item.variety_id}|var`;
          const s = stats.get(key) || { qty:0, net:0, n:0 };
          s.qty += item.received; // planned not needed
          s.net += (item.received - item.waste);
          s.n++;
          stats.set(key, s);
        }
        // boxes (treat as one product id)
        for (const box of sp.box_productions || []) {
          if (box.received == null || box.waste == null) continue;
          const key: Key = `${sp.store_id}|${box.box_id}|box`;
          const s = stats.get(key) || { qty:0, net:0, n:0 };
          s.qty += box.received;
          s.net += (box.received - box.waste);
          s.n++;
          stats.set(key, s);
        }
      }
    }

    // Build proposed plan
    interface InternalPlanItem { store: string; product: string; kind: 'var' | 'box'; quantity: number; note: string | null; buffer: number; }

    const draft: InternalPlanItem[] = [];
    const buffersUsed: number[] = []; // keep track of buffers applied per item for final_buffer calc

    for (const [key, s] of stats.entries()) {
      const [storeId, productId, kind] = key.split('|');
      const avgNetSales = s.net / s.n;

      let buffer = CONFIG.BUFFER_INITIAL;
      let proposedQty = Math.ceil(avgNetSales * (1 + buffer));
      let wasteRatio = (proposedQty - avgNetSales) / proposedQty;

      while (wasteRatio > CONFIG.MAX_WASTE_RATIO && buffer > CONFIG.BUFFER_MIN) {
        buffer = Math.max(buffer - CONFIG.BUFFER_STEP, CONFIG.BUFFER_MIN);
        proposedQty = Math.ceil(avgNetSales * (1 + buffer));
        wasteRatio = (proposedQty - avgNetSales) / proposedQty;
      }

      draft.push({
        store: storeId,
        product: productId,
        kind: kind as 'var' | 'box',
        quantity: proposedQty,
        note: null,
        buffer
      });
      buffersUsed.push(buffer);
    }

    // Handle new products (missing stats)
    // omitted for brevity

    // ===== Map IDs to human-readable names =====
    // We fetch only the identifiers that appear in the draft to minimise round-trips
    const storeIds = [...new Set(draft.map(i => i.store))];
    const productVarietyIds = [...new Set(draft.filter(i => i.kind === 'var').map(i => i.product))];
    const productBoxIds = [...new Set(draft.filter(i => i.kind === 'box').map(i => i.product))];

    const [{ data: storeRows }, { data: varietyRows }, { data: boxRows }] = await Promise.all([
      supabase.from('stores').select('id,name').in('id', storeIds),
      supabase.from('donut_varieties').select('id,name').in('id', productVarietyIds),
      supabase.from('box_configurations').select('id,name').in('id', productBoxIds)
    ]);

    const storeNameMap = new Map((storeRows || []).map((r: any) => [cleanUUID(r.id), r.name]));
    const varietyNameMap = new Map((varietyRows || []).map((r: any) => [cleanUUID(r.id), r.name]));
    const boxNameMap = new Map((boxRows || []).map((r: any) => [cleanUUID(r.id), r.name]));

    // Build final production_plan array matching the required schema
    const production_plan = draft.map(item => {
      const productName = item.kind === 'var'
        ? varietyNameMap.get(item.product) || item.product
        : boxNameMap.get(item.product) || item.product;

      return {
        product: productName,
        store: storeNameMap.get(item.store) || item.store,
        quantity: item.quantity,
        note: item.note,
        editable: true
      };
    });

    // Calculate final_buffer as the average buffer actually applied (rounded to 2 decimals)
    const final_buffer = buffersUsed.length > 0
      ? Math.round((buffersUsed.reduce((a, b) => a + b, 0) / buffersUsed.length) * 100) / 100
      : CONFIG.BUFFER_INITIAL;

    // Backward-compatibility array (IDs only) for existing front-end loader
    const production_items = draft.map(({ store, product, kind, quantity, note }) => ({
      store,
      product,
      kind,
      quantity,
      note
    }));

    const response = {
      target_production_day: targetDayStr,
      final_buffer,
      production_plan,
      production_items // keep legacy key so older UI can still load the draft
    };

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: corsHeaders });
  }
}); 