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
    // Verify environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing required environment variables');
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get days parameter from URL, default to 7 days
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '7', 10);

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

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build the query with proper join syntax
    let query = supabaseClient
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
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    // If user is a store user, filter by their store_ids
    if (role === 'store' && storeIds.length > 0) {
      query = query.eq('store_productions.store_id', storeIds[0]);
    }

    const { data: plans, error: dbError } = await query;

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log(`Found ${plans?.length || 0} plans for user role: ${role}`);
    console.log('Plans data:', JSON.stringify(plans, null, 2));

    // For store users, filter to only show their stores
    if (plans && role === 'store') {
      plans.forEach(plan => {
        if (plan.stores) {
          plan.stores = plan.stores.filter(store => 
            storeIds.includes(store.store_id)
          );
        }
      });
    }

    return new Response(
      JSON.stringify(plans || []),
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