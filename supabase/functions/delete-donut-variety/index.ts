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
      throw new Error('Only administrators can delete donut varieties')
    }

    // Récupérer l'ID de la variété à supprimer
    const { id } = await req.json()

    if (!id) {
      throw new Error('Variety ID is required')
    }

    // Vérifier si la variété est utilisée dans des productions
    const { data: productionItems, error: productionItemsError } = await supabase
      .from('production_items')
      .select('id')
      .eq('variety_id', id)
      .limit(1)

    if (productionItemsError) {
      throw new Error(`Failed to check if variety is in use: ${productionItemsError.message}`)
    }

    if (productionItems && productionItems.length > 0) {
      throw new Error('Cannot delete this variety because it is used in one or more production plans')
    }

    // Vérifier si la variété est utilisée dans des configurations de boîtes
    const { data: boxVarieties, error: boxVarietiesError } = await supabase
      .from('box_varieties')
      .select('id')
      .eq('variety_id', id)
      .limit(1)

    if (boxVarietiesError) {
      throw new Error(`Failed to check if variety is used in boxes: ${boxVarietiesError.message}`)
    }

    if (boxVarieties && boxVarieties.length > 0) {
      throw new Error('Cannot delete this variety because it is used in one or more box configurations')
    }

    // Supprimer la variété de donut avec le client service role (bypass RLS)
    const { error: deleteError } = await supabase
      .from('donut_varieties')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      throw new Error(`Failed to delete donut variety: ${deleteError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error in delete-donut-variety function:', error)
    
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