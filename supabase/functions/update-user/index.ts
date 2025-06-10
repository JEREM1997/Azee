import { createClient } from 'npm:@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const VALID_ROLES = ['admin', 'production', 'store'] as const;
type ValidRole = typeof VALID_ROLES[number];

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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized')
    }

    const { data: { user }, error: userError } = await adminClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('User not found')
    }

    const requestData = await req.json()
    const { user_id, full_name, role } = requestData

    if (!user_id) {
      throw new Error('User ID is required')
    }

    if (role && !VALID_ROLES.includes(role as ValidRole)) {
      throw new Error('Invalid role specified')
    }

    // Get current user data
    const { data: currentUser, error: currentUserError } = await adminClient.auth.admin.getUserById(user_id)
    
    if (currentUserError || !currentUser) {
      throw new Error('Failed to fetch current user data')
    }

    // Get current role data first to preserve store_ids
    const { data: currentRole, error: currentRoleError } = await adminClient
      .from('user_roles')
      .select()
      .eq('user_id', user_id)
      .maybeSingle()

    // Update user metadata
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      user_id,
      {
        user_metadata: {
          ...currentUser.user.user_metadata,
          full_name: full_name || currentUser.user.user_metadata?.full_name,
          role: role || currentUser.user.user_metadata?.role,
          updated_at: new Date().toISOString()
        }
      }
    )

    if (updateError) {
      throw updateError
    }

    if (!updatedUser) {
      throw new Error('Error updating user metadata')
    }

    // If role is being updated or user_roles entry doesn't exist, update the user_roles table
    if (role || !currentRole) {
      const { data: updatedRole, error: roleError } = await adminClient
        .from('user_roles')
        .upsert({
          user_id: user_id,
          role: role || currentUser.user.user_metadata?.role,
          store_ids: currentRole?.store_ids || [],
          updated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

      if (roleError) {
        throw roleError
      }

      if (!updatedRole) {
        throw new Error('Failed to update user role')
      }

      // Return combined user data
      return new Response(
        JSON.stringify({ 
          user: {
            ...updatedUser.user,
            role: updatedRole.role,
            store_ids: updatedRole.store_ids
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // If no role update, use existing role data
    return new Response(
      JSON.stringify({ 
        user: {
          ...updatedUser.user,
          role: currentRole?.role || currentUser.user.user_metadata?.role,
          store_ids: currentRole?.store_ids || []
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})