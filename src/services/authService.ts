import { supabase } from '../lib/supabase';

export const updateUserRole = async () => {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Session non valide');
    }

    // Call the auth-role Edge Function
    const { data, error } = await supabase.functions.invoke('auth-role', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) throw error;

    // Force session refresh to get new role
    await supabase.auth.refreshSession();

    // Reload the page to apply new role
    window.location.reload();
    
    return data;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du rôle:', error);
    throw error;
  }
};

export const getCurrentRole = async () => {
  try {
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      throw new Error('Session non valide');
    }

    // Get user role from metadata
    const role = session.user.user_metadata?.role;
    if (role) return role;

    // If no role in metadata, check database
    const { data: userRole, error: dbError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (dbError) throw dbError;

    return userRole?.role || 'store';
  } catch (error) {
    console.error('Erreur lors de la récupération du rôle:', error);
    return 'store';
  }
};