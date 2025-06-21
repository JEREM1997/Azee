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
    console.log('🔎 GET PLAN DEBUG - Fetching plan for date:', date);
    console.log('🔎 GET PLAN DEBUG - Date type:', typeof date);
    console.log('🔎 GET PLAN DEBUG - Date length:', date?.length);
    
    const headers = await getAuthHeaders();
    const url = `${SUPABASE_URL}/functions/v1/get-current-plan?date=${date}`;
    
    console.log('🔎 GET PLAN DEBUG - Request URL:', url);
    console.log('🔎 GET PLAN DEBUG - Headers:', headers);
    
    const response = await fetch(url, { headers });

    console.log('🔎 GET PLAN DEBUG - Response status:', response.status);
    console.log('🔎 GET PLAN DEBUG - Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('🔎 GET PLAN DEBUG - Error response:', errorText);
      throw { status: response.status, message: errorText };
    }

    const data = await response.json();
    console.log('🔎 GET PLAN DEBUG - Response data:', data);
    console.log('🔎 GET PLAN DEBUG - Plan date in response:', data?.date);
    console.log('🔎 GET PLAN DEBUG - Expected date was:', date);
    console.log('🔎 GET PLAN DEBUG - Date comparison:', {
      requested: date,
      received: data?.date,
      match: data?.date === date
    });
    
    return data;
  } catch (error) {
    console.error('🔎 GET PLAN DEBUG - Error:', error);
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
    console.log('🔗 API DEBUG - About to save plan with data:', planData);
    console.log('🔗 API DEBUG - planData.date being sent:', planData.date);
    console.log('🔗 API DEBUG - typeof planData.date:', typeof planData.date);
    
    const headers = await getAuthHeaders();
    
    console.log('🔗 API DEBUG - Headers:', headers);
    console.log('🔗 API DEBUG - Request body (stringified):', JSON.stringify(planData));
    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/save-production-plan`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(planData),
      }
    );

    console.log('🔗 API DEBUG - Response status:', response.status);
    console.log('🔗 API DEBUG - Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('🔗 API DEBUG - Error response text:', errorText);
      throw { status: response.status, message: errorText };
    }

    const data = await response.json();
    console.log('🔗 API DEBUG - Response data:', data);
    console.log('🔗 API DEBUG - Returned plan ID:', data.id);
    
    return data.id;
  } catch (error) {
    console.error('🔗 API DEBUG - Save plan error:', error);
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