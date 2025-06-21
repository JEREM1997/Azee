import { supabase } from '../lib/supabase';
import { User } from '../types';

const constructFunctionUrl = (functionPath: string): string => {
  if (!import.meta.env.VITE_SUPABASE_URL) {
    throw new Error('VITE_SUPABASE_URL environment variable is not set');
  }

  try {
    const baseUrl = new URL(import.meta.env.VITE_SUPABASE_URL);
    const functionUrl = new URL(`/functions/v1${functionPath}`, baseUrl);
    return functionUrl.toString();
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    console.error('Error constructing function URL:', error);
    throw new Error(`Invalid Supabase URL configuration: ${error.message}`);
  }
};

export const createUser = async (
  username: string,
  password: string,
  fullName: string,
  role: 'admin' | 'production' | 'store',
  storeIds: string[]
) => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('No authentication token found');
    }

    const functionUrl = constructFunctionUrl('/create-user');
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        email: `${username.toLowerCase().replace(/\s+/g, '.')}@krispykreme.internal`,
        password,
        full_name: fullName,
        role,
        store_ids: storeIds
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error creating user');
    }

    const data = await response.json();
    return data.user;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    console.error('Error creating user:', error);
    throw error;
  }
};

export const updateUser = async (userId: string, updates: {
  fullName?: string;
  role?: 'admin' | 'production' | 'store';
}) => {
  try {
    console.log('updateUser called with:', { userId, updates });
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('No authentication token found');
    }

    const functionUrl = constructFunctionUrl('/update-user');
    
    // Convert camelCase to snake_case for the Edge Function
    const requestBody: any = {
      user_id: userId,
    };
    
    if (updates.fullName !== undefined) {
      requestBody.full_name = updates.fullName;
    }
    
    if (updates.role !== undefined) {
      requestBody.role = updates.role;
    }
    
    console.log('Sending request to Edge Function URL:', functionUrl);
    console.log('Request body:', requestBody);
    console.log('Request headers:', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.session.access_token.substring(0, 20)}...`,
    });
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Edge Function error response text:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `HTTP ${response.status}` };
      }
      
      console.error('Edge Function error data:', errorData);
      throw new Error(errorData.error || `HTTP ${response.status}: ${errorText}`);
    }

    const responseText = await response.text();
    console.log('Edge Function success response text:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing response JSON:', parseError);
      throw new Error('Invalid JSON response from server');
    }
    
    console.log('Edge Function success response data:', data);
    
    if (!data || !data.user) {
      console.error('Missing user in response data:', data);
      throw new Error('Invalid response format - missing user data');
    }
    
    return data.user;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    console.error('Error updating user - full details:', {
      error: error.message,
      stack: error.stack,
      userId,
      updates
    });
    throw error;
  }
};

export const updateUserPassword = async (userId: string, newPassword: string) => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('No authentication token found');
    }

    const functionUrl = constructFunctionUrl('/update-user-password');
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        userId,
        password: newPassword
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error updating password');
    }

    const data = await response.json();
    return data;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    console.error('Error updating password:', error);
    throw error;
  }
};

export const updateUserStores = async (userId: string, storeIds: string[]) => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('No authentication token found');
    }

    const functionUrl = constructFunctionUrl('/update-user-stores');
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({
        userId,
        storeIds
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error updating user stores');
    }

    const data = await response.json();
    return data;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    console.error('Error updating user stores:', error);
    throw error;
  }
};

export const deleteUser = async (userId: string) => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('No authentication token found');
    }

    const functionUrl = constructFunctionUrl('/delete-user');
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({ user_id: userId })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error deleting user');
    }

    return true;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const getUsers = async (): Promise<User[]> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('No authentication token found');
    }

    const functionUrl = constructFunctionUrl('/admin-users');
    
    const response = await fetch(functionUrl, {
      headers: {
        'Authorization': `Bearer ${session.session.access_token}`,
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error fetching users');
    }

    const data = await response.json();
    return data.users;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    console.error('Error fetching users:', error);
    throw error;
  }
};