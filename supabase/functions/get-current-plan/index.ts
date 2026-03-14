// @ts-ignore - Deno runtime environment
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-after',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const isMissingTableError = (error: any) =>
  error?.code === '42P01' || error?.message?.includes('relation') || error?.message?.includes('does not exist');

const normalizeStoreIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : [];

const cloneStorePlan = (store: any) => {
  const deliveryDate = store?.deliverydate ?? store?.delivery_date ?? null;

  return {
    ...store,
    deliverydate: deliveryDate,
    delivery_date: deliveryDate,
    total_quantity: Number(store?.total_quantity) || 0,
    production_items: Array.isArray(store?.production_items)
      ? store.production_items.map((item: any) => ({
          ...item,
          quantity: Number(item?.quantity) || 0,
        }))
      : [],
    box_productions: Array.isArray(store?.box_productions)
      ? store.box_productions.map((box: any) => ({
          ...box,
          quantity: Number(box?.quantity) || 0,
        }))
      : [],
    confirmed: !!store?.confirmed,
    delivery_confirmed: !!store?.delivery_confirmed,
    waste_reported: !!store?.waste_reported,
  };
};

const createVirtualPlan = (date: string) => ({
  id: '',
  date,
  total_production: 0,
  status: 'draft',
  stores: [],
});

async function fetchApprovedOrdersForRange(
  supabaseClient: any,
  startDate: string,
  endDate: string
) {
  const { data: ordersData, error: ordersError } = await supabaseClient
    .from('orders')
    .select('id, store_id, store_name, delivery_date, production_date')
    .eq('production_approved', true)
    .gte('production_date', startDate)
    .lte('production_date', endDate);

  if (ordersError) {
    if (isMissingTableError(ordersError)) {
      return [];
    }
    throw new Error(`Orders query failed: ${ordersError.message}`);
  }

  if (!ordersData?.length) {
    return [];
  }

  const orderIds = ordersData.map((order: any) => order.id);

  const { data: itemsData, error: itemsError } = await supabaseClient
    .from('order_items')
    .select('order_id, variety_id, quantity')
    .in('order_id', orderIds);

  if (itemsError) {
    if (isMissingTableError(itemsError)) {
      return [];
    }
    throw new Error(`Order items query failed: ${itemsError.message}`);
  }

  const itemsByOrder = (itemsData || []).reduce((acc: Record<string, any[]>, item: any) => {
    if (!acc[item.order_id]) {
      acc[item.order_id] = [];
    }
    acc[item.order_id].push(item);
    return acc;
  }, {});

  const varietyIds = [...new Set((itemsData || []).map((item: any) => item.variety_id))];
  const { data: varietiesData } = varietyIds.length
    ? await supabaseClient.from('donut_varieties').select('id, name, form_id').in('id', varietyIds)
    : { data: [] };

  const formIds = [...new Set((varietiesData || []).map((variety: any) => variety.form_id).filter(Boolean))];
  const { data: formsData } = formIds.length
    ? await supabaseClient.from('donut_forms').select('id, name').in('id', formIds)
    : { data: [] };

  const varietiesById = new Map((varietiesData || []).map((variety: any) => [variety.id, variety]));
  const formsById = new Map((formsData || []).map((form: any) => [form.id, form.name]));

  return ordersData.map((order: any) => ({
    ...order,
    items: (itemsByOrder[order.id] || []).map((item: any) => {
      const variety = varietiesById.get(item.variety_id);
      return {
        variety_id: item.variety_id,
        variety_name: variety?.name || item.variety_id,
        form_id: variety?.form_id || '',
        form_name: formsById.get(variety?.form_id) || 'Commande',
        quantity: Number(item.quantity) || 0,
        received: null,
        waste: null,
      };
    }),
  }));
}

function mergeApprovedOrdersIntoPlan(plan: any, approvedOrders: any[]) {
  if (!approvedOrders.length && !plan) {
    return null;
  }

  const nextPlan = plan
    ? {
        ...plan,
        stores: Array.isArray(plan.stores) ? plan.stores.map((store: any) => cloneStorePlan(store)) : [],
      }
    : createVirtualPlan(approvedOrders[0]?.production_date || '');

  const storesById = new Map(nextPlan.stores.map((store: any) => [store.store_id, store]));

  for (const order of approvedOrders) {
    let storePlan = storesById.get(order.store_id);

    if (!storePlan) {
      storePlan = cloneStorePlan({
        id: '',
        store_id: order.store_id,
        store_name: order.store_name || 'Magasin inconnu',
        total_quantity: 0,
        deliverydate: order.delivery_date,
        production_items: [],
        box_productions: [],
        confirmed: false,
        delivery_confirmed: false,
        waste_reported: false,
      });
      nextPlan.stores.push(storePlan);
      storesById.set(order.store_id, storePlan);
    }

    if (!storePlan.deliverydate) {
      storePlan.deliverydate = order.delivery_date;
      storePlan.delivery_date = order.delivery_date;
    }

    for (const orderItem of order.items || []) {
      const existingItem = storePlan.production_items.find(
        (item: any) => item.variety_id === orderItem.variety_id
      );

      if (existingItem) {
        existingItem.quantity = Number(existingItem.quantity || 0) + orderItem.quantity;
      } else {
        storePlan.production_items.push({ ...orderItem });
      }

      storePlan.total_quantity = Number(storePlan.total_quantity || 0) + orderItem.quantity;
    }
  }

  nextPlan.total_production = nextPlan.stores.reduce(
    (sum: number, store: any) => sum + Number(store.total_quantity || 0),
    0
  );

  return nextPlan;
}

// @ts-ignore - Deno global
Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // @ts-ignore - Deno env
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-ignore - Deno env
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));

    if (userError || !user) {
      throw new Error('Invalid token');
    }

    let requestedDate: string | null;
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      requestedDate = body?.date || null;
    } else {
      const url = new URL(req.url);
      requestedDate = url.searchParams.get('date');
    }

    requestedDate = requestedDate || new Date().toISOString().split('T')[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      throw new Error('Invalid date format');
    }

    const role = user.user_metadata?.role || user.app_metadata?.role;
    const storeIds = normalizeStoreIds(user.user_metadata?.store_ids ?? user.app_metadata?.store_ids);

    const { data: plan, error: dbError } = await supabaseClient
      .from('production_plans')
      .select(`
        id,
        date,
        total_production,
        status,
        stores:store_productions!store_productions_plan_id_fkey (
          id,
          store_id,
          store_name,
          total_quantity,
          deliverydate,
          confirmed,
          delivery_confirmed,
          waste_reported,
          production_items (
            id,
            variety_id,
            variety_name,
            form_id,
            form_name,
            quantity,
            received,
            waste
          ),
          box_productions (
            id,
            box_id,
            box_name,
            quantity,
            received,
            waste
          )
        )
      `)
      .eq('date', requestedDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError && dbError.code !== 'PGRST116') {
      throw new Error(`Database error: ${dbError.message}`);
    }

    const approvedOrders = await fetchApprovedOrdersForRange(supabaseClient, requestedDate, requestedDate);
    let mergedPlan = mergeApprovedOrdersIntoPlan(plan, approvedOrders);

    if (!mergedPlan) {
      return new Response(JSON.stringify(null), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    if (role === 'store') {
      if (!storeIds.length) {
        return new Response(JSON.stringify(null), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      mergedPlan.stores = mergedPlan.stores.filter((store: any) => storeIds.includes(store.store_id));
      mergedPlan.total_production = mergedPlan.stores.reduce(
        (sum: number, store: any) => sum + Number(store.total_quantity || 0),
        0
      );

      if (!mergedPlan.stores.length) {
        return new Response(JSON.stringify(null), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    }

    return new Response(JSON.stringify(mergedPlan), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('[get-current-plan] Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Unknown error',
        details: error?.stack,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});

