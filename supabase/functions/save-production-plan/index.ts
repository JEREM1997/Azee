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
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    // Create Supabase client with service role key to bypass RLS
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

    // Get request data
    const planData: ProductionPlanRequest = await req.json();

    // Ensure totalProduction is populated (frontend normally sends it, but add fallback to be safe)
    const resolvedTotalProduction =
      typeof planData.totalProduction === 'number' && !isNaN(planData.totalProduction)
        ? planData.totalProduction
        : planData.stores?.reduce((acc, s) => acc + (s.total_quantity || 0), 0) ?? 0;

    // Get the authorization header
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

    // Get user from auth header
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

    // First try to get user role from user_roles table
    const { data: userData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    // If no role found in user_roles table, check user metadata
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

    // Check if a plan already exists for this date
    console.log(`[DB DEBUG] Checking existing plan for date: ${planData.date}`);
    const { data: existingPlan, error: existingPlanError } = await supabaseClient
      .from('production_plans')
      .select('id')
      .eq('date', planData.date)
      .maybeSingle();

    console.log(`[DB DEBUG] Existing plan query result:`, existingPlan ? JSON.stringify(existingPlan) : 'null');
    console.log(`[DB DEBUG] Existing plan error:`, existingPlanError ? existingPlanError.message : 'null');

    if (existingPlanError) {
      console.error(`[DB DEBUG] Error checking existing plan:`, existingPlanError);
      throw new Error(`Error checking existing plan: ${existingPlanError.message}`);
    }

    const planId = planData.existingPlanId || existingPlan?.id;
    console.log(`[DB DEBUG] Resolved planId:`, planId || 'null (will create new plan)');

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

      if (existingPlanSnapshotError) {
        console.warn('[audit] could not load existing plan snapshot', existingPlanSnapshotError.message);
      } else {
        previousPlanSummary = summarizePlanSnapshot(existingPlanSnapshot);
      }
    }


    // Get box configurations to calculate proper totals (do this BEFORE any deletes)
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

    // PREPARE ALL DATA FIRST (before any deletes) - this validates the data structure
    const preparedStoreProductions: Array<{
      store_id: string;
      store_name: string;
      delivery_date?: string;
      total_quantity: number;
      items: Array<any>;
      boxes: Array<any>;
    }> = [];

    console.log(`[DB DEBUG] Processing ${planData.stores?.length || 0} stores from request`);
    
    // Allow empty stores array - user might be creating a draft plan
    if (!planData.stores || planData.stores.length === 0) {
      console.log(`[DB DEBUG] No stores in request - creating empty plan`);
    }

    for (const store of planData.stores || []) {
      // Validate before processing
      if (!store.store_id) {
        throw new Error(`Missing store ID for store: ${store.store_name || 'Unknown'}`);
      }

      if (!store.store_name) {
        throw new Error(`Missing store name for store ID: ${store.store_id}`);
      }

      // Calculate total_quantity from items and boxes
      let totalQuantity = 0;
      
      // Calculate from items (individual doughnuts)
      const itemsTotal = store.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
      totalQuantity += itemsTotal;
      
      // Calculate from boxes using actual box sizes
      let boxesTotal = 0;
      if (store.boxes && store.boxes.length > 0) {
        boxesTotal = store.boxes.reduce((sum: number, box: any) => {
          const boxSize = boxSizeMap.get(box.boxId) || 12; // fallback to 12 if not found
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
        boxes: store.boxes || []
      });
    }

    // Use PostgreSQL function for atomic transaction (prevents data loss)
    // This wraps delete+create in a single transaction that rolls back on error
    try {
      console.log(`[DB DEBUG] Calling RPC with planId:`, planId || 'null (creating new plan)');
      console.log(`[DB DEBUG] Date:`, planData.date);
      console.log(`[DB DEBUG] Store productions count:`, preparedStoreProductions.length);
      console.log(`[DB DEBUG] Total production:`, resolvedTotalProduction);
      
      const storeProductionsJson = JSON.stringify(preparedStoreProductions.map(store => ({
        store_id: store.store_id,
        store_name: store.store_name,
        delivery_date: store.delivery_date,
        total_quantity: store.total_quantity,
        items: store.items,
        boxes: store.boxes
      })));
      
      console.log(`[DB DEBUG] Store productions JSON length:`, storeProductionsJson.length);
      
      const { data: resultPlanId, error: functionError } = await supabaseClient
        .rpc('save_production_plan_safe', {
          p_plan_id: planId || null,
          p_date: planData.date,
          p_total_production: resolvedTotalProduction,
          p_status: planData.status,
          p_created_by: user.id,
          p_store_productions: storeProductionsJson
        });

      console.log(`[DB DEBUG] RPC result planId:`, resultPlanId || 'null');
      console.log(`[DB DEBUG] RPC error:`, functionError ? functionError.message : 'null');

      if (functionError) {
        console.error(`[DB DEBUG] RPC function error details:`, JSON.stringify(functionError, null, 2));
        throw new Error(`Transaction error: ${functionError.message}`);
      }

      // Get the plan with all relations for response
      const { data: resultPlan, error: fetchError } = await supabaseClient
        .from('production_plans')
        .select('id')
        .eq('id', resultPlanId)
        .single();

      if (fetchError) {
        throw new Error(`Error fetching saved plan: ${fetchError.message}`);
      }

      plan = resultPlan;
      console.log(`✅ Successfully saved production plan ${plan.id} in transaction`);
    } catch (rpcError) {
      // Fallback to manual approach if RPC function fails or doesn't exist
      console.warn('⚠️ RPC function not available, using manual approach:', rpcError);
      
      // NOW handle plan creation/update
      if (planId) {
        // Update existing plan
        const { data: updatedPlan, error: updateError } = await supabaseClient
        .from('production_plans')
        .update({
          total_production: resolvedTotalProduction,
          status: planData.status
        })
        .eq('id', planId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Error updating plan: ${updateError.message}`);
      }

      plan = updatedPlan;

        // Delete existing store productions ONLY after data is validated
        // (cascade will handle items and boxes)
      const { error: deleteError } = await supabaseClient
        .from('store_productions')
        .delete()
        .eq('plan_id', planId);

      if (deleteError) {
        throw new Error(`Error deleting existing store productions: ${deleteError.message}`);
      }

      console.log(`✅ Deleted existing store productions for plan ${planId}`);
    } else {
      // Create new plan
      const { data: newPlan, error: planError } = await supabaseClient
        .from('production_plans')
        .insert({
          date: planData.date,
          total_production: resolvedTotalProduction,
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

      // NOW create all store productions and their items/boxes
      // Since we validated everything above, these should all succeed
      for (const store of preparedStoreProductions) {
        console.log(`Store ${store.store_name}: items=${store.items.length}, boxes=${store.boxes.length}, total=${store.total_quantity}`);

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
        console.error(`❌ Error creating store production for ${store.store_name}:`, storeError);
        throw new Error(`Error creating store production for store ${store.store_name}: ${storeError.message}`);
      }

      console.log(`✅ Created store production for ${store.store_name} with ID: ${storeProduction.id}`);

      if (store.items && store.items.length > 0) {
        console.log(`📦 Creating ${store.items.length} production items for ${store.store_name}`);
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
          console.error(`❌ Error creating production items for ${store.store_name}:`, itemsError);
          throw new Error(`Error creating production items for store ${store.store_name}: ${itemsError.message}`);
        }
        console.log(`✅ Created ${store.items.length} production items for ${store.store_name}`);
      }

      if (store.boxes && store.boxes.length > 0) {
        console.log(`📦 Creating ${store.boxes.length} box productions for ${store.store_name}`);
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
          console.error(`❌ Error creating box productions for ${store.store_name}:`, boxesError);
          throw new Error(`Error creating box productions for store ${store.store_name}: ${boxesError.message}`);
        }
        console.log(`✅ Created ${store.boxes.length} box productions for ${store.store_name}`);
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
          total_production: resolvedTotalProduction,
          status: planData.status,
          store_count: preparedStoreProductions.length,
          previous_plan_summary: previousPlanSummary,
          stores: preparedStoreProductions.map((store) => ({
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
