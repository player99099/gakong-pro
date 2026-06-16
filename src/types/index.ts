export type VendorType = '소재' | '후처리' | '외주가공' | '구매품' | '기타';
export type ItemType = 'ASSY' | '단품' | '구매품' | '가공품' | '사급품';
export type OrderStatus =
  | '접수'
  | '보류'
  | '취소'
  | '부분납품'
  | '납기지연'
  | '출하대기'
  | '납품완료';
export type ProcessStatus =
  | '수주접수'
  | '도면배포'
  | '생산'
  | '후처리'
  | '출하검사'
  | '출하대기';

export interface UserProfile {
  id: string;
  auth_user_id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  customer_name: string;
  manager_name: string | null;
  phone: string | null;
  company_email: string | null;
  personal_email: string | null;
  address: string | null;
  business_type: string | null;
  memo: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  vendor_name: string;
  vendor_type: VendorType | null;
  manager_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  business_type: string | null;
  memo: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  customer_id: string | null;
  drawing_no: string | null;
  item_name: string;
  material: string | null;
  surface_treatment: string | null;
  level: string | null;
  item_type: ItemType | null;
  quantity: number;
  total_quantity: number;
  unit_price: number;
  memo: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: { customer_name: string } | null;
}

export interface BomItem {
  id: string;
  parent_item_id: string;
  no: number;
  level: string | null;
  drawing_no: string | null;
  item_name: string;
  material: string | null;
  surface_treatment: string | null;
  item_type: ItemType | null;
  quantity: number;
  total_quantity: number;
  unit_price: number;
  memo: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_id: string | null;
  order_no: string | null;
  received_date: string | null;
  due_date: string | null;
  item_id: string | null;
  drawing_no: string | null;
  item_name: string | null;
  material: string | null;
  order_quantity: number;
  unit_price: number;
  total_amount: number;
  surface_treatment: string | null;
  project_name: string | null;
  person_in_charge: string | null;
  progress_place: string | null;
  drawing_file_name: string | null;
  memo1: string | null;
  memo2: string | null;
  order_status: OrderStatus;
  process_status: ProcessStatus;
  delivered_quantity: number;
  remaining_quantity: number;
  produced_quantity: number;
  defect_quantity: number;
  seq_no?: string | null;
  vendor_unit_price?: number;
  vendor_amount?: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: { customer_name: string } | null;
}

export interface OrderSearchParams {
  customerName?: string;
  orderNo?: string;
  drawingNo?: string;
  itemName?: string;
  orderStatus?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  seqNo?: string;
  seqNoFrom?: string;
  seqNoTo?: string;
}

export interface DashboardStats {
  totalOrders: number;
  dueSoon: number;
  overdue: number;
  inProduction: number;
  readyToShip: number;
  partialDelivery: number;
  todayDeliveries: number;
  todayProductionLogs: number;
}

export interface Delivery {
  id: string;
  delivery_date: string;
  customer_id: string | null;
  order_no: string;
  memo: string | null;
  total_quantity: number;
  total_amount: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: { customer_name: string } | null;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  order_id: string;
  drawing_no: string | null;
  item_name: string | null;
  delivery_quantity: number;
  unit_price: number;
  amount: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryWithItems extends Delivery {
  delivery_items: DeliveryItem[];
  item_count?: number;
}

export interface DeliveryItemFormData {
  order_id: string;
  drawing_no: string;
  item_name: string;
  order_quantity: number;
  delivered_quantity: number;
  remaining_quantity: number;
  delivery_quantity: number;
  unit_price: number;
  amount: number;
  memo: string;
  checked: boolean;
}

export interface DeliveryFormData {
  delivery_date: string;
  customer_id: string | null;
  customer_name: string;
  order_no: string;
  memo: string;
  items: DeliveryItemFormData[];
}

export interface DeliverySearchParams {
  deliveryDateFrom?: string;
  deliveryDateTo?: string;
  customerName?: string;
  orderNo?: string;
}

export interface DeliveryStats {
  totalCount: number;
  todayCount: number;
  monthAmount: number;
  partialOrderCount: number;
}

export interface WorkOrder {
  id: string;
  order_id: string;
  customer_id: string | null;
  order_no: string | null;
  drawing_no: string | null;
  item_name: string | null;
  order_quantity: number;
  due_date: string | null;
  process_status: ProcessStatus;
  instruction_memo: string | null;
  drawing_file_name: string | null;
  print_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: { customer_name: string } | null;
}

export interface WorkOrderInput {
  order_id: string;
  customer_id: string | null;
  order_no: string | null;
  drawing_no: string | null;
  item_name: string | null;
  order_quantity: number;
  due_date: string | null;
  process_status: ProcessStatus;
  instruction_memo: string | null;
  drawing_file_name: string | null;
}

export interface WorkOrderSearchParams {
  processStatus?: string;
  customerName?: string;
  orderNo?: string;
  drawingNo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export interface WorkOrderStats {
  total: number;
  drawingDeploy: number;
  production: number;
  postProcess: number;
  shipInspect: number;
  readyToShip: number;
}

export interface ProcessLog {
  id: string;
  order_id: string;
  work_order_id: string | null;
  from_status: string | null;
  to_status: string;
  memo: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface ProductionTarget extends Order {
  work_orders?: WorkOrder | WorkOrder[] | null;
}

export interface ProductionSearchParams {
  processStatus?: string;
  orderStatus?: string;
  customerName?: string;
  orderNo?: string;
  drawingNo?: string;
  itemName?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export interface ProductionStats {
  received: number;
  drawingDeploy: number;
  production: number;
  postProcess: number;
  shipInspect: number;
  readyToShip: number;
}

export interface ProductionLog {
  id: string;
  order_id: string;
  work_order_id: string | null;
  work_date: string;
  worker_name: string;
  department: string | null;
  equipment: string | null;
  customer_name: string | null;
  order_no: string | null;
  drawing_no: string | null;
  item_name: string | null;
  processing_minutes: number;
  production_quantity: number;
  defect_quantity: number;
  defect_type: string | null;
  defect_note: string | null;
  setup_minutes: number;
  setup_type: string | null;
  note: string | null;
  special_note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductionLogInput = Omit<
  ProductionLog,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>;

export interface ProductionLogSearchParams {
  workDateFrom?: string;
  workDateTo?: string;
  workerName?: string;
  equipment?: string;
  customerName?: string;
  orderNo?: string;
  drawingNo?: string;
}

export interface ProductionLogStats {
  todayCount: number;
  todayMinutes: number;
  todayProductionQty: number;
  todayDefectQty: number;
}

export interface SettingItem {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: string;
  company_name: string | null;
  business_no: string | null;
  ceo_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  memo: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryOrderGroup {
  order_no: string;
  customer_id: string | null;
  customer_name: string;
  label: string;
  priority: boolean;
}

export interface DashboardLists {
  dueSoonOrders: Order[];
  inProductionOrders: Order[];
  readyToShipOrders: Order[];
  recentProductionLogs: ProductionLog[];
  recentDeliveries: DeliveryWithItems[];
}
