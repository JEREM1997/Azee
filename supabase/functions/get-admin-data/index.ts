// @ts-ignore - Deno runtime
import { createClient } from 'npm:@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-after',
}

// @ts-ignore - Deno global
Deno.serve(async (req) => {
  console.log(`[get-admin-data] Incoming ${req.method} at`, new Date().toISOString());
  console.log(`[get-admin-data] Auth header present:`, !!req.headers.get('Authorization'));
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // @ts-ignore - Deno env
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    // @ts-ignore - Deno env
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    // Create admin client with service role key to bypass RLS
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('[get-admin-data] Supabase client initialised')

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid token')
    }

    // Fetch all required data using service role (bypasses RLS)
    const [
      { data: storesData, error: storesError },
      { data: varieties, error: varietiesError },
      { data: forms, error: formsError },
      { data: boxes, error: boxesError },
      { data: storeVarieties, error: storeVarietiesError },
      { data: storeBoxes, error: storeBoxesError },
      { data: boxVarieties, error: boxVarietiesError }
    ] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('donut_varieties').select('*').order('name'),
      supabase.from('donut_forms').select('*').order('name'),
      supabase.from('box_configurations').select('*').order('name'),
      supabase.from('store_donut_varieties').select('store_id, variety_id'),
      supabase.from('store_box_configurations').select('store_id, box_id'),
      supabase.from('box_configuration_varieties').select('box_id, variety_id, quantity')
    ])

    if (storesError) { console.error('[get-admin-data] stores error', storesError); throw storesError }
    if (varietiesError) throw varietiesError
    if (formsError) throw formsError
    if (boxesError) throw boxesError
    if (storeVarietiesError) throw storeVarietiesError
    if (storeBoxesError) throw storeBoxesError
    if (boxVarietiesError) throw boxVarietiesError

    // Transform stores to include availableVarieties and availableBoxes arrays
    const stores = (storesData || []).map(store => {
      const availableVarieties = (storeVarieties || [])
        .filter(sv => sv.store_id === store.id)
        .map(sv => sv.variety_id)
      
      const availableBoxes = (storeBoxes || [])
        .filter(sb => sb.store_id === store.id)
        .map(sb => sb.box_id)

      return {
        id: store.id,
        name: store.name,
        location: store.location,
        isActive: store.is_active,
        availableVarieties,
        availableBoxes,
        createdAt: store.created_at,
        updatedAt: store.updated_at
      }
    })

    // Transform varieties to camelCase
    const transformedVarieties = (varieties || []).map(variety => ({
      id: variety.id,
      name: variety.name,
      description: variety.description,
      isActive: variety.is_active,
      formId: variety.form_id,
      productionCost: parseFloat(variety.production_cost || '0'),
      createdAt: variety.created_at,
      updatedAt: variety.updated_at
    }))

    // Transform forms to camelCase
    const transformedForms = (forms || []).map(form => ({
      id: form.id,
      name: form.name,
      description: form.description,
      isActive: form.is_active,
      createdAt: form.created_at,
      updatedAt: form.updated_at
    }))

    // Transform boxes to camelCase and include varieties
    const transformedBoxes = (boxes || []).map(box => {
      const boxVarietiesForBox = (boxVarieties || [])
        .filter(bv => bv.box_id === box.id)
        .map(bv => ({
          varietyId: bv.variety_id,
          quantity: bv.quantity
        }))

      return {
        id: box.id,
        name: box.name,
        size: box.size,
        isActive: box.is_active,
        varieties: boxVarietiesForBox,
        createdAt: box.created_at,
        updatedAt: box.updated_at
      }
    })

    return new Response(
      JSON.stringify({
        stores: stores || [],
        varieties: transformedVarieties || [],
        forms: transformedForms || [],
        boxes: transformedBoxes || [],
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error in get-admin-data function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack || null
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})