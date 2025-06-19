import { supabase } from '../lib/supabase';
import { ProductionPlan } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getAuthHeaders = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    throw new Error('Authentication required');
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
};

const handleApiError = (error: any, customMessage: string) => {
  console.error(`${customMessage}:`, error);
  if (error.status === 401 || error.status === 403) {
    // Token expired or invalid - trigger a refresh
    supabase.auth.refreshSession();
    throw new Error('Session expired. Please try again.');
  }
  if (error.status === 500) {
    throw new Error('Server error. Please try again later.');
  }
  throw new Error(error.message || customMessage);
};

export const getCurrentDayPlan = async (date: string) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/get-current-plan?date=${date}`,
      { headers }
    );

    if (!response.ok) {
      throw { status: response.status, message: await response.text() };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch current day plan');
  }
};

export const getProductionPlans = async (days: number = 30) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/get-production-plans?days=${days}`,
      { headers }
    );

    if (!response.ok) {
      throw { status: response.status, message: await response.text() };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch production plans');
  }
};

export const validatePlan = async (planId: string) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/validate-production-plan`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId }),
      }
    );

    if (!response.ok) {
      throw { status: response.status, message: await response.text() };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    handleApiError(error, 'Failed to validate plan');
  }
};

export const savePlan = async (planData: any) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/save-production-plan`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(planData),
      }
    );

    if (!response.ok) {
      throw { status: response.status, message: await response.text() };
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    handleApiError(error, 'Failed to save production plan');
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
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/update-delivery-status`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          storeProductionId,
          ...data
        }),
      }
    );

    if (!response.ok) {
      throw { status: response.status, message: await response.text() };
    }

    return true;
  } catch (error) {
    handleApiError(error, 'Failed to update delivery status');
  }
};

export const deletePlan = async (planId: string) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/delete-production-plan`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ planId }),
      }
    );

    if (!response.ok) {
      throw { status: response.status, message: await response.text() };
    }

    return true;
  } catch (error) {
    handleApiError(error, 'Failed to delete production plan');
  }
};