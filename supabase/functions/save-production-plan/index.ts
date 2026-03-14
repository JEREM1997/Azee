import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

interface AuditActor {
  userId?: string | null;
  email?: string | null;
  role?: string | null;
}

interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  planId?: string | null;
  storeProductionId?: string | null;
  details?: Record<string, unknown>;
}

async function writeAuditLog(
  supabaseClient: any,
  actor: AuditActor,
  entry: AuditEntry
) {
  try {
    const { error } = await supabaseClient.from('audit_logs').insert({
      actor_user_id: actor.userId ?? null,
      actor_email: actor.email ?? null,
      actor_role: actor.role ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      plan_id: entry.planId ?? null,
      store_production_id: entry.storeProductionId ?? null,
      details: entry.details ?? {},
    });

    if (error) {
      console.error('[audit] failed to write log', {
        error,
        action: entry.action,
        entityType: entry.entityType,
      });
    }
  } catch (error) {
    console.error('[audit] unexpected write failure', error);
  }
}

function summarizePlanSnapshot(plan: any) {
  if (!plan) {
    return null;
  }

  const stores = Array.isArray(plan.stores) ? plan.stores : [];
  const summary = {
    date: plan.date ?? null,
    status: plan.status ?? null,
    store_count: stores.length,
    delivery_confirmed_count: 0,
    waste_reported_count: 0,
    production_item_count: 0,
    item_received_count: 0,
    item_waste_count: 0,
    box_count: 0,
    box_received_count: 0,
    box_waste_count: 0,
  };

  for (const store of stores) {
    if (store?.delivery_confirmed) {
      summary.delivery_confirmed_count += 1;
    }

    if (store?.waste_reported) {
      summary.waste_reported_count += 1;
    }

    for (const item of store?.production_items ?? []) {
      summary.production_item_count += 1;
      if (item?.received !== null && item?.received !== undefined) {
        summary.item_received_count += 1;
      }
      if (item?.waste !== null && item?.waste !== undefined) {
        summary.item_waste_count += 1;
      }
    }

    for (const box of store?.box_productions ?? []) {
      summary.box_count += 1;
      if (box?.received !== null && box?.received !== undefined) {
        summary.box_received_count += 1;
      }
      if (box?.waste !== null && box?.waste !== undefined) {
        summary.box_waste_count += 1;
      }
    }
  }

  return summary;
}

const isMissingTableError = (error: any) =>
  error?.code === '42P01' || error?.message?.includes('relation') || error?.message?.includes('does not exist');

interface PreparedStoreProduction {
  store_id: string;
  store_name: string;
  delivery_date?: string;
  total_quantity: number;
  items: Array<any>;
  boxes: Array<any>;
}

async function loadApprovedOrderAdjustments(supabaseClient: any, productionDate: string) {
  const { data: approvedOrders, error: ordersError } = await supabaseClient
    .from('orders')
    .select('id, store_id')
    .eq('production_approved', true)
    .eq('production_date', productionDate);

  if (ordersError) {
    if (isMissingTableError(ordersError)) {
      return {};
    }
    throw new Error(`Error reading approved orders: ${ordersError.message}`);
  }

  if (!approvedOrders?.length) {
    return {};
  }

  const orderIds = approvedOrders.map((order: any) => order.id);
  const orderStoreById = new Map(approvedOrders.map((order: any) => [order.id, order.store_id]));

  const { data: orderItems, error: itemsError } = await supabaseClient
    .from('order_items')
    .select('order_id, variety_id, quantity')
    .in('order_id', orderIds);

  if (itemsError) {
    if (isMissingTableError(itemsError)) {
      return {};
    }
    throw new Error(`Error reading approved order items: ${itemsError.message}`);
  }

  return (orderItems || []).reduce((acc: Record<string, Record<string, number>>, item: any) => {
    const storeId = orderStoreById.get(item.order_id);
    if (!storeId) {
      return acc;
    }

    if (!acc[storeId]) {
      acc[storeId] = {};
    }

    acc[storeId][item.variety_id] = (acc[storeId][item.variety_id] || 0) + (Number(item.quantity) || 0);
    return acc;
  }, {});
}

function subtractApprovedOrdersFromPlan(
  storeProductions: PreparedStoreProduction[],
  approvedOrderAdjustments: Record<string, Record<string, number>>,
  boxSizeMap: Map<any, any>
) {
  return storeProductions
    .map(store => {
      const approvedItems = approvedOrderAdjustments[store.store_id] || {};
      const nextItems = (store.items || [])
        .map(item => {
          const currentQuantity = Number(item?.quantity) || 0;
          const approvedQuantity = approvedItems[item.varietyId] || 0;
          const persistedQuantity = Math.max(currentQuantity - approvedQuantity, 0);

          if (persistedQuantity <= 0) {
            return null;
          }

          return {
            ...item,
            quantity: persistedQuantity,
          };
        })
        .filter(Boolean);

      const itemsTotal = nextItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
      const boxes = Array.isArray(store.boxes) ? store.boxes.filter((box: any) => (Number(box?.quantity) || 0) > 0) : [];
      const boxesTotal = boxes.reduce((sum: number, box: any) => {
        const boxSize = Number(boxSizeMap.get(box.boxId)) || 12;
        return sum + (Number(box.quantity) || 0) * boxSize;
      }, 0);

      return {
        ...store,
        items: nextItems,
        boxes,
        total_quantity: itemsTotal + boxesTotal,
      };
    })
    .filter(store => store.total_quantity > 0 || store.items.length > 0 || store.boxes.length > 0);
}

interface ProductionPlanRequest {
  date: string;
  totalProduction: number;
  status: string;
  userId: string;
  existingPlanId?: string;
  stores: Array<{
    store_id: string;
    store_name: string;
    delivery_date?: string;
    total_quantity: number;
    items?: Array<{
      varietyId: string;
      varietyName: string;
      formId: string;
      formName: string;
      quantity: number;
    }>;
    boxes?: Array<{
      boxId: string;
      boxName: string;
      quantity: number;
    }>;
  }>;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const planData: ProductionPlanRequest = await req.json();

    const requestedTotalProduction =
      typeof planData.totalProduction === 'number' && !isNaN(planData.totalProduction)
        ? planData.totalProduction
        : planData.stores?.reduce((acc, s) => acc + (s.total_quantity || 0), 0) ?? 0;

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    const { data: userData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    let userRole = userData?.role;
    if (!userRole && user.user_metadata?.role) {
      userRole = user.user_metadata.role;
    }

    if (!userRole) {
      return new Response(
        JSON.stringify({
          error: 'User role not found. Please contact your administrator to set up your account properly.'
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    if (!['admin', 'production'].includes(userRole)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    let plan;
    let previousPlanSummary = null;

    const { data: existingPlan, error: existingPlanError } = await supabaseClient
      .from('production_plans')
      .select('id')
      .eq('date', planData.date)
      .maybeSingle();

    if (existingPlanError) {
      throw new Error(`Error checking existing plan: ${existingPlanError.message}`);
    }

    const planId = planData.existingPlanId || existingPlan?.id;

    if (planId) {
      const { data: existingPlanSnapshot, error: existingPlanSnapshotError } = await supabaseClient
        .from('production_plans')
        .select(`
          id,
          date,
          status,
          stores:store_productions!store_productions_plan_id_fkey (
            id,
            delivery_confirmed,
            waste_reported,
            production_items (
              received,
              waste
            ),
            box_productions (
              received,
              waste
            )
          )
        `)
        .eq('id', planId)
        .maybeSingle();

      if (!existingPlanSnapshotError) {
        previousPlanSummary = summarizePlanSnapshot(existingPlanSnapshot);
      }
    }

    const { data: boxConfigs, error: boxConfigError } = await supabaseClient
      .from('box_configurations')
      .select('id, size');

    if (boxConfigError) {
      console.warn('Could not fetch box configurations, using fallback calculation:', boxConfigError.message);
    }

    const boxSizeMap = new Map();
    if (boxConfigs) {
      boxConfigs.forEach(box => {
        boxSizeMap.set(box.id, box.size);
      });
    }

    const preparedStoreProductions: PreparedStoreProduction[] = [];

    for (const store of planData.stores || []) {
      if (!store.store_id) {
        throw new Error(`Missing store ID for store: ${store.store_name || 'Unknown'}`);
      }

      if (!store.store_name) {
        throw new Error(`Missing store name for store ID: ${store.store_id}`);
      }

      let totalQuantity = 0;

      const itemsTotal = store.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
      totalQuantity += itemsTotal;

      let boxesTotal = 0;
      if (store.boxes && store.boxes.length > 0) {
        boxesTotal = store.boxes.reduce((sum: number, box: any) => {
          const boxSize = boxSizeMap.get(box.boxId) || 12;
          return sum + (box.quantity || 0) * boxSize;
        }, 0);
        totalQuantity += boxesTotal;
      }

      preparedStoreProductions.push({
        store_id: store.store_id,
        store_name: store.store_name,
        delivery_date: store.delivery_date,
        total_quantity: totalQuantity,
        items: store.items || [],
        boxes: store.boxes || [],
      });
    }

    const approvedOrderAdjustments = await loadApprovedOrderAdjustments(supabaseClient, planData.date);
    const persistedStoreProductions = subtractApprovedOrdersFromPlan(
      preparedStoreProductions,
      approvedOrderAdjustments,
      boxSizeMap
    );

    const persistedTotalProduction = persistedStoreProductions.reduce(
      (sum, store) => sum + (store.total_quantity || 0),
      0
    );

    try {
      const storeProductionsJson = JSON.stringify(persistedStoreProductions.map(store => ({
        store_id: store.store_id,
        store_name: store.store_name,
        delivery_date: store.delivery_date,
        total_quantity: store.total_quantity,
        items: store.items,
        boxes: store.boxes
      })));

      const { data: resultPlanId, error: functionError } = await supabaseClient
        .rpc('save_production_plan_safe', {
          p_plan_id: planId || null,
          p_date: planData.date,
          p_total_production: persistedTotalProduction,
          p_status: planData.status,
          p_created_by: user.id,
          p_store_productions: storeProductionsJson
        });

      if (functionError) {
        throw new Error(`Transaction error: ${functionError.message}`);
      }

      const { data: resultPlan, error: fetchError } = await supabaseClient
        .from('production_plans')
        .select('id')
        .eq('id', resultPlanId)
        .single();

      if (fetchError) {
        throw new Error(`Error fetching saved plan: ${fetchError.message}`);
      }

      plan = resultPlan;
    } catch (rpcError) {
      console.warn('RPC function not available, using manual approach:', rpcError);

      if (planId) {
        const { data: updatedPlan, error: updateError } = await supabaseClient
          .from('production_plans')
          .update({
            total_production: persistedTotalProduction,
            status: planData.status
          })
          .eq('id', planId)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Error updating plan: ${updateError.message}`);
        }

        plan = updatedPlan;

        const { error: deleteError } = await supabaseClient
          .from('store_productions')
          .delete()
          .eq('plan_id', planId);

        if (deleteError) {
          throw new Error(`Error deleting existing store productions: ${deleteError.message}`);
        }
      } else {
        const { data: newPlan, error: planError } = await supabaseClient
          .from('production_plans')
          .insert({
            date: planData.date,
            total_production: persistedTotalProduction,
            status: planData.status,
            created_by: user.id
          })
          .select()
          .single();

        if (planError) {
          throw new Error(`Error creating new plan: ${planError.message}`);
        }

        plan = newPlan;
      }

      for (const store of persistedStoreProductions) {
        const { data: storeProduction, error: storeError } = await supabaseClient
          .from('store_productions')
          .insert({
            plan_id: plan.id,
            store_id: store.store_id,
            store_name: store.store_name,
            total_quantity: store.total_quantity,
            deliverydate: store.delivery_date
          })
          .select()
          .single();

        if (storeError) {
          throw new Error(`Error creating store production for store ${store.store_name}: ${storeError.message}`);
        }

        if (store.items && store.items.length > 0) {
          const { error: itemsError } = await supabaseClient
            .from('production_items')
            .insert(
              store.items.map((item: any) => ({
                store_production_id: storeProduction.id,
                variety_id: item.varietyId,
                variety_name: item.varietyName,
                form_id: item.formId,
                form_name: item.formName,
                quantity: item.quantity
              }))
            );

          if (itemsError) {
            throw new Error(`Error creating production items for store ${store.store_name}: ${itemsError.message}`);
          }
        }

        if (store.boxes && store.boxes.length > 0) {
          const { error: boxesError } = await supabaseClient
            .from('box_productions')
            .insert(
              store.boxes.map((box: any) => ({
                store_production_id: storeProduction.id,
                box_id: box.boxId,
                box_name: box.boxName,
                quantity: box.quantity
              }))
            );

          if (boxesError) {
            throw new Error(`Error creating box productions for store ${store.store_name}: ${boxesError.message}`);
          }
        }
      }
    }

    await writeAuditLog(
      supabaseClient,
      {
        userId: user.id,
        email: user.email ?? null,
        role: userRole,
      },
      {
        action: planId ? 'plan.update' : 'plan.create',
        entityType: 'production_plan',
        entityId: plan.id,
        planId: plan.id,
        details: {
          plan_date: planData.date,
          requested_total_production: requestedTotalProduction,
          persisted_total_production: persistedTotalProduction,
          status: planData.status,
          store_count: persistedStoreProductions.length,
          approved_order_overlay_applied: true,
          approved_order_store_count: Object.keys(approvedOrderAdjustments).length,
          previous_plan_summary: previousPlanSummary,
          stores: persistedStoreProductions.map((store) => ({
            store_id: store.store_id,
            store_name: store.store_name,
            delivery_date: store.delivery_date ?? null,
            total_quantity: store.total_quantity,
            item_count: store.items.length,
            box_count: store.boxes.length,
          })),
        },
      }
    );

    return new Response(
      JSON.stringify({ id: plan.id }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (error) {
    console.error('Error in save-production-plan function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
});
