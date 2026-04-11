import { supabase } from '../lib/supabase';
import { AppErrorHandler } from '../utils/errorHandling';
import { ProductionPlan, User, Store, DonutForm, DonutVariety, BoxConfiguration, AuditLog, AuditLogFilters } from '../types';

interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
}

interface ValidationResponse {
  isValid: boolean;
}

export interface StoreDailyFeatureRow {
  store_id: string;
  date: string;
  rain_mm: number | null;
  is_holiday: boolean | null;
  promo_intensity: number | null;
}

interface CreateUserData {
  email: string;
  password: string;
  role: string;
  fullName: string;
  storeIds?: string[];
}

interface UpdateUserData {
  role?: string;
  fullName?: string;
  storeIds?: string[];
}

interface StoreData {
  name: string;
  location: string;
  isActive: boolean;
  availableVarieties: string[];
  availableBoxes: string[];
}

const extractErrorMessage = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if ('error' in value && typeof value.error === 'string') return value.error;
    if ('message' in value && typeof value.message === 'string') return value.message;
    if ('details' in value && typeof value.details === 'string') return value.details;
    if ('description' in value && typeof value.description === 'string') return value.description;
    if ('hint' in value && typeof value.hint === 'string') return value.hint;
  }
  return null;
};

const readErrorContextMessage = async (context: unknown): Promise<string | null> => {
  if (!context || typeof context !== 'object') {
    return null;
  }

  const responseLike = context as {
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
  };

  try {
    if (typeof responseLike.json === 'function') {
      const payload = await responseLike.json();
      const message = extractErrorMessage(payload);
      if (message) {
        return message;
      }
    }
  } catch (_) {}

    try {
    if (typeof responseLike.text === 'function') {
      const text = await responseLike.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as unknown;
          const message = extractErrorMessage(parsed);
          if (message) {
            return message;
          }
         } catch (_) {
          return text;
      }
    }
  }
  } catch (_) {}

  return null;
};

const toReadableApiError = async (error: unknown): Promise<Error> => {
  const errorWithContext = error as Error & Record<string, unknown> & {
    context?: unknown;
    response?: unknown;
    cause?: unknown;
  };

  const contextualMessage =
    (await readErrorContextMessage(errorWithContext?.context)) ||
    (await readErrorContextMessage(errorWithContext?.response));
  if (contextualMessage) {
    return new Error(contextualMessage);
  }

  const extractedMessage =
    extractErrorMessage(errorWithContext) ||
    extractErrorMessage(errorWithContext?.cause);
  if (extractedMessage) {
    return new Error(extractedMessage);
  }

  if (error instanceof Error && error.message) {
    return error;
  }

  const handled = AppErrorHandler.handleApiError(error);
  return new Error(handled.message);
};

export const apiService = {
  /**
   * Generic function to invoke Supabase Edge Functions
   */
  async invoke<T>(
    functionName: string,
    body?: Record<string, unknown>,
    options: { throwError?: boolean } = { throwError: true }
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await supabase.functions.invoke<T>(functionName, {
        body
      });

      if (error && options.throwError) {
        // Automatic sign-out on invalid / expired token so user is redirected to login
        if (typeof error.message === 'string' && error.message.toLowerCase().includes('invalid token')) {
          try {
            await supabase.auth.signOut();
          } catch (_) {}
          // Force reload to login page preserving current route for after-login redirect if desired
          window.location.href = '/login?expired=1';
          // Return here to stop further processing
          return { data: null, error } as ApiResponse<T>;
        }

        throw await toReadableApiError(error);
      }

      return { data, error: error as Error | null };
    } catch (error) {
      if (options.throwError) {
        throw AppErrorHandler.handleApiError(error);
      }
      return { data: null, error: await toReadableApiError(error) };
    }
  },

  /**
   * Admin Functions
   */
  admin: {
    async getAdminData() {
      return apiService.invoke<{
        users: User[];
        stores: Store[];
        forms: DonutForm[];
        varieties: DonutVariety[];
        boxes: BoxConfiguration[];
      }>('get-admin-data');
    },

    async getUsers() {
      return apiService.invoke<User[]>('admin-users');
    }
  },

  /**
   * User Management Functions
   */
  users: {
    async createUser(userData: CreateUserData) {
      return apiService.invoke<User>('create-user', userData as unknown as Record<string, unknown>);
    },

    async updateUser(userId: string, userData: UpdateUserData) {
      return apiService.invoke<User>('update-user', { userId, ...userData } as unknown as Record<string, unknown>);
    },

    async deleteUser(userId: string) {
      return apiService.invoke<void>('delete-user', { userId });
    },

    async updateUserPassword(userId: string, newPassword: string) {
      return apiService.invoke<void>('update-user-password', { userId, newPassword });
    },

    async updateUserStores(userId: string, storeIds: string[]) {
      return apiService.invoke<void>('update-user-stores', { userId, storeIds });
    }
  },

  /**
   * Store Management Functions
   */
  stores: {
    async createStore(storeData: StoreData) {
      return apiService.invoke<Store>('create-store', storeData as unknown as Record<string, unknown>);
    },

    async updateStore(storeId: string, storeData: Partial<StoreData>) {
      return apiService.invoke<Store>('update-store', { storeId, ...storeData } as unknown as Record<string, unknown>);
    },

    async deleteStore(storeId: string) {
      return apiService.invoke<void>('delete-store', { storeId });
    }
  },

  /**
   * Production Management Functions
   */
  production: {
    // Fetch a single production plan for a given date.
    // When `allStores` is true, store users will receive *all* stores instead of only their assigned ones.
    async getCurrentPlan(date: string, allStores: boolean = false) {
      return apiService.invoke<ProductionPlan>('get-current-plan', { date, allStores });
    },

    // Fetch all production plans between two dates.
    // When `allStores` is true, store users will receive *all* stores instead of only their assigned ones.
    async getProductionPlans(startDate: string, endDate: string, allStores: boolean = false) {
      const label = `[invoke:get-production-plans] ${startDate}→${endDate} allStores=${allStores}`;
      console.log(label, 'request body');
      console.time(label);
      const res = await apiService.invoke<ProductionPlan[]>('get-production-plans', { startDate, endDate, allStores });
      console.timeEnd(label);
      if (res?.data) {
        console.log('[invoke:get-production-plans] result', { count: res.data.length });
      }
      if (res?.error) {
        console.error('[invoke:get-production-plans] error', res.error);
      }
      return res;
    },

    async saveProductionPlan(planData: Partial<ProductionPlan>) {
      return apiService.invoke<void>('save-production-plan', planData);
    },

    async validateProductionPlan(planData: Partial<ProductionPlan>) {
      return apiService.invoke<ValidationResponse>('validate-production-plan', planData);
    },

    async deleteProductionPlan(planId: string) {
      return apiService.invoke<void>('delete-production-plan', { planId });
      },

    async getStoreDailyFeatures(date: string, storeIds: string[]) {
      if (!storeIds.length) {
        return { data: [], error: null } as ApiResponse<StoreDailyFeatureRow[]>;
      }

      try {
        const { data, error } = await supabase
          .from('store_daily_features')
          .select('store_id, date, rain_mm, is_holiday, promo_intensity')
          .eq('date', date)
          .in('store_id', storeIds);

        if (error) {
          throw error;
        }

        return { data: (data || []) as StoreDailyFeatureRow[], error: null };
      } catch (error) {
        return { data: null, error: await toReadableApiError(error) };
      }
    }
  },

  /**
   * Delivery Management Functions
   */
  delivery: {
    async updateDeliveryStatus(storeProductionId: string, updates: Record<string, unknown>) {
      return apiService.invoke<void>('update-delivery-status', { storeProductionId, updates });
    }
  },

  /**
   * Product Management Functions
   */
  products: {
    async createDonutForm(formData: any) {
      return apiService.invoke('create-donut-form', formData);
    },

    async updateDonutForm(formId: string, formData: any) {
      return apiService.invoke('update-donut-form', { formId, ...formData });
    },

    async deleteDonutForm(formId: string) {
      return apiService.invoke('delete-donut-form', { formId });
    },

    async createDonutVariety(varietyData: any) {
      return apiService.invoke('create-donut-variety', varietyData);
    },

    async updateDonutVariety(varietyId: string, varietyData: any) {
      return apiService.invoke('update-donut-variety', { varietyId, ...varietyData });
    },

    async deleteDonutVariety(varietyId: string) {
      return apiService.invoke('delete-donut-variety', { varietyId });
    }
  },

  /**
   * Box Configuration Functions
   */
  boxes: {
    async createBoxConfiguration(configData: any) {
      return apiService.invoke('create-box-configuration', configData);
    },

    async updateBoxConfiguration(configId: string, configData: any) {
      return apiService.invoke('update-box-configuration', { configId, ...configData });
    },

    async deleteBoxConfiguration(configId: string) {
      return apiService.invoke('delete-box-configuration', { configId });
    }
  },

  /**
   * Authentication Functions
   */
  auth: {
    getUserRole: async () => {
      return apiService.invoke('auth-role');
    },
  },

  /**
   * Audit Functions
   */
  audit: {
    getLogs: async (filters: AuditLogFilters = {}) => {
      return apiService.invoke<AuditLog[]>('get-audit-logs', filters as unknown as Record<string, unknown>);
    },
  },
}; 
