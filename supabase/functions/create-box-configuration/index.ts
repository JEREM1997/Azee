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
      throw new Error('Only administrators can create box configurations')
    }

    // Récupérer les données de la boîte
    const boxData = await req.json()
    const { name, size, is_active, varieties } = boxData

    if (!name || !size) {
      throw new Error('Name and size are required')
    }

    // Créer la configuration de boîte avec le client service role (bypass RLS)
    const { data: newBox, error: insertError } = await supabase
      .from('box_configurations')
      .insert({
        name,
        size,
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw new Error(`Failed to create box configuration: ${insertError.message}`)
    }

    // Si des variétés sont spécifiées, les ajouter à la boîte
    if (varieties && varieties.length > 0) {
      const boxVarieties = varieties.map((v: any) => ({
        box_id: newBox.id,
        variety_id: v.varietyId,
        quantity: v.quantity
      }))

      const { error: varietiesError } = await supabase
        .from('box_varieties')
        .insert(boxVarieties)

      if (varietiesError) {
        console.error('Error adding varieties to box:', varietiesError)
        // Ne pas échouer complètement, juste logger l'erreur
      }
    }

    return new Response(
      JSON.stringify(newBox),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error in create-box-configuration function:', error)
    
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