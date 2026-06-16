import type { OrderInput } from '../services/orders';
import type { Order } from '../types';

export function orderToForm(order: Order): OrderInput {
  return {
    seq_no: order.seq_no ?? '',
    customer_id: order.customer_id,
    order_no: order.order_no ?? '',
    received_date: order.received_date ?? '',
    due_date: order.due_date ?? '',
    item_id: order.item_id,
    drawing_no: order.drawing_no ?? '',
    item_name: order.item_name ?? '',
    material: order.material ?? '',
    order_quantity: order.order_quantity,
    unit_price: order.unit_price,
    total_amount: order.total_amount,
    surface_treatment: order.surface_treatment ?? '',
    project_name: order.project_name ?? '',
    person_in_charge: order.person_in_charge ?? '',
    progress_place: order.progress_place ?? '',
    drawing_file_name: order.drawing_file_name ?? '',
    memo1: order.memo1 ?? '',
    memo2: order.memo2 ?? '',
    order_status: order.order_status,
    process_status: order.process_status,
    delivered_quantity: order.delivered_quantity,
    remaining_quantity: order.remaining_quantity,
    produced_quantity: order.produced_quantity ?? 0,
    defect_quantity: order.defect_quantity ?? 0,
    vendor_unit_price: order.vendor_unit_price ?? 0,
    vendor_amount: order.vendor_amount ?? 0,
  };
}

export function patchForm(
  prev: OrderInput,
  field: keyof OrderInput,
  value: string | number | null,
): OrderInput {
  const next = { ...prev, [field]: value };
  if (field === 'order_quantity' || field === 'unit_price') {
    const qty =
      field === 'order_quantity' ? Number(value) : prev.order_quantity;
    const price = field === 'unit_price' ? Number(value) : prev.unit_price;
    next.total_amount = qty * price;
    next.remaining_quantity = qty - (prev.delivered_quantity || 0);
  }
  if (field === 'vendor_unit_price' || field === 'order_quantity') {
    const qty =
      field === 'order_quantity' ? Number(value) : prev.order_quantity;
    const vendor =
      field === 'vendor_unit_price'
        ? Number(value)
        : prev.vendor_unit_price ?? 0;
    next.vendor_amount = qty * vendor;
  }
  return next;
}

export const emptyOrderForm = (): OrderInput => ({
  seq_no: '',
  customer_id: null,
  order_no: '',
  received_date: new Date().toISOString().split('T')[0],
  due_date: '',
  item_id: null,
  drawing_no: '',
  item_name: '',
  material: '',
  order_quantity: 0,
  unit_price: 0,
  total_amount: 0,
  surface_treatment: '',
  project_name: '',
  person_in_charge: '',
  progress_place: '',
  drawing_file_name: '',
  memo1: '',
  memo2: '',
  order_status: '접수',
  process_status: '수주접수',
  delivered_quantity: 0,
  remaining_quantity: 0,
  produced_quantity: 0,
  defect_quantity: 0,
  vendor_unit_price: 0,
  vendor_amount: 0,
});
