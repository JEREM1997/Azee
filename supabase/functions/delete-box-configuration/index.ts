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
      throw new Error('Only administrators can delete box configurations')
    }

    // Récupérer l'ID de la boîte à supprimer
    const { id } = await req.json()

    if (!id) {
      throw new Error('Box ID is required')
    }

    // Vérifier si la boîte est utilisée dans des productions
    const { data: boxProductions, error: boxProductionsError } = await supabase
      .from('box_productions')
      .select('id')
      .eq('box_id', id)
      .limit(1)

    if (boxProductionsError) {
      throw new Error(`Failed to check if box is in use: ${boxProductionsError.message}`)
    }

    if (boxProductions && boxProductions.length > 0) {
      throw new Error('Cannot delete this box because it is used in one or more production plans')
    }

    // Supprimer d'abord les variétés associées à la boîte
    const { error: deleteVarietiesError } = await supabase
      .from('box_varieties')
      .delete()
      .eq('box_id', id)

    if (deleteVarietiesError) {
      console.error('Error deleting box varieties:', deleteVarietiesError)
      throw new Error(`Failed to delete box varieties: ${deleteVarietiesError.message}`)
    }

    // Supprimer la configuration de boîte avec le client service role (bypass RLS)
    const { error: deleteError } = await supabase
      .from('box_configurations')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      throw new Error(`Failed to delete box configuration: ${deleteError.message}`)
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
    console.error('Error in delete-box-configuration function:', error)
    
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