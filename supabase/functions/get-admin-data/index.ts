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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
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
      { data: stores, error: storesError },
      { data: varieties, error: varietiesError },
      { data: forms, error: formsError },
      { data: boxes, error: boxesError }
    ] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('donut_varieties').select('*').order('name'),
      supabase.from('donut_forms').select('*').order('name'),
      supabase.from('box_configurations').select('*').order('name')
    ])

    if (storesError) throw storesError
    if (varietiesError) throw varietiesError
    if (formsError) throw formsError
    if (boxesError) throw boxesError

    return new Response(
      JSON.stringify({
        stores: stores || [],
        varieties: varieties || [],
        forms: forms || [],
        boxes: boxes || []
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