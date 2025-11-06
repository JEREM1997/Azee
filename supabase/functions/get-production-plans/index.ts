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
    console.log('[get-production-plans] Request received', {
      method: req.method,
      url: req.url,
      startDate,
      endDate,
      allStores,
      userAgent: req.headers.get('user-agent') || undefined,
      referer: req.headers.get('referer') || undefined,
      xClientInfo: req.headers.get('x-client-info') || undefined
    });
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
    const startIso = start.toISOString().split('T')[0];
    const endIso = end.toISOString().split('T')[0];
    console.log(`[get-production-plans] Authenticated user`, { role, storeIds });
    console.log(`[get-production-plans] Effective date range`, { startIso, endIso });
    
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
      `).gte('date', startIso).lte('date', endIso).order('date', {
        //greater than or equal to (gte) and less than or equal to (lte)
        //order by date in descending order (false)
        //order by date in ascending order (true)
        //order by date in descending order (false)
      ascending: false
    });
    // Log basic query info and measure execution time
    console.log('[get-production-plans] Executing query', {
      table: 'production_plans',
      gte: startIso,
      lte: endIso,
      order: { column: 'date', ascending: false }
    });
    console.time('[get-production-plans] queryTime');
    const { data: plans, error: dbError } = await query;
    console.timeEnd('[get-production-plans] queryTime');
    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
    console.log('[get-production-plans] Query result', {
      count: plans?.length || 0,
      role,
      startIso,
      endIso
    });
    
    // For store-role users, always filter to only their stores (ignore allStores flag)
    if (plans && role === 'store' && storeIds.length > 0) {
      plans.forEach((plan)=>{
        if (plan.stores) {
          plan.stores = plan.stores.filter(sp =>
            storeIds.includes(sp.store_id)       // storeIds taken from the caller’s profile
          );
        }
      });
      
      // Remove plans that have no stores after filtering
      const filteredPlans = plans.filter(plan => plan.stores && plan.stores.length > 0);
      console.log('[get-production-plans] After store filtering', {
        count: filteredPlans.length
      });
      
      return new Response(JSON.stringify(filteredPlans), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    console.log('[get-production-plans] Returning plans for admin/production user', {
      count: plans?.length || 0
    });
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
