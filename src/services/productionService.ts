import { dateUtils } from '../utils/dateUtils';
import { validationUtils } from '../utils/validationUtils';
import { apiService } from './apiService';
import { ProductionPlan } from '../types';

export const productionService = {
  async getProductionPlan(date: string, allStores: boolean = false): Promise<ProductionPlan | null> {
    if (!dateUtils.isValidDateString(date)) {
      throw new Error('Invalid date format');
    }

    const formattedDate = dateUtils.formatApiDate(date);
    const { data, error } = await apiService.production.getCurrentPlan(formattedDate, allStores);

    if (error) throw error;
    return data;
  },

  async saveProductionPlan(plan: ProductionPlan): Promise<void> {
    // Validate the plan
    const validation = validationUtils.validateProductionPlan(plan);
    if (!validation.isValid) {
      throw new Error(validation.errors[0].message);
    }

    // Transform stores to match Edge Function contract
    const transformedStores = plan.stores.map(store => ({
      store_id: store.store_id,
      store_name: store.store_name,
      delivery_date: store.delivery_date
        ? dateUtils.formatApiDate(store.delivery_date)
        : undefined,
      total_quantity: store.total_quantity,
      // Map production_items -> items (varieties)
      items: (store.production_items || []).map(item => ({
        varietyId: item.variety_id,
        varietyName: item.variety_name,
        formId: item.form_id,
        formName: item.form_name,
        quantity: item.quantity
      })),
      // Map box_productions -> boxes
      boxes: (store.box_productions || []).map(box => ({
        boxId: box.box_id,
        boxName: box.box_name,
        quantity: box.quantity
      }))
    }));

    // Build payload expected by save-production-plan Edge Function
    const payload: any = {
      date: dateUtils.formatApiDate(plan.date),
      totalProduction: plan.total_production,
      status: plan.status,
      stores: transformedStores,
      existingPlanId: plan.id && plan.id.trim() !== '' ? plan.id : undefined
    };

    const { error } = await apiService.production.saveProductionPlan(payload);
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

  async getProductionPlans(startOrDays: string, endDate: string, allStores: boolean = false): Promise<ProductionPlan[]> {
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
      formattedEndDate,
      allStores
    );

    if (error) throw error;
    return data || [];
  },

  async deleteProductionPlan(planId: string): Promise<void> {
    const { error } = await apiService.production.deleteProductionPlan(planId);
    if (error) throw error;
  }
};