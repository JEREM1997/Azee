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
    console.log('Received request data:', requestData)
    const { user_id, full_name, role } = requestData

    if (!user_id) {
      throw new Error('User ID is required')
    }

    if (role && !VALID_ROLES.includes(role as ValidRole)) {
      throw new Error('Invalid role specified')
    }

    console.log('Updating user:', { user_id, full_name, role })

    // Get current user data
    const { data: currentUser, error: currentUserError } = await adminClient.auth.admin.getUserById(user_id)
    
    if (currentUserError || !currentUser) {
      console.error('Failed to fetch current user:', currentUserError)
      throw new Error('Failed to fetch current user data')
    }

    console.log('Current user data:', {
      id: currentUser.user.id,
      email: currentUser.user.email,
      current_full_name: currentUser.user.user_metadata?.full_name,
      current_role: currentUser.user.user_metadata?.role
    })

    // Get current role data first to preserve store_ids
    const { data: currentRole, error: currentRoleError } = await adminClient
      .from('user_roles')
      .select()
      .eq('user_id', user_id)
      .maybeSingle()

    console.log('Current role data:', currentRole)

    // Update user metadata
    const newMetadata = {
      ...currentUser.user.user_metadata,
      full_name: full_name || currentUser.user.user_metadata?.full_name,
      role: role || currentUser.user.user_metadata?.role,
      updated_at: new Date().toISOString()
    }

    console.log('Updating user metadata to:', newMetadata)

    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      user_id,
      {
        user_metadata: newMetadata
      }
    )

    if (updateError) {
      console.error('Error updating user metadata:', updateError)
      throw updateError
    }

    if (!updatedUser) {
      throw new Error('Error updating user metadata')
    }

    console.log('User metadata updated successfully:', {
      id: updatedUser.user.id,
      new_full_name: updatedUser.user.user_metadata?.full_name,
      new_role: updatedUser.user.user_metadata?.role
    })

    // If role is being updated or user_roles entry doesn't exist, update the user_roles table
    if (role || !currentRole) {
      const roleData = {
        user_id: user_id,
        role: role || currentUser.user.user_metadata?.role,
        store_ids: currentRole?.store_ids || [],
        updated_at: new Date().toISOString()
      }

      console.log('Updating user_roles table with:', roleData)

      const { data: updatedRole, error: roleError } = await adminClient
        .from('user_roles')
        .upsert(roleData)
        .select()
        .maybeSingle()

      if (roleError) {
        console.error('Error updating user_roles:', roleError)
        throw roleError
      }

      if (!updatedRole) {
        throw new Error('Failed to update user role')
      }

      console.log('User role updated successfully:', updatedRole)

      // Return combined user data
      const response = {
        user: {
          ...updatedUser.user,
          role: updatedRole.role,
          store_ids: updatedRole.store_ids
        }
      }

      console.log('Returning successful response:', response)

      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // If no role update, use existing role data
    const response = {
      user: {
        ...updatedUser.user,
        role: currentRole?.role || currentUser.user.user_metadata?.role,
        store_ids: currentRole?.store_ids || []
      }
    }

    console.log('Returning successful response (no role update):', response)

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error in update-user function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})