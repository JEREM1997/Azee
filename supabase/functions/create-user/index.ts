import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const VALID_ROLES = ['admin', 'production', 'store'] as const;
type ValidRole = typeof VALID_ROLES[number];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Create the new user
    const { email, password, full_name, role, store_ids } = await req.json()

    // Validate role
    if (!VALID_ROLES.includes(role as ValidRole)) {
      throw new Error('Invalid role specified')
    }

    // Create user with admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        store_ids
      }
    })

    if (createError) {
      throw createError
    }

    // Add user role
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role,
        store_ids
      })
      .select()
      .single()

    if (roleError) {
      // Cleanup: delete the created user if role assignment fails
      await adminClient.auth.admin.deleteUser(newUser.user.id)
      throw roleError
    }

    return new Response(
      JSON.stringify({ 
        user: {
          ...newUser.user,
          role: roleData.role,
          store_ids: roleData.store_ids
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})