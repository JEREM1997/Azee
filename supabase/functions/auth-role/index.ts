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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error('User not found')
    }

    const requestData = await req.json()
    const newRole = requestData.role as ValidRole

    if (!VALID_ROLES.includes(newRole)) {
      throw new Error('Invalid role specified')
    }

    // Update role in database
    const { error: dbError } = await adminClient
      .from('user_roles')
      .upsert({
        user_id: user.id,
        role: newRole,
        updated_at: new Date().toISOString()
      })

    if (dbError) {
      throw dbError
    }

    // Update user metadata
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          role: newRole,
          updated_at: new Date().toISOString()
        }
      }
    )

    if (updateError) {
      throw updateError
    }

    // Force sign out to refresh session
    await adminClient.auth.admin.signOut(user.id)

    return new Response(
      JSON.stringify({ 
        message: 'User role updated',
        user: updatedUser
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