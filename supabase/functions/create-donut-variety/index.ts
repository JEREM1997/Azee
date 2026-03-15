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
      throw new Error('Only administrators can create donut varieties')
    }

    // Récupérer les données de la variété
    const varietyData = await req.json()
    const { name, description, form_id, production_cost, is_active, is_orderable } = varietyData

    if (!name || !form_id || production_cost === undefined) {
      throw new Error('Name, form_id, and production_cost are required')
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

    // Créer la variété de donut avec le client service role (bypass RLS)
    const { data: newVariety, error: insertError } = await supabase
      .from('donut_varieties')
      .insert({
        name,
        description,
        form_id,
        production_cost,
        is_active: is_active !== undefined ? is_active : true,
        is_orderable: is_orderable !== undefined ? is_orderable : true
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw new Error(`Failed to create donut variety: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify(newVariety),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error in create-donut-variety function:', error)
    
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
