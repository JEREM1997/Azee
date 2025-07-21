// @ts-ignore - Deno environment (npm specifier)
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

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

    // Get the request body
    const { storeProductionId, updates } = await req.json();

    if (!storeProductionId || !updates) {
      throw new Error('Missing required fields');
    }

    // Update store production status
    const { data: storeProduction, error: updateError } = await supabase
      .from('store_productions')
      .update({ 
        delivery_confirmed: updates.deliveryConfirmed,
        waste_reported: updates.waste || updates.boxWaste ? true : undefined
      })
      .eq('id', storeProductionId)
      .select()
      .single();

    if (updateError) throw updateError;

    // -------------------------------------------------------------------
    // Configuration: allowed overage (absolute number, default 2)
    // -------------------------------------------------------------------
    const ALLOWED_OVERAGE = parseInt(Deno.env.get('RECEIPT_OVERAGE_ABS') || '2', 10);

    // Helper to fetch planned & current received for validation
    async function getItemInfo(itemId: string) {
      const { data, error } = await supabase
        .from('production_items')
        .select('quantity, received')
        .eq('id', itemId)
        .single();
      if (error) throw error;
      return data as { quantity: number; received: number | null };
    }

    async function getBoxInfo(boxProdId: string) {
      const { data, error } = await supabase
        .from('box_productions')
        .select('quantity, received')
        .or(`id.eq.${boxProdId},box_id.eq.${boxProdId}`)
        .eq('store_production_id', storeProductionId)
        .single();
      if (error) throw error;
      return data as { quantity: number; received: number | null };
    }

    // ----------------------- RECEIVED -----------------------------------
    if (updates.received) {
      for (const [itemId, quantity] of Object.entries(updates.received)) {
        const q = Number(quantity);
        if (isNaN(q) || q < 0) {
          throw new Error('Quantité reçue invalide');
        }

        const info = await getItemInfo(itemId);
        const maxAllowed = info.quantity + ALLOWED_OVERAGE;
        if (q > maxAllowed) {
          throw new Error(`Réception trop élevée (${q}). Maximum autorisé : ${maxAllowed}.`);
        }

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

        const info = await getBoxInfo(boxId);
        const maxAllowed = info.quantity + ALLOWED_OVERAGE;
        if (q > maxAllowed) {
          throw new Error(`Réception boîte trop élevée (${q}). Maximum autorisé : ${maxAllowed}.`);
        }

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

        const info = await getItemInfo(itemId); // includes latest received value
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

    return new Response(
      JSON.stringify(storeProduction),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
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