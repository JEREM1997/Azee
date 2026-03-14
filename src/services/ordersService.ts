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

const mapOrderRowToOrder = (row: any, itemsByOrder: Record<string, OrderLineItem[]>): Order => ({
  id: row.id,
  storeId: row.store_id,
  storeName: row.store_name ?? undefined,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  companyName: row.company_name ?? undefined,
  deliveryAddress: row.delivery_address ?? undefined,
  billingAddress: row.billing_address ?? undefined,
  deliveryDate: row.delivery_date,
  productionDate: row.production_date ?? getSuggestedProductionDate(row.delivery_date),
  productionApproved: !!row.production_approved,
  orderType: row.order_type,
  paymentStatus: row.payment_status,
  handledBy: row.handled_by,
  deliveredBy: row.delivered_by ?? undefined,
  conditioning: row.conditioning,
  comments: row.comments ?? undefined,
  items: itemsByOrder[row.id] || [],
  createdAt: row.created_at,
});

export const fetchOrders = async (options: FetchOrdersOptions = {}): Promise<Order[]> => {
  try {
    const { role, storeIds = [] } = options;

    if (role === 'store' && storeIds.length === 0) {
      return [];
    }

    let ordersQuery = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (role === 'store') {
      ordersQuery = ordersQuery.in('store_id', storeIds);
    }

    const { data: ordersData, error: ordersError } = await ordersQuery;

    if (ordersError) throw ordersError;
    if (!ordersData?.length) return [];

    const orderIds = ordersData.map(order => order.id);

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsError) throw itemsError;

    const itemsByOrder = (itemsData || []).reduce<Record<string, OrderLineItem[]>>((acc, item) => {
      if (!acc[item.order_id]) acc[item.order_id] = [];
      acc[item.order_id].push({
        varietyId: item.variety_id,
        quantity: item.quantity,
        conditioning: item.conditioning,
      });
      return acc;
    }, {});

    return ordersData.map(order => mapOrderRowToOrder(order, itemsByOrder));
  } catch (error: any) {
    const missingTable =
      error?.code === '42P01' ||
      error?.message?.includes('relation') ||
      error?.message?.includes('does not exist');
    
    if (missingTable) {
      console.warn('[fetchOrders] Supabase tables missing, returning empty order list');
      return [];
    }

    console.error('[fetchOrders] Error while loading orders', error);
    throw error;
   } 
};

export const createOrder = async (payload: CreateOrderPayload): Promise<Order> => {
  const productionDate = payload.productionDate?.trim() || getSuggestedProductionDate(payload.deliveryDate);
  
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      store_id: payload.storeId,
      store_name: payload.storeName,
      customer_name: payload.customerName,
      customer_phone: payload.customerPhone,
      company_name: payload.companyName,
      delivery_address: payload.deliveryAddress,
      billing_address: payload.billingAddress,
      delivery_date: payload.deliveryDate,
      production_date: productionDate,
      production_approved: payload.productionApproved,
      order_type: payload.orderType,
      payment_status: payload.paymentStatus,
      handled_by: payload.handledBy,
      delivered_by: payload.deliveredBy,
      conditioning: payload.conditioning,
      comments: payload.comments,
    })
    .select()
    .single();

  if (orderError) throw orderError;
  if (!orderData) throw new Error('Order insertion failed');

  const { error: itemsError } = await supabase.from('order_items').insert(
    payload.items.map(item => ({
      order_id: orderData.id,
      variety_id: item.varietyId,
      quantity: item.quantity,
      conditioning: item.conditioning,
    }))
  );

  if (itemsError) {
    await supabase.from('orders').delete().eq('id', orderData.id);
    throw itemsError;
  }

  return mapOrderRowToOrder(
    {
      ...orderData,
      production_date: productionDate,
    },
    { [orderData.id]: payload.items }
  );
};

export const updateOrderProduction = async (
  orderId: string,
  productionDate: string,
  productionApproved: boolean
): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .update({
      production_date: productionDate,
      production_approved: productionApproved,
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Order update failed');

  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsError) throw itemsError;

  const items = (itemsData || []).map(item => ({
    varietyId: item.variety_id,
    quantity: item.quantity,
    conditioning: item.conditioning,
  }));

  return mapOrderRowToOrder(data, { [orderId]: items });
};
