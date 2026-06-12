import { supabase } from '../lib/supabase';
import type {
  DeliveryFormData,
  DeliveryItem,
  DeliveryOrderGroup,
  DeliverySearchParams,
  DeliveryStats,
  DeliveryWithItems,
  Order,
  OrderStatus,
} from '../types';

function toNumber(value: unknown): number {
  return Number(value) || 0;
}

function computeOrderStatus(
  orderQuantity: number,
  deliveredQuantity: number,
  currentStatus: string,
): OrderStatus {
  if (currentStatus === '취소' || currentStatus === '보류') {
    return currentStatus as OrderStatus;
  }
  const remaining = orderQuantity - deliveredQuantity;
  if (orderQuantity > 0 && deliveredQuantity >= orderQuantity) {
    return '납품완료';
  }
  if (deliveredQuantity > 0 && remaining > 0) {
    return '부분납품';
  }
  if (deliveredQuantity === 0) {
    return '접수';
  }
  return currentStatus as OrderStatus;
}

async function recalculateOrderFromDeliveries(
  orderId: string,
  userEmail: string,
): Promise<void> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('order_quantity, order_status, process_status')
    .eq('id', orderId)
    .single();

  if (orderError) throw orderError;

  const { data: items, error: itemsError } = await supabase
    .from('delivery_items')
    .select('delivery_quantity')
    .eq('order_id', orderId);

  if (itemsError) throw itemsError;

  const orderQty = toNumber(order.order_quantity);
  const delivered = (items ?? []).reduce(
    (sum, item) => sum + toNumber(item.delivery_quantity),
    0,
  );
  const remaining = orderQty - delivered;
  let orderStatus = computeOrderStatus(
    orderQty,
    delivered,
    order.order_status ?? '접수',
  );

  if (delivered === 0) {
    if (order.process_status === '출하대기') {
      orderStatus = '출하대기';
    } else if (
      order.order_status === '취소' ||
      order.order_status === '보류'
    ) {
      orderStatus = order.order_status as OrderStatus;
    } else {
      orderStatus = '접수';
    }
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      delivered_quantity: delivered,
      remaining_quantity: remaining,
      order_status: orderStatus,
      updated_by: userEmail,
    })
    .eq('id', orderId);

  if (updateError) throw updateError;
}

function validateDeliveryItems(
  items: DeliveryFormData['items'],
  isUpdate: boolean,
  oldItemsByOrderId?: Map<string, number>,
): void {
  const selected = items.filter((i) => i.checked && i.delivery_quantity > 0);
  if (selected.length === 0) {
    throw new Error('납품할 품목을 1개 이상 선택해 주세요.');
  }

  for (const item of selected) {
    if (item.delivery_quantity <= 0) {
      throw new Error('납품수량은 0보다 커야 합니다.');
    }

    const oldQty = isUpdate ? (oldItemsByOrderId?.get(item.order_id) ?? 0) : 0;
    const maxDeliverable = toNumber(item.remaining_quantity) + oldQty;

    if (item.delivery_quantity > maxDeliverable) {
      throw new Error(
        `${item.item_name || item.drawing_no || '품목'}: 납품수량(${item.delivery_quantity})이 잔량(${maxDeliverable})을 초과합니다.`,
      );
    }
  }
}

function buildItemRows(
  deliveryId: string,
  items: DeliveryFormData['items'],
): Omit<DeliveryItem, 'id' | 'created_at' | 'updated_at'>[] {
  return items
    .filter((i) => i.checked && i.delivery_quantity > 0)
    .map((item) => ({
      delivery_id: deliveryId,
      order_id: item.order_id,
      drawing_no: item.drawing_no || null,
      item_name: item.item_name || null,
      delivery_quantity: item.delivery_quantity,
      unit_price: item.unit_price,
      amount: item.delivery_quantity * item.unit_price,
      memo: item.memo || null,
    }));
}

function calcTotals(items: DeliveryFormData['items']) {
  const selected = items.filter((i) => i.checked && i.delivery_quantity > 0);
  return {
    total_quantity: selected.reduce((s, i) => s + i.delivery_quantity, 0),
    total_amount: selected.reduce(
      (s, i) => s + i.delivery_quantity * i.unit_price,
      0,
    ),
  };
}

export async function getDeliveries(
  params?: DeliverySearchParams,
): Promise<DeliveryWithItems[]> {
  let query = supabase
    .from('deliveries')
    .select('*, customers(customer_name), delivery_items(id)')
    .order('delivery_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (params?.deliveryDateFrom) {
    query = query.gte('delivery_date', params.deliveryDateFrom);
  }
  if (params?.deliveryDateTo) {
    query = query.lte('delivery_date', params.deliveryDateTo);
  }
  if (params?.orderNo?.trim()) {
    query = query.ilike('order_no', `%${params.orderNo.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  let results = (data ?? []).map((row) => ({
    ...row,
    delivery_items: row.delivery_items ?? [],
    item_count: (row.delivery_items ?? []).length,
  })) as DeliveryWithItems[];

  if (params?.customerName?.trim()) {
    const term = params.customerName.trim().toLowerCase();
    results = results.filter((d) =>
      d.customers?.customer_name?.toLowerCase().includes(term),
    );
  }

  return results;
}

export async function getDeliveryById(id: string): Promise<DeliveryWithItems> {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, customers(customer_name), delivery_items(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return {
    ...data,
    item_count: (data.delivery_items ?? []).length,
  } as DeliveryWithItems;
}

export async function getDeliveryStats(): Promise<DeliveryStats> {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  const [deliveriesRes, ordersRes] = await Promise.all([
    supabase.from('deliveries').select('delivery_date, total_amount'),
    supabase
      .from('orders')
      .select('id')
      .eq('order_status', '부분납품'),
  ]);

  if (deliveriesRes.error) throw deliveriesRes.error;
  if (ordersRes.error) throw ordersRes.error;

  const deliveries = deliveriesRes.data ?? [];

  return {
    totalCount: deliveries.length,
    todayCount: deliveries.filter((d) => d.delivery_date === today).length,
    monthAmount: deliveries
      .filter((d) => d.delivery_date >= monthStart)
      .reduce((s, d) => s + toNumber(d.total_amount), 0),
    partialOrderCount: (ordersRes.data ?? []).length,
  };
}

export async function getDeliverableOrders(
  includeAll = false,
): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select('*, customers(customer_name)')
    .neq('order_status', '취소')
    .not('order_no', 'is', null)
    .order('order_no');

  if (!includeAll) {
    query = query.or('process_status.eq.출하대기,remaining_quantity.gt.0');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getDeliverableOrderGroups(
  includeAll = false,
): Promise<DeliveryOrderGroup[]> {
  const orders = await getDeliverableOrders(includeAll);
  const map = new Map<string, DeliveryOrderGroup>();

  for (const o of orders) {
    if (!o.order_no) continue;
    const key = `${o.customer_id ?? ''}::${o.order_no}`;
    const customerName = o.customers?.customer_name ?? '-';
    const priority = o.process_status === '출하대기';
    const existing = map.get(key);
    if (!existing || priority) {
      map.set(key, {
        order_no: o.order_no,
        customer_id: o.customer_id,
        customer_name: customerName,
        label: `${customerName} / ${o.order_no}`,
        priority,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return a.label.localeCompare(b.label, 'ko');
  });
}

export async function getOrdersByOrderNo(orderNo: string): Promise<Order[]> {
  const trimmed = orderNo.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(customer_name)')
    .eq('order_no', trimmed)
    .neq('order_status', '취소')
    .order('drawing_no');

  if (error) throw error;
  return data ?? [];
}

export async function createDelivery(
  form: DeliveryFormData,
  userEmail: string,
): Promise<DeliveryWithItems> {
  if (!form.order_no.trim()) {
    throw new Error('발주번호를 선택해 주세요.');
  }
  if (!form.delivery_date) {
    throw new Error('납품일을 입력해 주세요.');
  }

  validateDeliveryItems(form.items, false);

  const totals = calcTotals(form.items);

  const { data: delivery, error: deliveryError } = await supabase
    .from('deliveries')
    .insert({
      delivery_date: form.delivery_date,
      customer_id: form.customer_id,
      order_no: form.order_no.trim(),
      memo: form.memo || null,
      total_quantity: totals.total_quantity,
      total_amount: totals.total_amount,
      created_by: userEmail,
      updated_by: userEmail,
    })
    .select()
    .single();

  if (deliveryError) throw deliveryError;

  const itemRows = buildItemRows(delivery.id, form.items);
  const { error: itemsError } = await supabase
    .from('delivery_items')
    .insert(itemRows);

  if (itemsError) {
    await supabase.from('deliveries').delete().eq('id', delivery.id);
    throw itemsError;
  }

  const orderIds = [...new Set(itemRows.map((i) => i.order_id))];
  for (const orderId of orderIds) {
    await recalculateOrderFromDeliveries(orderId, userEmail);
  }

  return getDeliveryById(delivery.id);
}

export async function updateDelivery(
  id: string,
  form: DeliveryFormData,
  userEmail: string,
): Promise<DeliveryWithItems> {
  if (!form.order_no.trim()) {
    throw new Error('발주번호를 선택해 주세요.');
  }
  if (!form.delivery_date) {
    throw new Error('납품일을 입력해 주세요.');
  }

  const existing = await getDeliveryById(id);
  const oldItemsByOrderId = new Map(
    existing.delivery_items.map((i) => [i.order_id, toNumber(i.delivery_quantity)]),
  );

  validateDeliveryItems(form.items, true, oldItemsByOrderId);

  const totals = calcTotals(form.items);
  const affectedOrderIds = new Set([
    ...existing.delivery_items.map((i) => i.order_id),
    ...form.items.filter((i) => i.checked).map((i) => i.order_id),
  ]);

  const { error: updateError } = await supabase
    .from('deliveries')
    .update({
      delivery_date: form.delivery_date,
      customer_id: form.customer_id,
      order_no: form.order_no.trim(),
      memo: form.memo || null,
      total_quantity: totals.total_quantity,
      total_amount: totals.total_amount,
      updated_by: userEmail,
    })
    .eq('id', id);

  if (updateError) throw updateError;

  const { error: deleteError } = await supabase
    .from('delivery_items')
    .delete()
    .eq('delivery_id', id);

  if (deleteError) throw deleteError;

  const itemRows = buildItemRows(id, form.items);
  if (itemRows.length > 0) {
    const { error: insertError } = await supabase
      .from('delivery_items')
      .insert(itemRows);

    if (insertError) throw insertError;
  }

  for (const orderId of affectedOrderIds) {
    await recalculateOrderFromDeliveries(orderId, userEmail);
  }

  return getDeliveryById(id);
}

export async function deleteDelivery(
  id: string,
  userEmail: string,
): Promise<void> {
  const existing = await getDeliveryById(id);
  const affectedOrderIds = existing.delivery_items.map((i) => i.order_id);

  const { error } = await supabase.from('deliveries').delete().eq('id', id);
  if (error) throw error;

  const uniqueOrderIds = [...new Set(affectedOrderIds)];
  for (const orderId of uniqueOrderIds) {
    await recalculateOrderFromDeliveries(orderId, userEmail);
  }
}
