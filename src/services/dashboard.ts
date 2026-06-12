import { supabase } from '../lib/supabase';
import type { DashboardStats, Order } from '../types';

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = new Date().toISOString().split('T')[0];
  const soonDate = addDays(new Date(), 7);

  const { data, error } = await supabase
    .from('orders')
    .select('order_status, due_date');

  if (error) throw error;

  const orders = data ?? [];

  return {
    totalOrders: orders.length,
    dueSoon: orders.filter(
      (o) =>
        o.due_date &&
        o.due_date >= today &&
        o.due_date <= soonDate &&
        o.order_status !== '납품완료' &&
        o.order_status !== '취소',
    ).length,
    overdue: orders.filter(
      (o) =>
        o.due_date &&
        o.due_date < today &&
        o.order_status !== '납품완료' &&
        o.order_status !== '취소',
    ).length,
    readyToShip: orders.filter((o) => o.order_status === '출하대기').length,
    partialDelivery: orders.filter((o) => o.order_status === '부분납품').length,
  };
}

export async function fetchRecentOrders(limit = 8): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(customer_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
