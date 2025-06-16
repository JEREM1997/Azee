/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

// @ts-nocheck
// This is a Deno edge function - TypeScript errors are expected in Node.js environment

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get user from token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid token');
    }

    // Check user role
    let userRole = user.user_metadata?.role;

    // Fallback: check profiles table if role not in metadata
    if (!userRole) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        userRole = profile.role;
      }
    }

    if (!userRole) {
      return new Response(
        JSON.stringify({ 
          error: 'User role not found. Please contact your administrator to set up your account properly.' 
        }),
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // Only admin and production users can delete plans
    if (!['admin', 'production'].includes(userRole)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions to delete production plans' }),
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // Get request data
    const { planId } = await req.json();
    if (!planId) {
      throw new Error('Plan ID is required');
    }

    // Check if plan exists and get its details
    const { data: plan, error: planError } = await supabaseClient
      .from('production_plans')
      .select('id, date, status')
      .eq('id', planId)
      .single();

    if (planError) {
      if (planError.code === 'PGRST116') {
        throw new Error('Production plan not found');
      }
      throw new Error(`Error finding plan: ${planError.message}`);
    }

    // Check if plan can be deleted (only draft and validated plans can be deleted)
    if (plan.status === 'completed') {
      throw new Error('Cannot delete completed production plans');
    }

    // Delete the plan (cascade will handle related records)
    const { error: deleteError } = await supabaseClient
      .from('production_plans')
      .delete()
      .eq('id', planId);

    if (deleteError) {
      throw new Error(`Error deleting plan: ${deleteError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        message: 'Production plan deleted successfully',
        deletedPlan: {
          id: plan.id,
          date: plan.date,
          status: plan.status
        }
      }),
      { 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('Error in delete-production-plan function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
}); 