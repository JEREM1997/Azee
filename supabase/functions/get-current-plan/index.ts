import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the date from query params or use today
    const url = new URL(req.url);
    const requestedDate = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!requestedDate) {
      throw new Error('Date parameter is required');
    }

    // Get the user's role and store_ids from the JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid token');
    }

    const role = user.user_metadata?.role;
    const storeIds = user.user_metadata?.store_ids || [];

    // Get the most recent production plan for the requested date
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
            quantity
          )
        )
      `)
      .eq('date', requestedDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError) {
      // If no rows found, return null
      if (dbError.code === 'PGRST116') {
        return new Response(
          JSON.stringify(null),
          { 
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    // If no plan exists for the date, return null
    if (!plan) {
      return new Response(
        JSON.stringify(null),
        { 
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // For store users, filter the stores array to only show their stores
    if (role === 'store' && storeIds.length > 0) {
      plan.stores = plan.stores.filter(store => 
        storeIds.includes(store.store_id)
      );
    }

    return new Response(
      JSON.stringify(plan),
      { 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});