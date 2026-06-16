import { formatAppErrorWithContext } from '../lib/formatAppError';
import { orderMatchesSeqFilter } from '../lib/excelSeqParse';
import { supabase } from '../lib/supabase';
import type { Order, OrderSearchParams, OrderStatus } from '../types';
import { syncWorkOrderCustomerForOrder } from './workOrders';

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

  if (
    params?.seqNo?.trim() ||
    (params?.seqNoFrom?.trim() && params?.seqNoTo?.trim())
  ) {
    results = results.filter((o) =>
      orderMatchesSeqFilter(o.seq_no, {
        exact: params.seqNo,
        from: params.seqNoFrom,
        to: params.seqNoTo,
      }),
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
  if (data.customer_id) {
    await syncWorkOrderCustomerForOrder(data.id, data.customer_id, userEmail);
  }
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
  if (input.customer_id) {
    await syncWorkOrderCustomerForOrder(id, input.customer_id, userEmail);
  }
  return data;
}

export async function updateOrderStatus(
  id: string,
  orderStatus: OrderStatus,
  userEmail: string,
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ order_status: orderStatus, updated_by: userEmail })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteOrder(id: string): Promise<void> {
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) throw error;
}

const SEQ_NO_LOOKUP_BATCH = 200;

export async function getOrderBySeqNo(seqNo: string): Promise<Order | null> {
  const trimmed = seqNo.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(customer_name)')
    .eq('seq_no', trimmed)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getExistingSeqNos(
  seqNos: string[],
): Promise<Map<string, Order>> {
  if (seqNos.length === 0) return new Map();

  const unique = [...new Set(seqNos.filter(Boolean))];
  const result = new Map<string, Order>();

  for (let i = 0; i < unique.length; i += SEQ_NO_LOOKUP_BATCH) {
    const batch = unique.slice(i, i + SEQ_NO_LOOKUP_BATCH);
    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(customer_name)')
      .in('seq_no', batch);

    if (error) {
      throw new Error(
        formatAppErrorWithContext(
          `기존 수주 조회 (${i + 1}~${i + batch.length}번째 순번)`,
          error,
        ),
      );
    }

    for (const row of data ?? []) {
      if (row.seq_no) {
        result.set(row.seq_no as string, row as Order);
      }
    }
  }

  return result;
}

export async function upsertOrdersBySeqNo(
  orders: Partial<Order>[],
  userEmail: string,
): Promise<{ success: number; errors: string[] }> {
  const rows = orders.filter((o) => o.seq_no?.trim());
  const errors: string[] = [];

  if (rows.length === 0) {
    return { success: 0, errors: ['저장할 순번 데이터가 없습니다.'] };
  }

  const seqList = rows.map((o) => o.seq_no!.trim());
  const existingMap = await getExistingSeqNos(seqList);

  let success = 0;

  for (const o of rows) {
    const seq = o.seq_no!.trim();
    const payload = sanitizeOrderWritePayload(o, userEmail);

    const existing = existingMap.get(seq);

    if (existing) {
      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', existing.id);

      if (error) {
        errors.push(`순번 ${seq}: ${error.message}`);
      } else {
        success += 1;
        if (payload.customer_id) {
          await syncWorkOrderCustomerForOrder(
            existing.id,
            payload.customer_id as string,
            userEmail,
          );
        }
      }
    } else {
      const { data: inserted, error } = await supabase
        .from('orders')
        .insert({
          ...payload,
          created_by: userEmail,
        })
        .select('id')
        .single();

      if (error) {
        errors.push(`순번 ${seq}: ${error.message}`);
      } else {
        success += 1;
        if (payload.customer_id && inserted?.id) {
          await syncWorkOrderCustomerForOrder(
            inserted.id,
            payload.customer_id as string,
            userEmail,
          );
        }
      }
    }
  }

  return { success, errors };
}

const ORDER_WRITE_KEYS = [
  'seq_no',
  'customer_id',
  'order_no',
  'received_date',
  'due_date',
  'item_id',
  'drawing_no',
  'item_name',
  'material',
  'order_quantity',
  'unit_price',
  'total_amount',
  'surface_treatment',
  'project_name',
  'person_in_charge',
  'progress_place',
  'drawing_file_name',
  'memo1',
  'memo2',
  'order_status',
  'process_status',
  'delivered_quantity',
  'remaining_quantity',
  'produced_quantity',
  'defect_quantity',
  'vendor_unit_price',
  'vendor_amount',
] as const satisfies readonly (keyof Order)[];

function sanitizeOrderWritePayload(
  order: Partial<Order>,
  userEmail: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { updated_by: userEmail };

  for (const key of ORDER_WRITE_KEYS) {
    const value = order[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '' && key !== 'seq_no') {
      continue;
    }
    payload[key] = value;
  }

  payload.seq_no = String(order.seq_no ?? '').trim();
  return payload;
}

export async function linkOrderItemBySeqNo(
  seqNo: string,
  itemId: string,
  userEmail: string,
): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ item_id: itemId, updated_by: userEmail })
    .eq('seq_no', seqNo);

  if (error) throw error;
}
