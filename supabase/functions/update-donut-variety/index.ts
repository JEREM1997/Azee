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
      throw new Error('Only administrators can update donut varieties')
    }

    // Récupérer les données de la variété
    const varietyData = await req.json()
    const { id, name, description, form_id, production_cost, is_active } = varietyData

    if (!id || !name || !form_id || production_cost === undefined) {
      throw new Error('ID, name, form_id, and production_cost are required')
    }

    // Vérifier si la forme existe
    const { data: form, error: formError } = await supabase
      .from('donut_forms')
      .select('id')
      .eq('id', form_id)
      .single()

    if (formError || !form) {
      throw new Error('The specified donut form does not exist')
    }

    // Mettre à jour la variété de donut avec le client service role (bypass RLS)
    const { data: updatedVariety, error: updateError } = await supabase
      .from('donut_varieties')
      .update({
        name,
        description,
        form_id,
        production_cost,
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      throw new Error(`Failed to update donut variety: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify(updatedVariety),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error in update-donut-variety function:', error)
    
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