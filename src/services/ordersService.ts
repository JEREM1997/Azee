import { supabase } from '../lib/supabase';
import { Order, OrderLineItem, UserRole } from '../types';

const ORDERS_CHANGED_EVENT = 'orders:changed';

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

export interface UpdateOrderPayload extends CreateOrderPayload {
  orderId: string;
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

const emitOrdersChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ORDERS_CHANGED_EVENT));
  }
};

export const createOrder = async (payload: CreateOrderPayload): Promise<Order> => {
  const order = await invokeManageOrders<Order>({
    action: 'create',
    ...payload,
  });
  emitOrdersChanged();
  return order;
};

export const updateOrderProduction = async (
  orderId: string,
  productionDate: string,
  productionApproved: boolean
): Promise<Order> => {
   const order = await invokeManageOrders<Order>({
    action: 'updateProduction',
    orderId,
    productionDate,
    productionApproved,
  });
  emitOrdersChanged();
  return order;
};

export const updateOrder = async (payload: UpdateOrderPayload): Promise<Order> => {
  const order = await invokeManageOrders<Order>({
    action: 'update',
    ...payload,
  });
  emitOrdersChanged();
  return order;
};

export const deleteOrder = async (orderId: string): Promise<void> => {
  await invokeManageOrders<{ id: string; deleted: boolean }>({
    action: 'delete',
    orderId,
  });
  emitOrdersChanged();
};

export const countPendingOrders = async (): Promise<number> => {
  const response = await invokeManageOrders<{ count: number }>({
    action: 'countPending',
  });

  return Number(response?.count) || 0;
};

export { ORDERS_CHANGED_EVENT };
