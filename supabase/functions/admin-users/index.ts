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
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Fetching users with fresh admin client...')

    // Get all users from auth.users with fresh fetch
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error fetching auth users:', authError)
      throw authError
    }

    console.log(`Fetched ${authUsers.users.length} users from auth`)

    // Get user roles from the database
    const { data: userRoles, error: rolesError } = await adminClient
      .from('user_roles')
      .select('*')

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError)
      throw rolesError
    }

    console.log(`Fetched ${userRoles.length} user roles from database`)

    // Combine user data
    const users = authUsers.users.map(user => {
      const userRole = userRoles.find(role => role.user_id === user.id)
      
      // Debug user metadata for troubleshooting
      console.log(`Processing user ${user.id}:`, {
        email: user.email,
        user_metadata: user.user_metadata,
        full_name_from_metadata: user.user_metadata?.full_name,
        fallback_to_email: !user.user_metadata?.full_name
      })
      
      // More robust full name extraction
      let fullName = user.user_metadata?.full_name
      
      // If no full_name in metadata, extract from email
      if (!fullName || fullName.trim() === '') {
        fullName = user.email
        console.log(`No full_name found for user ${user.id}, using email: ${fullName}`)
      } else {
        console.log(`Using full_name from metadata for user ${user.id}: ${fullName}`)
      }
      
      const userData = {
        id: user.id,
        email: user.email,
        fullName: fullName,
        role: userRole?.role || 'store',
        storeIds: userRole?.store_ids || []
      }
      
      console.log(`Final user data for ${user.id}:`, userData)
      
      return userData
    })

    console.log(`Returning ${users.length} processed users`)

    return new Response(
      JSON.stringify({ users }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error in admin-users function:', error)
    
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