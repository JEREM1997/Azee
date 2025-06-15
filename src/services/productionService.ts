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