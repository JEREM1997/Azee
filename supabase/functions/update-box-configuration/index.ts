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
      throw new Error('Only administrators can update box configurations')
    }

    // Récupérer les données de la boîte
    const boxData = await req.json()
    const { id, name, size, is_active, varieties } = boxData

    if (!id || !name || !size) {
      throw new Error('ID, name, and size are required')
    }

    // Mettre à jour la configuration de boîte avec le client service role (bypass RLS)
    const { data: updatedBox, error: updateError } = await supabase
      .from('box_configurations')
      .update({
        name,
        size,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      throw new Error(`Failed to update box configuration: ${updateError.message}`)
    }

    // Mettre à jour les variétés de la boîte
    if (varieties !== undefined) {
      // D'abord supprimer toutes les variétés existantes
      const { error: deleteError } = await supabase
        .from('box_varieties')
        .delete()
        .eq('box_id', id)

      if (deleteError) {
        console.error('Error deleting existing varieties:', deleteError)
        throw new Error(`Failed to update box varieties: ${deleteError.message}`)
      }

      // Ensuite ajouter les nouvelles variétés
      if (varieties && varieties.length > 0) {
        const boxVarieties = varieties.map((v: any) => ({
          box_id: id,
          variety_id: v.varietyId,
          quantity: v.quantity
        }))

        const { error: insertError } = await supabase
          .from('box_varieties')
          .insert(boxVarieties)

        if (insertError) {
          console.error('Error adding varieties to box:', insertError)
          throw new Error(`Failed to update box varieties: ${insertError.message}`)
        }
      }
    }

    return new Response(
      JSON.stringify(updatedBox),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error in update-box-configuration function:', error)
    
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