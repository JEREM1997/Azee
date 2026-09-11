import { supabase } from '../lib/supabase';
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

    let startDate: string;

    if (isDaysParam) {
      // Mode "fenêtre glissante" : start = endDate - days
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
      // Mode "start/end" explicite
      if (!dateUtils.isValidDateString(startOrDays) || !dateUtils.isValidDateString(endDate)) {
        throw new Error('Invalid date format');
      }
      startDate = dateUtils.formatApiDate(startOrDays);
    }

    const formattedEndDate = dateUtils.formatApiDate(endDate);

    // 🔹 Appel direct de l'Edge Function get-production-plans
    const { data, error } = await supabase.functions.invoke('get-production-plans', {
      body: {
        startDate,
        endDate: formattedEndDate,
        allStores,
      },
    });

    if (error) {
      console.error('[productionService] Error calling get-production-plans:', error);
      const context = (error as any)?.context as Response | undefined;
      let details: any = null;
      if (context) {
        try {
          details = await context.clone().json();
        } catch (_) {
          try { details = { error: await context.clone().text() }; } catch (_) { /* no readable response body */ }
        }
      }
      const message = details?.error || details?.message || error.message || 'Impossible de charger les plans';
      const enriched = Object.assign(new Error(message), {
        status: context?.status,
        code: details?.code || details?.details?.code,
        functionName: 'get-production-plans',
        range: { startDate, endDate: formattedEndDate },
      });
      console.error('[productionService] get-production-plans diagnostics', {
        status: enriched.status,
        code: enriched.code,
        range: enriched.range,
        message: enriched.message,
      });
      throw enriched;
    }

    return (data as ProductionPlan[]) || [];
  },

  async deleteProductionPlan(planId: string): Promise<void> {
    const { error } = await apiService.production.deleteProductionPlan(planId);
    if (error) throw error;
  }
};
