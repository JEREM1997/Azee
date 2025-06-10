import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'production' | 'store';
  storeIds: string[];
  lastUpdated?: string;
  updatedBy?: string;
}

export interface RoleHistory {
  id: string;
  userId: string;
  oldRole: string;
  newRole: string;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

export const getUsersWithRoles = async (): Promise<User[]> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch users: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error('Error fetching users with roles:', error);
    throw error;
  }
};

export const updateUserRole = async (
  userId: string, 
  newRole: 'admin' | 'production' | 'store',
  reason: string,
  changedBy: string
): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    // First, get the current user role for logging
    const users = await getUsersWithRoles();
    const currentUser = users.find(u => u.id === userId);
    
    if (!currentUser) {
      throw new Error('User not found');
    }

    // Update the user role
    const updateUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user`;
    
    const updateResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        role: newRole
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update user role: ${updateResponse.status} ${errorText}`);
    }

    // Log the role change
    await logRoleChange(userId, currentUser.role, newRole, reason, changedBy);
    
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

export const logRoleChange = async (
  userId: string,
  oldRole: string,
  newRole: string,
  reason: string,
  changedBy: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_role_history')
      .insert({
        user_id: userId,
        old_role: oldRole,
        new_role: newRole,
        reason: reason,
        changed_by: changedBy,
        changed_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error logging role change:', error);
      // Don't throw here as the main operation succeeded
    }
  } catch (error) {
    console.error('Error logging role change:', error);
    // Don't throw here as the main operation succeeded
  }
};

export const getUserRoleHistory = async (userId: string): Promise<RoleHistory[]> => {
  try {
    const { data, error } = await supabase
      .from('user_role_history')
      .select(`
        id,
        user_id,
        old_role,
        new_role,
        reason,
        changed_at,
        changed_by_user:users!user_role_history_changed_by_fkey(email)
      `)
      .eq('user_id', userId)
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Error fetching role history:', error);
      return [];
    }

    return (data || []).map(entry => ({
      id: entry.id,
      userId: entry.user_id,
      oldRole: entry.old_role,
      newRole: entry.new_role,
      changedBy: entry.changed_by_user?.email || 'Unknown',
      changedAt: entry.changed_at,
      reason: entry.reason
    }));
  } catch (error) {
    console.error('Error fetching role history:', error);
    return [];
  }
};