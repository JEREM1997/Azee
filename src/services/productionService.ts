import { supabase } from '../lib/supabase';
import { ProductionPlan } from '../types';

export const getCurrentDayPlan = async (date: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    // Use the edge function instead of direct database access
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-current-plan?date=${date}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch production plan');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in getCurrentDayPlan:', error);
    throw error;
  }
};

export const getProductionPlans = async (limit: number = 7) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    // Use the edge function instead of direct database access
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-production-plans?days=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch production plans');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in getProductionPlans:', error);
    throw error;
  }
};

export const validatePlan = async (planId: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-production-plan`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planId }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to validate plan');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in validatePlan:', error);
    throw error;
  }
};

export const savePlan = async (planData: any) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-production-plan`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(planData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save plan');
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Error in savePlan:', error);
    throw error;
  }
};

export const updateDeliveryStatus = async (storeProductionId: string, data: { 
  deliveryConfirmed?: boolean; 
  received?: { [key: string]: number }; 
  waste?: { [key: string]: number };
  boxReceived?: { [key: string]: number };
  boxWaste?: { [key: string]: number };
}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-delivery-status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storeProductionId,
          ...data
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update delivery status');
    }

    return true;
  } catch (error) {
    console.error('Error in updateDeliveryStatus:', error);
    throw error;
  }
};

export const deletePlan = async (planId: string) => {
  try {
    console.log('deletePlan: Starting deletion for plan ID:', planId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }
    
    console.log('deletePlan: Session found, access token available');
    
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-production-plan`;
    console.log('deletePlan: Making request to URL:', url);
    
    const requestBody = JSON.stringify({ planId });
    console.log('deletePlan: Request body:', requestBody);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: requestBody,
    });

    console.log('deletePlan: Response status:', response.status);
    console.log('deletePlan: Response ok:', response.ok);

    if (!response.ok) {
      const errorData = await response.json();
      console.log('deletePlan: Error response:', errorData);
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('deletePlan: Success response:', data);
    return data;
  } catch (err) {
    console.error('deletePlan: Error occurred:', err);
    
    // If it's a network/CORS error, provide a helpful message
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error('Impossible de se connecter au serveur. Veuillez vérifier votre connexion internet et réessayer.');
    }
    
    // If it's a permission error, provide a clear message
    if (err instanceof Error) {
      if (err.message.includes('Insufficient permissions')) {
        throw new Error('Vous n\'avez pas les permissions nécessaires pour supprimer ce plan de production.');
      }
      if (err.message.includes('Cannot delete completed')) {
        throw new Error('Les plans de production terminés ne peuvent pas être supprimés.');
      }
      if (err.message.includes('not found')) {
        throw new Error('Plan de production introuvable.');
      }
      if (err.message.includes('User role not found')) {
        throw new Error('Rôle utilisateur non défini. Veuillez contacter votre administrateur.');
      }
    }
    
    throw err;
  }
};