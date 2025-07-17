import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the user's JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid token');
    }

    // Ensure the caller is an admin
    const { data: callerRoleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (callerRoleRow?.role !== 'admin') {
      throw new Error('Only administrators can update store assignments');
    }

    // Get request data
    const { userId, storeIds } = await req.json();

    if (!userId || !Array.isArray(storeIds)) {
      throw new Error('Invalid request data');
    }

    // Fetch the target user once, we need it for metadata later
    const { data: targetUser, error: tErr } = await supabase.auth.admin.getUserById(userId);
    if (tErr || !targetUser) throw new Error('Target user not found');

    // Get current user role from user_roles table
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (roleError) {
      throw roleError;
    }

    // If role not found in user_roles table, check target user's metadata
    let role = userRole?.role;
    if (!role && targetUser.user_metadata?.role) {
      role = targetUser.user_metadata.role;
      
      // Create user role record if it doesn't exist
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role,
          store_ids: [],
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        throw insertError;
      }
    }

    if (!role) {
      throw new Error('User role not found in both user_roles table and user metadata');
    }

    // Only store users can have stores assigned
    if (role !== 'store' && storeIds.length > 0) {
      throw new Error('Only store users can be assigned to stores');
    }

    // Update user_roles table
    const { data: updatedRole, error: updateError } = await supabase
      .from('user_roles')
      .update({ 
        store_ids: storeIds,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updatedRole) {
      throw new Error('Failed to update user stores');
    }

    const newMeta = {
      ...targetUser.user_metadata,   // preserve existing fields including role
      store_ids: storeIds,
      updated_at: Date.now()
    };
    await supabase.auth.admin.updateUserById(userId, { user_metadata: newMeta });

    return new Response(
      JSON.stringify(updatedRole),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});