import { supabase } from '../lib/supabase';
import { Order, OrderLineItem, UserRole } from '../types';

export interface CreateOrderPayload {
  storeId: string;
  storeName?: string;
  customerName: string;
  customerPhone: string;
  companyName?: string;
  deliveryAddress?: string;
  billingAddress?: string;
  deliveryDate: string;
  productionDate?: string;
  productionApproved: boolean;
  orderType: Order['orderType'];
  paymentStatus: Order['paymentStatus'];
  handledBy: string;
  deliveredBy?: string;
  conditioning: string;
  comments?: string;
  items: OrderLineItem[];
}

export interface FetchOrdersOptions {
  role?: UserRole;
  storeIds?: string[];
}

export const getSuggestedProductionDate = (deliveryDate: string) => {
  if (!deliveryDate) return '';

  const productionDate = new Date(deliveryDate);
  productionDate.setDate(productionDate.getDate() - 1);
  return productionDate.toISOString().split('T')[0];
};

const toFunctionError = async (error: any): Promise<Error> => {
  const context = error?.context;

  if (context && typeof context.json === 'function') {
    try {
      const payload = await context.json();
      if (payload?.error) {
        return new Error(payload.error);
      }
    } catch (_) {}
  }

  if (context && typeof context.text === 'function') {
    try {
      const message = await context.text();
      if (message) {
        return new Error(message);
      }
    } catch (_) {}
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Orders function failed');
};

const invokeManageOrders = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<T>('manage-orders', { body });

  if (error) {
    throw await toFunctionError(error);
  }

  return data as T;
};

export const fetchOrders = async (_options: FetchOrdersOptions = {}): Promise<Order[]> => {
  return invokeManageOrders<Order[]>({ action: 'list' });
};

export const createOrder = async (payload: CreateOrderPayload): Promise<Order> => {
  return invokeManageOrders<Order>({
    action: 'create',
    ...payload,
  });
};

export const updateOrderProduction = async (
  orderId: string,
  productionDate: string,
  productionApproved: boolean
): Promise<Order> => {
  return invokeManageOrders<Order>({
    action: 'updateProduction',
    orderId,
    productionDate,
    productionApproved,
  });
};

