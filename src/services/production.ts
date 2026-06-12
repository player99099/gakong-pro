import { supabase } from '../lib/supabase';
import type {
  ProcessLog,
  ProcessStatus,
  ProductionSearchParams,
  ProductionStats,
  ProductionTarget,
} from '../types';

const PROTECTED_ORDER_STATUSES = ['납품완료', '부분납품', '취소', '보류'];

export async function fetchProductionTargets(
  params?: ProductionSearchParams,
): Promise<ProductionTarget[]> {
  let query = supabase
    .from('orders')
    .select('*, customers(customer_name), work_orders(*)')
    .order('due_date', { ascending: true });

  if (params?.processStatus) query = query.eq('process_status', params.processStatus);
  if (params?.orderStatus) query = query.eq('order_status', params.orderStatus);
  if (params?.orderNo?.trim()) query = query.ilike('order_no', `%${params.orderNo.trim()}%`);
  if (params?.drawingNo?.trim()) query = query.ilike('drawing_no', `%${params.drawingNo.trim()}%`);
  if (params?.itemName?.trim()) query = query.ilike('item_name', `%${params.itemName.trim()}%`);
  if (params?.dueDateFrom) query = query.gte('due_date', params.dueDateFrom);
  if (params?.dueDateTo) query = query.lte('due_date', params.dueDateTo);

  const { data, error } = await query;
  if (error) throw error;

  let results = (data ?? []) as ProductionTarget[];
  if (params?.customerName?.trim()) {
    const term = params.customerName.trim().toLowerCase();
    results = results.filter((o) =>
      o.customers?.customer_name?.toLowerCase().includes(term),
    );
  }
  return results;
}

export async function fetchProductionStats(): Promise<ProductionStats> {
  const { data, error } = await supabase.from('orders').select('process_status');
  if (error) throw error;
  const rows = data ?? [];
  return {
    received: rows.filter((r) => r.process_status === '수주접수').length,
    drawingDeploy: rows.filter((r) => r.process_status === '도면배포').length,
    production: rows.filter((r) => r.process_status === '생산').length,
    postProcess: rows.filter((r) => r.process_status === '후처리').length,
    shipInspect: rows.filter((r) => r.process_status === '출하검사').length,
    readyToShip: rows.filter((r) => r.process_status === '출하대기').length,
  };
}

export async function fetchProcessLogs(orderId: string): Promise<ProcessLog[]> {
  const { data, error } = await supabase
    .from('process_logs')
    .select('*')
    .eq('order_id', orderId)
    .order('changed_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function changeProcessStatus(
  orderId: string,
  toStatus: ProcessStatus,
  memo: string,
  userEmail: string,
): Promise<void> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('process_status, order_status')
    .eq('id', orderId)
    .single();
  if (orderError) throw orderError;

  const fromStatus = order.process_status;

  const orderUpdate: Record<string, unknown> = {
    process_status: toStatus,
    updated_by: userEmail,
  };

  if (
    toStatus === '출하대기' &&
    !PROTECTED_ORDER_STATUSES.includes(order.order_status ?? '')
  ) {
    orderUpdate.order_status = '출하대기';
  }

  const { error: updateOrderError } = await supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', orderId);
  if (updateOrderError) throw updateOrderError;

  const { data: workOrder } = await supabase
    .from('work_orders')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (workOrder) {
    await supabase
      .from('work_orders')
      .update({ process_status: toStatus, updated_by: userEmail })
      .eq('id', workOrder.id);
  }

  await supabase.from('process_logs').insert({
    order_id: orderId,
    work_order_id: workOrder?.id ?? null,
    from_status: fromStatus,
    to_status: toStatus,
    memo: memo || null,
    changed_by: userEmail,
  });
}
