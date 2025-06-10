import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Get all users from auth.users
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers()
    
    if (authError) {
      throw authError
    }

    // Get user roles from the database
    const { data: userRoles, error: rolesError } = await adminClient
      .from('user_roles')
      .select('*')

    if (rolesError) {
      throw rolesError
    }

    // Combine user data
    const users = authUsers.users.map(user => {
      const userRole = userRoles.find(role => role.user_id === user.id)
      return {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || user.email,
        role: userRole?.role || 'store',
        storeIds: userRole?.store_ids || []
      }
    })

    return new Response(
      JSON.stringify({ users }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error:', error)
    
    // Return a more detailed error response
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.details || null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})