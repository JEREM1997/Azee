import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

interface ProductionPlanRequest {
  date: string;
  totalProduction: number;
  status: string;
  userId: string;
  existingPlanId?: string;
  stores: Array<{
    storeId: string;
    storeName: string;
    totalQuantity: number;
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role key instead of anon key
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get request data
    const planData: ProductionPlanRequest = await req.json();

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

    // Check if a plan already exists for this date
    const { data: existingPlan, error: existingPlanError } = await supabaseClient
      .from('production_plans')
      .select('id')
      .eq('date', planData.date)
      .maybeSingle();

    if (existingPlanError) {
      throw existingPlanError;
    }

    const planId = planData.existingPlanId || existingPlan?.id;

    if (planId) {
      // Update existing plan
      const { data: updatedPlan, error: updateError } = await supabaseClient
        .from('production_plans')
        .update({
          total_production: planData.totalProduction,
          status: planData.status,
        })
        .eq('id', planId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      plan = updatedPlan;

      // Delete existing store productions (cascade will handle items and boxes)
      const { error: deleteError } = await supabaseClient
        .from('store_productions')
        .delete()
        .eq('plan_id', planId);

      if (deleteError) {
        throw deleteError;
      }
    } else {
      // Create new plan
      const { data: newPlan, error: planError } = await supabaseClient
        .from('production_plans')
        .insert({
          date: planData.date,
          total_production: planData.totalProduction,
          status: planData.status,
          created_by: user.id
        })
        .select()
        .single();

      if (planError) {
        throw planError;
      }

      plan = newPlan;
    }

    // Create store productions and their items/boxes
    for (const store of planData.stores) {
      const { data: storeProduction, error: storeError } = await supabaseClient
        .from('store_productions')
        .insert({
          plan_id: plan.id,
          store_id: store.storeId,
          store_name: store.storeName,
          total_quantity: store.totalQuantity
        })
        .select()
        .single();

      if (storeError) {
        throw storeError;
      }

      if (store.items && store.items.length > 0) {
        const { error: itemsError } = await supabaseClient
          .from('production_items')
          .insert(
            store.items.map(item => ({
              store_production_id: storeProduction.id,
              variety_id: item.varietyId,
              variety_name: item.varietyName,
              form_id: item.formId,
              form_name: item.formName,
              quantity: item.quantity
            }))
          );

        if (itemsError) {
          throw itemsError;
        }
      }

      if (store.boxes && store.boxes.length > 0) {
        const { error: boxesError } = await supabaseClient
          .from('box_productions')
          .insert(
            store.boxes.map(box => ({
              store_production_id: storeProduction.id,
              box_id: box.boxId,
              box_name: box.boxName,
              quantity: box.quantity
            }))
          );

        if (boxesError) {
          throw boxesError;
        }
      }
    }

    return new Response(
      JSON.stringify(plan),
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
      JSON.stringify({ error: error.message }),
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