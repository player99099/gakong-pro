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
}

export interface DashboardStats {
  totalOrders: number;
  dueSoon: number;
  overdue: number;
  readyToShip: number;
  partialDelivery: number;
}
