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

  async getProductionPlans(startDate: string, endDate: string): Promise<ProductionPlan[]> {
    if (!dateUtils.isValidDateString(startDate) || !dateUtils.isValidDateString(endDate)) {
      throw new Error('Invalid date format');
    }

    const formattedStartDate = dateUtils.formatApiDate(startDate);
    const formattedEndDate = dateUtils.formatApiDate(endDate);

    const { data, error } = await apiService.production.getProductionPlans(
      formattedStartDate,
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