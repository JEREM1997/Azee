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

    // Update received quantities if provided
    if (updates.received) {
      for (const [itemId, quantity] of Object.entries(updates.received)) {
        const { error } = await supabase
          .from('production_items')
          .update({ received: quantity })
          .eq('id', itemId);

        if (error) throw error;
      }
    }

    // Update box received quantities if provided
    if (updates.boxReceived) {
      for (const [boxId, quantity] of Object.entries(updates.boxReceived)) {
        // Some clients may send the box_productions.id, others the box_id (template id).
        // Update whichever row matches the provided UUID and the current store_production_id.
        const { error } = await supabase
          .from('box_productions')
          .update({ received: quantity })
          .or(`id.eq.${boxId},box_id.eq.${boxId}`)
          .eq('store_production_id', storeProductionId);

        if (error) throw error;
      }
    }

    // Update waste quantities if provided
    if (updates.waste) {
      for (const [itemId, quantity] of Object.entries(updates.waste)) {
        const { error } = await supabase
          .from('production_items')
          .update({ waste: quantity })
          .eq('id', itemId);

        if (error) throw error;
      }
    }

    // Update box waste quantities if provided
    if (updates.boxWaste) {
      for (const [boxId, quantity] of Object.entries(updates.boxWaste)) {
        const { error } = await supabase
          .from('box_productions')
          .update({ waste: quantity })
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