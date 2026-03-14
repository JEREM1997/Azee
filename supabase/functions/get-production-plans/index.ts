// @ts-ignore - Deno runtime environment
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    .select('id, store_id, store_name, delivery_date, production_date, customer_name, company_name, customer_phone, handled_by, delivered_by, comments')
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
    
    .in('order_id', orderIds);
    .select('order_id, variety_id, quantity, conditioning')
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
        conditioning: item.conditioning ?? null,
        received: Number(item.quantity) || 0,
        waste: 0,
        received: null,
        waste: null,
      };
    }),
  }));
}

function createDeliveryEntryFromStore(store: any, productionDate: string) {
  const clonedStore = cloneStorePlan(store);

  return {
    ...clonedStore,
    id: clonedStore.id || `plan:${productionDate}:${clonedStore.store_id}`,
    source_type: 'plan',
    source_label: 'Plan habituel',
    source_order_id: null,
    production_date: productionDate,
    customer_name: null,
    company_name: null,
    customer_phone: null,
    comments: null,
  };
}

function createDeliveryEntryFromOrder(order: any) {
  const totalQuantity = (order.items || []).reduce(
    (sum: number, item: any) => sum + (Number(item.quantity) || 0),
    0
  );

  return {
    id: `order:${order.id}`,
    store_id: order.store_id,
    store_name: order.store_name || 'Magasin inconnu',
    deliverydate: order.delivery_date,
    delivery_date: order.delivery_date,
    total_quantity: totalQuantity,
    confirmed: false,
    delivery_confirmed: true,
    waste_reported: true,
    production_items: (order.items || []).map((item: any) => ({
      ...item,
      id: `order-item:${order.id}:${item.variety_id}`,
      received: Number(item.quantity) || 0,
      waste: 0,
    })),
    box_productions: [],
    source_type: 'order',
    source_label: 'Commande',
    source_order_id: order.id,
    production_date: order.production_date,
    customer_name: order.customer_name || null,
    company_name: order.company_name || null,
    customer_phone: order.customer_phone || null,
    handled_by: order.handled_by || null,
    delivered_by: order.delivered_by || null,
    comments: order.comments || null,
  };
}

function buildDeliveryEntries(plan: any, approvedOrders: any[], productionDate: string) {
  const planEntries = (plan?.stores || []).map((store: any) =>
    createDeliveryEntryFromStore(store, productionDate)
  );
  const orderEntries = approvedOrders.map((order: any) => createDeliveryEntryFromOrder(order));

  return [...planEntries, ...orderEntries];
}

function mergeApprovedOrdersIntoPlan(plan: any, approvedOrders: any[], date: string) {
  if (!plan && !approvedOrders.length) {
    return null;
  }

  const nextPlan = plan
    ? {
        ...plan,
        stores: Array.isArray(plan.stores) ? plan.stores.map((store: any) => cloneStorePlan(store)) : [],
      }
    : createVirtualPlan(date);

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
        existingItem.received = Number(existingItem.received || 0) + Number(orderItem.received || orderItem.quantity || 0);
        existingItem.waste = Number(existingItem.waste || 0) + Number(orderItem.waste || 0);
        if (!existingItem.conditioning && orderItem.conditioning) {
          existingItem.conditioning = orderItem.conditioning;
        } 
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

function filterPlanForStoreRole(plan: any, storeIds: string[]) {
  if (!storeIds.length) {
    return null;
  }

  const filteredStores = (plan.stores || []).filter((store: any) => storeIds.includes(store.store_id));
  const filteredDeliveryEntries = (plan.delivery_entries || []).filter((entry: any) =>
    storeIds.includes(entry.store_id)
  );

  if (!filteredStores.length && !filteredDeliveryEntries.length) {
    return null;
  }

  if (!filteredStores.length) {
    return {
      ...plan,
      stores: [],
      delivery_entries: filteredDeliveryEntries,
      total_production: 0,
    };
  }

  return {
    ...plan,
    stores: filteredStores,
    delivery_entries: filteredDeliveryEntries,
    total_production: filteredStores.reduce(
      (sum: number, store: any) => sum + Number(store.total_quantity || 0),
      0
    ),
  };
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

    const requestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const startDate = requestBody?.startDate || url.searchParams.get('startDate');
    const endDate = requestBody?.endDate || url.searchParams.get('endDate');

    if (!startDate || !endDate) {
      throw new Error('Missing required startDate or endDate');
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new Error('Invalid date format');
    }

    const role = user.user_metadata?.role || user.app_metadata?.role;
    const storeIds = normalizeStoreIds(user.user_metadata?.store_ids ?? user.app_metadata?.store_ids);

    const { data: plans, error: dbError } = await supabaseClient
      .from('production_plans')
      .select(`
        id,
        date,
        total_production,
        status,
        created_at,
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
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    const approvedOrders = await fetchApprovedOrdersForRange(supabaseClient, startDate, endDate);

    const plansByDate = new Map<string, any>();
    for (const plan of plans || []) {
      if (!plansByDate.has(plan.date)) {
        plansByDate.set(plan.date, plan);
      }
    }

    const approvedOrdersByDate = new Map<string, any[]>();
    for (const order of approvedOrders) {
      if (!approvedOrdersByDate.has(order.production_date)) {
        approvedOrdersByDate.set(order.production_date, []);
      }
      approvedOrdersByDate.get(order.production_date)?.push(order);
    }

    const allDates = [...new Set([...plansByDate.keys(), ...approvedOrdersByDate.keys()])].sort((left, right) =>
      left < right ? 1 : left > right ? -1 : 0
    );

    const mergedPlans = allDates
      .map(date => {
        const basePlan = plansByDate.get(date) || null;
        const dateApprovedOrders = approvedOrdersByDate.get(date) || [];
        const mergedPlan = mergeApprovedOrdersIntoPlan(basePlan, dateApprovedOrders, date);

        if (!mergedPlan) {
          return null;
        }

        return {
          ...mergedPlan,
          delivery_entries: buildDeliveryEntries(basePlan, dateApprovedOrders, date),
        };
      })
      .filter(Boolean)
      .map(plan => (role === 'store' ? filterPlanForStoreRole(plan, storeIds) : plan))
      .filter(Boolean);

    return new Response(JSON.stringify(mergedPlans), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('[get-production-plans] Edge function error:', error);
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
