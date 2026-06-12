import { supabase } from '../lib/supabase';
import type { DashboardLists, DashboardStats, Order } from '../types';

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = new Date().toISOString().split('T')[0];
  const soonDate = addDays(new Date(), 7);

  const [ordersRes, deliveriesRes, prodLogsRes] = await Promise.all([
    supabase.from('orders').select('order_status, process_status, due_date'),
    supabase.from('deliveries').select('delivery_date').eq('delivery_date', today),
    supabase.from('production_logs').select('id').eq('work_date', today),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (deliveriesRes.error) throw deliveriesRes.error;
  if (prodLogsRes.error) throw prodLogsRes.error;

  const orders = ordersRes.data ?? [];

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
    inProduction: orders.filter((o) => o.process_status === '생산').length,
    readyToShip: orders.filter(
      (o) => o.process_status === '출하대기' || o.order_status === '출하대기',
    ).length,
    partialDelivery: orders.filter((o) => o.order_status === '부분납품').length,
    todayDeliveries: (deliveriesRes.data ?? []).length,
    todayProductionLogs: (prodLogsRes.data ?? []).length,
  };
}

export async function fetchDashboardLists(): Promise<DashboardLists> {
  const today = new Date().toISOString().split('T')[0];
  const soonDate = addDays(new Date(), 7);

  const [dueSoonRes, inProdRes, readyRes, prodLogRes, deliveryRes] =
    await Promise.all([
      supabase
        .from('orders')
        .select('*, customers(customer_name)')
        .gte('due_date', today)
        .lte('due_date', soonDate)
        .neq('order_status', '납품완료')
        .neq('order_status', '취소')
        .order('due_date')
        .limit(8),
      supabase
        .from('orders')
        .select('*, customers(customer_name)')
        .eq('process_status', '생산')
        .order('due_date')
        .limit(8),
      supabase
        .from('orders')
        .select('*, customers(customer_name)')
        .eq('process_status', '출하대기')
        .order('due_date')
        .limit(8),
      supabase
        .from('production_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('deliveries')
        .select('*, customers(customer_name), delivery_items(id)')
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

  if (dueSoonRes.error) throw dueSoonRes.error;
  if (inProdRes.error) throw inProdRes.error;
  if (readyRes.error) throw readyRes.error;
  if (prodLogRes.error) throw prodLogRes.error;
  if (deliveryRes.error) throw deliveryRes.error;

  return {
    dueSoonOrders: (dueSoonRes.data ?? []) as Order[],
    inProductionOrders: (inProdRes.data ?? []) as Order[],
    readyToShipOrders: (readyRes.data ?? []) as Order[],
    recentProductionLogs: prodLogRes.data ?? [],
    recentDeliveries: (deliveryRes.data ?? []).map((d) => ({
      ...d,
      item_count: (d.delivery_items ?? []).length,
    })),
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
