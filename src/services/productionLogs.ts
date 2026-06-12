import { supabase } from '../lib/supabase';
import type {
  Order,
  ProcessStatus,
  ProductionLog,
  ProductionLogInput,
  ProductionLogSearchParams,
  ProductionLogStats,
  WorkOrder,
} from '../types';

async function recalculateOrderProduction(orderId: string, userEmail: string): Promise<void> {
  const { data: logs, error: logError } = await supabase
    .from('production_logs')
    .select('production_quantity, defect_quantity')
    .eq('order_id', orderId);
  if (logError) throw logError;

  const produced = (logs ?? []).reduce((s, l) => s + Number(l.production_quantity), 0);
  const defect = (logs ?? []).reduce((s, l) => s + Number(l.defect_quantity), 0);

  const { error } = await supabase
    .from('orders')
    .update({
      produced_quantity: produced,
      defect_quantity: defect,
      updated_by: userEmail,
    })
    .eq('id', orderId);
  if (error) throw error;
}

export async function fetchProductionLogs(
  params?: ProductionLogSearchParams,
): Promise<ProductionLog[]> {
  let query = supabase
    .from('production_logs')
    .select('*')
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (params?.workDateFrom) query = query.gte('work_date', params.workDateFrom);
  if (params?.workDateTo) query = query.lte('work_date', params.workDateTo);
  if (params?.workerName?.trim()) query = query.ilike('worker_name', `%${params.workerName.trim()}%`);
  if (params?.equipment?.trim()) query = query.ilike('equipment', `%${params.equipment.trim()}%`);
  if (params?.orderNo?.trim()) query = query.ilike('order_no', `%${params.orderNo.trim()}%`);
  if (params?.drawingNo?.trim()) query = query.ilike('drawing_no', `%${params.drawingNo.trim()}%`);
  if (params?.customerName?.trim()) query = query.ilike('customer_name', `%${params.customerName.trim()}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchProductionLogById(id: string): Promise<ProductionLog> {
  const { data, error } = await supabase
    .from('production_logs')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchProductionLogStats(): Promise<ProductionLogStats> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('production_logs')
    .select('processing_minutes, production_quantity, defect_quantity')
    .eq('work_date', today);
  if (error) throw error;
  const rows = data ?? [];
  return {
    todayCount: rows.length,
    todayMinutes: rows.reduce((s, r) => s + Number(r.processing_minutes), 0),
    todayProductionQty: rows.reduce((s, r) => s + Number(r.production_quantity), 0),
    todayDefectQty: rows.reduce((s, r) => s + Number(r.defect_quantity), 0),
  };
}

export async function fetchOrdersForProductionSelect(): Promise<
  (Order & { work_orders?: WorkOrder[] })[]
> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(customer_name), work_orders(id, drawing_no, item_name)')
    .neq('order_status', '취소')
    .order('order_no');
  if (error) throw error;
  return data ?? [];
}

export async function createProductionLog(
  input: ProductionLogInput,
  userEmail: string,
  options?: { updateProcessToProduction?: boolean },
): Promise<ProductionLog> {
  if (!input.worker_name?.trim()) throw new Error('작업자를 입력해 주세요.');
  if (!input.work_date) throw new Error('작업일자를 입력해 주세요.');
  if (!input.order_id) throw new Error('수주/작업지시를 선택해 주세요.');

  const { data, error } = await supabase
    .from('production_logs')
    .insert({ ...input, created_by: userEmail, updated_by: userEmail })
    .select()
    .single();
  if (error) throw error;

  await recalculateOrderProduction(input.order_id, userEmail);

  if (
    options?.updateProcessToProduction &&
    Number(input.production_quantity) > 0
  ) {
    const { data: order } = await supabase
      .from('orders')
      .select('process_status')
      .eq('id', input.order_id)
      .single();

    if (order && order.process_status !== '생산') {
      const toStatus = '생산' as ProcessStatus;
      await supabase
        .from('orders')
        .update({ process_status: toStatus, updated_by: userEmail })
        .eq('id', input.order_id);

      const { data: wo } = await supabase
        .from('work_orders')
        .select('id')
        .eq('order_id', input.order_id)
        .maybeSingle();

      if (wo) {
        await supabase
          .from('work_orders')
          .update({ process_status: toStatus, updated_by: userEmail })
          .eq('id', wo.id);
      }

      await supabase.from('process_logs').insert({
        order_id: input.order_id,
        work_order_id: wo?.id ?? input.work_order_id,
        from_status: order.process_status,
        to_status: toStatus,
        memo: '생산일보 등록에 따른 공정 변경',
        changed_by: userEmail,
      });
    }
  }

  return data;
}

export async function updateProductionLog(
  id: string,
  input: ProductionLogInput,
  userEmail: string,
): Promise<ProductionLog> {
  const existing = await fetchProductionLogById(id);

  const { data, error } = await supabase
    .from('production_logs')
    .update({ ...input, updated_by: userEmail })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  const orderIds = new Set([existing.order_id, input.order_id]);
  for (const oid of orderIds) {
    await recalculateOrderProduction(oid, userEmail);
  }
  return data;
}

export async function deleteProductionLog(
  id: string,
  userEmail: string,
): Promise<void> {
  const existing = await fetchProductionLogById(id);
  const { error } = await supabase.from('production_logs').delete().eq('id', id);
  if (error) throw error;
  await recalculateOrderProduction(existing.order_id, userEmail);
}
