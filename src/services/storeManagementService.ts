import { supabase } from '../lib/supabase';
import { Store, DonutVariety, DonutForm, BoxConfiguration } from '../types';

export const getAllStoreData = async () => {
  try {
    // Get the current session to include the auth token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error(`Authentication error: ${sessionError.message}`);
    }
    
    if (!session) {
      console.warn('No authenticated session found - user may need to log in');
      throw new Error('No authenticated session found');
    }

    // Call the edge function instead of direct table queries
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-admin-data`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API response error:', response.status, errorText);
      throw new Error(`Failed to fetch admin data: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    return {
      stores: data.stores || [],
      varieties: data.varieties || [],
      forms: data.forms || [],
      boxes: data.boxes || []
    };
  } catch (error) {
    console.error('Error in getAllStoreData:', error);
    throw error;
  }
};

export const createStore = async (store: Store) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-store`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: store.name,
        location: store.location,
        is_active: store.isActive,
        available_varieties: store.availableVarieties || [],
        available_boxes: store.availableBoxes || []
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create store: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in createStore:', error);
    throw error;
  }
};

export const updateStore = async (store: Store) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-store`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: store.id,
        name: store.name,
        location: store.location,
        is_active: store.isActive,
        available_varieties: store.availableVarieties || [],
        available_boxes: store.availableBoxes || []
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update store: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in updateStore:', error);
    throw error;
  }
};

export const deleteStore = async (id: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-store`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete store: ${response.status} ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error('Error in deleteStore:', error);
    throw error;
  }
};

export const createDonutForm = async (form: DonutForm) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-donut-form`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        is_active: form.isActive
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create donut form: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in createDonutForm:', error);
    throw error;
  }
};

export const updateDonutForm = async (form: DonutForm) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-donut-form`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: form.id,
        name: form.name,
        description: form.description,
        is_active: form.isActive
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update donut form: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in updateDonutForm:', error);
    throw error;
  }
};

export const deleteDonutForm = async (id: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-donut-form`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete donut form: ${response.status} ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error('Error in deleteDonutForm:', error);
    throw error;
  }
};

export const createDonutVariety = async (variety: DonutVariety) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-donut-variety`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: variety.name,
        description: variety.description,
        form_id: variety.formId,
        production_cost: variety.productionCost,
        is_active: variety.isActive,
        is_orderable: variety.isOrderable ?? true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create donut variety: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in createDonutVariety:', error);
    throw error;
  }
};

export const updateDonutVariety = async (variety: DonutVariety) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-donut-variety`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: variety.id,
        name: variety.name,
        description: variety.description,
        form_id: variety.formId,
        production_cost: variety.productionCost,
        is_active: variety.isActive,
        is_orderable: variety.isOrderable ?? true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update donut variety: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in updateDonutVariety:', error);
    throw error;
  }
};

export const deleteDonutVariety = async (id: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-donut-variety`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete donut variety: ${response.status} ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error('Error in deleteDonutVariety:', error);
    throw error;
  }
};

export const createBoxConfiguration = async (box: BoxConfiguration) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-box-configuration`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: box.name,
        size: box.size,
        is_active: box.isActive,
        varieties: box.varieties || []
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create box configuration: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in createBoxConfiguration:', error);
    throw error;
  }
};

export const updateBoxConfiguration = async (box: BoxConfiguration) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-box-configuration`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: box.id,
        name: box.name,
        size: box.size,
        is_active: box.isActive,
        varieties: box.varieties || []
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update box configuration: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error in updateBoxConfiguration:', error);
    throw error;
  }
};

export const deleteBoxConfiguration = async (id: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authenticated session found');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-box-configuration`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete box configuration: ${response.status} ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error('Error in deleteBoxConfiguration:', error);
    throw error;
  }
};
