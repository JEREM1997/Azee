// @ts-ignore - Deno environment (npm specifier)
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

function summarizeMapQuantities(values: Record<string, unknown> | undefined) {
  if (!values) {
    return { count: 0, total: 0 };
  }

  return Object.values(values).reduce(
    (summary, value) => {
      const numericValue = Number(value);
      if (!Number.isNaN(numericValue)) {
        summary.count += 1;
        summary.total += numericValue;
      }
      return summary;
    },
    { count: 0, total: 0 }
  );
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  // ← make sure x-client-info is in here (case-insensitive, but include it!)
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// Add Deno types for better TypeScript support
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get(key: string): string | undefined;
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the user's JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid token');
    }

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role, store_ids')
      .eq('user_id', user.id)
      .maybeSingle();

    const userRole = roleRow?.role || user.user_metadata?.role;
    const userStoreIds: string[] = roleRow?.store_ids || user.user_metadata?.store_ids || [];

    if (!userRole) {
      throw new Error('User role not found');
    }

    // Get the request body
    const { storeProductionId, updates } = await req.json();

    if (!storeProductionId || !updates) {
      throw new Error('Missing required fields');
    }

    const { data: currentStoreProduction, error: currentStoreProductionError } = await supabase
      .from('store_productions')
      .select('id, plan_id, store_id, store_name, delivery_confirmed, waste_reported')
      .eq('id', storeProductionId)
      .single();

    if (currentStoreProductionError || !currentStoreProduction) {
      throw new Error('Store production not found');
    }

    if (
      userRole === 'store' &&
      !userStoreIds.includes(currentStoreProduction.store_id)
    ) {
      throw new Error('Insufficient permissions for this store');
    }
    
       // Helper to fetch current received for waste validation
    async function getItemInfo(itemId: string) {
      const { data, error } = await supabase
        .from('production_items')
        .select('received')
        .eq('id', itemId)
        .single();
      if (error) throw error;
      return data as { received: number | null };
    }

    async function getBoxInfo(boxProdId: string) {
      const { data, error } = await supabase
        .from('box_productions')
        .select('received')
        .or(`id.eq.${boxProdId},box_id.eq.${boxProdId}`)
        .eq('store_production_id', storeProductionId)
        .single();
      if (error) throw error;
      return data as { received: number | null };
    }

    // ----------------------- RECEIVED -----------------------------------
    if (updates.received) {
      for (const [itemId, quantity] of Object.entries(updates.received)) {
        const q = Number(quantity);
        if (isNaN(q) || q < 0) {
          throw new Error('Quantité reçue invalide');
        }

        // No upper limit check – only non-negative enforced

        const { error } = await supabase
          .from('production_items')
          .update({ received: q })
          .eq('id', itemId);
        if (error) throw error;
      }
    }

    if (updates.boxReceived) {
      for (const [boxId, quantity] of Object.entries(updates.boxReceived)) {
        const q = Number(quantity);
        if (isNaN(q) || q < 0) throw new Error('Quantité reçue invalide');

        // No upper limit check

        const { error } = await supabase
          .from('box_productions')
          .update({ received: q })
          .or(`id.eq.${boxId},box_id.eq.${boxId}`)
          .eq('store_production_id', storeProductionId);
        if (error) throw error;
      }
    }

    // ----------------------- WASTE --------------------------------------
    if (updates.waste) {
      for (const [itemId, quantity] of Object.entries(updates.waste)) {
        const w = Number(quantity);
        if (isNaN(w) || w < 0) throw new Error('Quantité perte invalide');

        const info = await getItemInfo(itemId);
        const receivedQty = info.received ?? 0;
        if (w > receivedQty) {
          throw new Error(`Les pertes (${w}) ne peuvent pas dépasser la quantité reçue (${receivedQty}).`);
        }

        const { error } = await supabase
          .from('production_items')
          .update({ waste: w })
          .eq('id', itemId);
        if (error) throw error;
      }
    }

    if (updates.boxWaste) {
      for (const [boxId, quantity] of Object.entries(updates.boxWaste)) {
        const w = Number(quantity);
        if (isNaN(w) || w < 0) throw new Error('Quantité perte invalide');

        const info = await getBoxInfo(boxId);
        const receivedQty = info.received ?? 0;
        if (w > receivedQty) {
          throw new Error(`Les pertes (${w}) ne peuvent pas dépasser la quantité reçue (${receivedQty}).`);
        }

        const { error } = await supabase
          .from('box_productions')
          .update({ waste: w })
          .or(`id.eq.${boxId},box_id.eq.${boxId}`)
          .eq('store_production_id', storeProductionId);
        if (error) throw error;
      }
    }

    // Update store production status only after item/box writes succeeded.
    const storeProductionPatch: Record<string, unknown> = {};
    if (typeof updates.deliveryConfirmed === 'boolean') {
      storeProductionPatch.delivery_confirmed = updates.deliveryConfirmed;
    }
    if (updates.waste || updates.boxWaste) {
      storeProductionPatch.waste_reported = true;
    }

    let storeProduction = currentStoreProduction;
    if (Object.keys(storeProductionPatch).length > 0) {
      const { data: updatedStoreProduction, error: updateError } = await supabase
        .from('store_productions')
        .update(storeProductionPatch)
        .eq('id', storeProductionId)
        .select('id, plan_id, store_id, store_name, delivery_confirmed, waste_reported')
        .single();

      if (updateError) throw updateError;
      storeProduction = updatedStoreProduction;
    }

const receivedItems = summarizeMapQuantities(updates.received as Record<string, unknown> | undefined);
    const receivedBoxes = summarizeMapQuantities(updates.boxReceived as Record<string, unknown> | undefined);
    const wasteItems = summarizeMapQuantities(updates.waste as Record<string, unknown> | undefined);
    const wasteBoxes = summarizeMapQuantities(updates.boxWaste as Record<string, unknown> | undefined);

    const auditAction =
      updates.waste || updates.boxWaste
        ? 'delivery.report_waste'
        : updates.deliveryConfirmed === true
          ? currentStoreProduction.delivery_confirmed
            ? 'delivery.update_reception'
            : 'delivery.confirm_reception'
          : 'delivery.update';

    await writeAuditLog(
      supabase,
      {
        userId: user.id,
        email: user.email ?? null,
        role: userRole,
      },
      {
        action: auditAction,
        entityType: 'store_production',
        entityId: currentStoreProduction.id,
        planId: currentStoreProduction.plan_id,
        storeProductionId: currentStoreProduction.id,
        details: {
          store_id: currentStoreProduction.store_id,
          store_name: currentStoreProduction.store_name,
          before: {
            delivery_confirmed: currentStoreProduction.delivery_confirmed,
            waste_reported: currentStoreProduction.waste_reported,
          },
          after: {
            delivery_confirmed: storeProduction.delivery_confirmed,
            waste_reported: storeProduction.waste_reported,
          },
          delivery_confirmed_requested: updates.deliveryConfirmed ?? null,
          received_item_count: receivedItems.count,
          received_item_total: receivedItems.total,
          received_box_count: receivedBoxes.count,
          received_box_total: receivedBoxes.total,
          waste_item_count: wasteItems.count,
          waste_item_total: wasteItems.total,
          waste_box_count: wasteBoxes.count,
          waste_box_total: wasteBoxes.total,
        },
      }
    );
    
    return new Response(
      JSON.stringify({
        id: storeProduction.id,
        plan_id: storeProduction.plan_id,
        store_id: storeProduction.store_id,
        store_name: storeProduction.store_name,
        delivery_confirmed: !!storeProduction.delivery_confirmed,
        waste_reported: !!storeProduction.waste_reported,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string')
            ? (error as { message: string }).message
            : 'Unknown update-delivery-status error';
    
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
