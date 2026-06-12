import { supabase } from '../lib/supabase';
import type { Order, OrderSearchParams } from '../types';

export type OrderInput = Omit<
  Order,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'customers'
>;

export async function fetchOrders(
  params?: OrderSearchParams,
): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select('*, customers(customer_name)')
    .order('created_at', { ascending: false });

  if (params?.orderNo?.trim()) {
    query = query.ilike('order_no', `%${params.orderNo.trim()}%`);
  }
  if (params?.drawingNo?.trim()) {
    query = query.ilike('drawing_no', `%${params.drawingNo.trim()}%`);
  }
  if (params?.itemName?.trim()) {
    query = query.ilike('item_name', `%${params.itemName.trim()}%`);
  }
  if (params?.orderStatus) {
    query = query.eq('order_status', params.orderStatus);
  }
  if (params?.dueDateFrom) {
    query = query.gte('due_date', params.dueDateFrom);
  }
  if (params?.dueDateTo) {
    query = query.lte('due_date', params.dueDateTo);
  }

  const { data, error } = await query;
  if (error) throw error;

  let results = data ?? [];

  if (params?.customerName?.trim()) {
    const term = params.customerName.trim().toLowerCase();
    results = results.filter((o) =>
      o.customers?.customer_name?.toLowerCase().includes(term),
    );
  }

  return results;
}

export async function createOrder(
  input: OrderInput,
  userEmail: string,
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .insert({ ...input, created_by: userEmail, updated_by: userEmail })
    .select('*, customers(customer_name)')
    .single();

  if (error) throw error;
  return data;
}

export async function updateOrder(
  id: string,
  input: OrderInput,
  userEmail: string,
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ ...input, updated_by: userEmail })
    .eq('id', id)
    .select('*, customers(customer_name)')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteOrder(id: string): Promise<void> {
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) throw error;
}
