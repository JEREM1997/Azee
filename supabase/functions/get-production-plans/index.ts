// @ts-ignore - Deno environment
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-after',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// @ts-ignore - Deno global
Deno.serve(async (req) => {
  console.log(`[get-production-plans] Incoming ${req.method} at`, new Date().toISOString());
  console.log(`[get-production-plans] Auth header present:`, !!req.headers.get('Authorization'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify environment variables
    // @ts-ignore - Deno environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-ignore - Deno environment
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

    let days: number | null = null;
    let startDateParam: string | null = null;
    let endDateParam: string | null = null;

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      // Accept either { days } or { startDate, endDate }
      if (body?.days !== undefined) {
        days = parseInt(body.days, 10);
      }
      startDateParam = body?.startDate || null;
      endDateParam = body?.endDate || null;
    } else {
      const url = new URL(req.url);
      days = parseInt(url.searchParams.get('days') || '7', 10);
    }

    if (!days && (!startDateParam || !endDateParam)) {
      // Default to 7 days if nothing provided
      days = 7;
    }

    // Calculate date range
    let startDate: Date;
    let endDate: Date = new Date();

    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - (days || 7));
    }

    console.log(`[get-production-plans] Calculated range`, startDate.toISOString().split('T')[0], '→', endDate.toISOString().split('T')[0]);

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
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    // If user is a store user, filter by their store_ids
    if (role === 'store' && storeIds.length > 0) {
      query = query.eq('store_productions.store_id', storeIds[0]);
    }

    const { data: plans, error: dbError } = await query;

    console.log(`[get-production-plans] DB returned`, plans?.length || 0, 'plans');

    if (dbError) {
      console.error('[get-production-plans] Database error:', dbError);
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