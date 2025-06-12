import { createClient } from 'npm:@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Vérifier l'authentification
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

    // Vérifier le rôle admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (userRole?.role !== 'admin') {
      throw new Error('Only administrators can update stores')
    }

    // Récupérer les données du magasin
    const storeData = await req.json()
    const { id, name, location, is_active, available_varieties, available_boxes } = storeData

    if (!id || !name || !location) {
      throw new Error('ID, name, and location are required')
    }

    // Mettre à jour le magasin avec le client service role (bypass RLS)
    const { data: updatedStore, error: updateError } = await supabase
      .from('stores')
      .update({
        name,
        location,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      throw new Error(`Failed to update store: ${updateError.message}`)
    }

    // Update store-variety relationships
    // First, delete existing relationships
    await supabase
      .from('store_varieties')
      .delete()
      .eq('store_id', id)

    // Then insert new relationships
    if (available_varieties && available_varieties.length > 0) {
      const storeVarieties = available_varieties.map((varietyId: string) => ({
        store_id: id,
        variety_id: varietyId
      }))

      const { error: varietiesError } = await supabase
        .from('store_varieties')
        .insert(storeVarieties)

      if (varietiesError) {
        console.error('Store varieties insert error:', varietiesError)
        // Don't throw here, just log the error
      }
    }

    // Update store-box relationships
    // First, delete existing relationships
    await supabase
      .from('store_boxes')
      .delete()
      .eq('store_id', id)

    // Then insert new relationships
    if (available_boxes && available_boxes.length > 0) {
      const storeBoxes = available_boxes.map((boxId: string) => ({
        store_id: id,
        box_id: boxId
      }))

      const { error: boxesError } = await supabase
        .from('store_boxes')
        .insert(storeBoxes)

      if (boxesError) {
        console.error('Store boxes insert error:', boxesError)
        // Don't throw here, just log the error
      }
    }

    return new Response(
      JSON.stringify(updatedStore),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error in update-store function:', error)
    
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