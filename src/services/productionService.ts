import { dateUtils } from '../utils/dateUtils';
import { validationUtils } from '../utils/validationUtils';
import { apiService } from './apiService';
import { ProductionPlan } from '../types';

export const productionService = {
  async getProductionPlan(date: string): Promise<ProductionPlan | null> {
    if (!dateUtils.isValidDateString(date)) {
      throw new Error('Invalid date format');
    }

    const formattedDate = dateUtils.formatApiDate(date);
    const { data, error } = await apiService.production.getCurrentPlan(formattedDate);

    if (error) throw error;
    return data;
  },

  async saveProductionPlan(plan: ProductionPlan): Promise<void> {
    // Validate the plan
    const validation = validationUtils.validateProductionPlan(plan);
    if (!validation.isValid) {
      throw new Error(validation.errors[0].message);
    }

    // Format dates in the plan
    const formattedPlan: Partial<ProductionPlan> = {
      ...plan,
      date: dateUtils.formatApiDate(plan.date),
      stores: plan.stores.map(store => ({
        ...store,
        delivery_date: store.delivery_date 
          ? dateUtils.formatApiDate(store.delivery_date)
          : undefined
      }))
    };

    const { error } = await apiService.production.saveProductionPlan(formattedPlan);
    if (error) throw error;
  },

  async validateProductionPlan(plan: ProductionPlan): Promise<boolean> {
    // Validate the plan format first
    const validation = validationUtils.validateProductionPlan(plan);
    if (!validation.isValid) {
      throw new Error(validation.errors[0].message);
    }

    // Format dates in the plan
    const formattedPlan: Partial<ProductionPlan> = {
      ...plan,
      date: dateUtils.formatApiDate(plan.date),
      stores: plan.stores.map(store => ({
        ...store,
        delivery_date: store.delivery_date 
          ? dateUtils.formatApiDate(store.delivery_date)
          : undefined
      }))
    };

    const { data, error } = await apiService.production.validateProductionPlan(formattedPlan);
    if (error) throw error;
    return data?.isValid || false;
  },

  async getProductionPlans(startOrDays: string, endDate: string): Promise<ProductionPlan[]> {
    // Detect if the first argument is a numeric string (e.g. "7", "30") meaning "days"
    const isDaysParam = /^\d+$/.test(startOrDays);

    // If numeric, treat as a rolling window ending at endDate
    let startDate: string;
    if (isDaysParam) {
      if (!dateUtils.isValidDateString(endDate)) {
        throw new Error('Invalid date format');
      }

      const days = parseInt(startOrDays, 10);
      if (isNaN(days) || days < 1) {
        throw new Error('Days parameter must be a positive integer');
      }

      const calculatedStart = dateUtils.addDays(endDate, -days);
      startDate = dateUtils.formatApiDate(calculatedStart);
    } else {
      // First argument is expected to be an explicit start date
      if (!dateUtils.isValidDateString(startOrDays) || !dateUtils.isValidDateString(endDate)) {
        throw new Error('Invalid date format');
      }
      startDate = dateUtils.formatApiDate(startOrDays);
    }

    const formattedEndDate = dateUtils.formatApiDate(endDate);

    const { data, error } = await apiService.production.getProductionPlans(
      startDate,
      formattedEndDate
    );

    if (error) throw error;
    return data || [];
  },

  async deleteProductionPlan(planId: string): Promise<void> {
    const { error } = await apiService.production.deleteProductionPlan(planId);
    if (error) throw error;
  }
};