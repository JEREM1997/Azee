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

    // Get request data
    const { userId, storeIds } = await req.json();

    if (!userId || !Array.isArray(storeIds)) {
      throw new Error('Invalid request data');
    }

    // Get current user role from user_roles table
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (roleError) {
      throw roleError;
    }

    // If role not found in user_roles table, check user metadata
    let role = userRole?.role;
    if (!role && user.user_metadata?.role) {
      role = user.user_metadata.role;
      
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

    // Update user metadata
    const { error: metadataError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          ...user.user_metadata,
          store_ids: storeIds,
          updated_at: Date.now()
        }
      }
    );

    if (metadataError) {
      throw metadataError;
    }

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