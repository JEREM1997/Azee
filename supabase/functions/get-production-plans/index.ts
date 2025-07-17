// @ts-ignore - Deno environment
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};
// @ts-ignore - Deno global
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
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
    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // Get startDate and endDate from request body
    const requestBody = await req.json();
    const { startDate, endDate, allStores } = requestBody;
    if (!startDate || !endDate) {
      throw new Error('Missing required startDate or endDate in request body');
    }
    // Parse and validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format in startDate or endDate');
    }
    // Get the user's role and store_ids from the JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      throw new Error('Invalid token');
    }
    const role = user.user_metadata?.role;
    const storeIds = user.user_metadata?.store_ids || [];
    console.log(`Date range: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
    console.log(`User role: ${role}, Store IDs: ${JSON.stringify(storeIds)}`);
    
    // Build the query - get ALL plans first, then filter by role in post-processing
    const query = supabaseClient.from('production_plans').select(`
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
      `).gte('date', start.toISOString().split('T')[0]).lte('date', end.toISOString().split('T')[0]).order('date', {
      ascending: false
    });

    const { data: plans, error: dbError } = await query;
    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
    
    console.log(`Found ${plans?.length || 0} plans before filtering for user role: ${role}`);
    
    // For store-role users, always filter to only their stores (ignore allStores flag)
    if (plans && role === 'store' && storeIds.length > 0) {
      plans.forEach((plan)=>{
        if (plan.stores) {
          plan.stores = plan.stores.filter((store)=>storeIds.includes(store.store_id));
        }
      });
      
      // Remove plans that have no stores after filtering
      const filteredPlans = plans.filter(plan => plan.stores && plan.stores.length > 0);
      console.log(`After store filtering: ${filteredPlans.length} plans with user's stores`);
      
      return new Response(JSON.stringify(filteredPlans), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    console.log(`Returning ${plans?.length || 0} plans for admin/production user`);
    return new Response(JSON.stringify(plans || []), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});
