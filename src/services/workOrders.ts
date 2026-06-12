import { supabase } from '../lib/supabase';
import type {
  Order,
  WorkOrder,
  WorkOrderInput,
  WorkOrderSearchParams,
  WorkOrderStats,
} from '../types';

export async function fetchWorkOrders(
  params?: WorkOrderSearchParams,
): Promise<WorkOrder[]> {
  let query = supabase
    .from('work_orders')
    .select('*, customers(customer_name)')
    .order('created_at', { ascending: false });

  if (params?.processStatus) query = query.eq('process_status', params.processStatus);
  if (params?.orderNo?.trim()) query = query.ilike('order_no', `%${params.orderNo.trim()}%`);
  if (params?.drawingNo?.trim()) query = query.ilike('drawing_no', `%${params.drawingNo.trim()}%`);
  if (params?.dueDateFrom) query = query.gte('due_date', params.dueDateFrom);
  if (params?.dueDateTo) query = query.lte('due_date', params.dueDateTo);

  const { data, error } = await query;
  if (error) throw error;

  let results = data ?? [];
  if (params?.customerName?.trim()) {
    const term = params.customerName.trim().toLowerCase();
    results = results.filter((w) =>
      w.customers?.customer_name?.toLowerCase().includes(term),
    );
  }
  return results;
}

export async function fetchWorkOrderById(id: string): Promise<WorkOrder> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*, customers(customer_name)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchWorkOrderStats(): Promise<WorkOrderStats> {
  const { data, error } = await supabase.from('work_orders').select('process_status');
  if (error) throw error;
  const rows = data ?? [];
  return {
    total: rows.length,
    drawingDeploy: rows.filter((r) => r.process_status === '도면배포').length,
    production: rows.filter((r) => r.process_status === '생산').length,
    postProcess: rows.filter((r) => r.process_status === '후처리').length,
    shipInspect: rows.filter((r) => r.process_status === '출하검사').length,
    readyToShip: rows.filter((r) => r.process_status === '출하대기').length,
  };
}

export async function fetchOrdersWithoutWorkOrder(): Promise<Order[]> {
  const { data: workOrders, error: woError } = await supabase
    .from('work_orders')
    .select('order_id');
  if (woError) throw woError;

  const usedIds = (workOrders ?? []).map((w) => w.order_id);

  let query = supabase
    .from('orders')
    .select('*, customers(customer_name)')
    .neq('order_status', '취소')
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).filter((o) => !usedIds.includes(o.id));
}

export async function createWorkOrderFromOrder(
  orderId: string,
  userEmail: string,
): Promise<WorkOrder> {
  const { data: existing } = await supabase
    .from('work_orders')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existing) throw new Error('이미 작업지시가 생성된 수주입니다.');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (orderError) throw orderError;

  const input: WorkOrderInput = {
    order_id: order.id,
    customer_id: order.customer_id,
    order_no: order.order_no,
    drawing_no: order.drawing_no,
    item_name: order.item_name,
    order_quantity: order.order_quantity,
    due_date: order.due_date,
    process_status: order.process_status ?? '수주접수',
    instruction_memo: null,
    drawing_file_name: order.drawing_file_name,
  };

  const { data, error } = await supabase
    .from('work_orders')
    .insert({ ...input, created_by: userEmail, updated_by: userEmail })
    .select('*, customers(customer_name)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorkOrder(
  id: string,
  input: Partial<WorkOrderInput>,
  userEmail: string,
): Promise<WorkOrder> {
  const existing = await fetchWorkOrderById(id);

  const { data, error } = await supabase
    .from('work_orders')
    .update({ ...input, updated_by: userEmail })
    .eq('id', id)
    .select('*, customers(customer_name)')
    .single();
  if (error) throw error;

  if (input.process_status && input.process_status !== existing.process_status) {
    await supabase
      .from('orders')
      .update({
        process_status: input.process_status,
        updated_by: userEmail,
      })
      .eq('id', existing.order_id);
  }

  return data;
}

export async function deleteWorkOrder(id: string): Promise<void> {
  const { error } = await supabase.from('work_orders').delete().eq('id', id);
  if (error) throw error;
}
