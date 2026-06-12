import type { ItemType, OrderStatus, ProcessStatus, VendorType } from '../types';

export const VENDOR_TYPES: VendorType[] = [
  '소재',
  '후처리',
  '외주가공',
  '구매품',
  '기타',
];

export const ITEM_TYPES: ItemType[] = [
  'ASSY',
  '단품',
  '구매품',
  '가공품',
  '사급품',
];

export const ORDER_STATUSES: OrderStatus[] = [
  '접수',
  '보류',
  '취소',
  '부분납품',
  '납기지연',
  '출하대기',
  '납품완료',
];

export const PROCESS_STATUSES: ProcessStatus[] = [
  '수주접수',
  '도면배포',
  '생산',
  '후처리',
  '출하검사',
  '출하대기',
];

export const MENU_ITEMS = [
  { path: '/', label: '대시보드', icon: '📊' },
  { path: '/orders', label: '수주관리', icon: '📋' },
  { path: '/work-orders', label: '작업지시', icon: '🔧', placeholder: true },
  { path: '/production', label: '생산관리', icon: '⚙️', placeholder: true },
  { path: '/production-log', label: '생산일보', icon: '📝', placeholder: true },
  { path: '/delivery', label: '납품관리', icon: '🚚', placeholder: true },
  { path: '/customers', label: '고객사', icon: '🏢' },
  { path: '/vendors', label: '매입업체', icon: '🏭' },
  { path: '/items', label: '품목/BOM', icon: '📦' },
  { path: '/settings', label: '설정', icon: '⚙️', placeholder: true },
] as const;
