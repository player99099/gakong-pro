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

/** 품목 목록 구분 — 단품 / Ass'y (items.level 저장) */
export const ITEM_PRODUCT_KINDS = ['단품', "Ass'y"] as const;
export type ItemProductKind = (typeof ITEM_PRODUCT_KINDS)[number];

/** BOM 하위 레벨 (2~5) */
export const BOM_LEVELS = ['2', '3', '4', '5'] as const;
export type BomLevel = (typeof BOM_LEVELS)[number];

/** BOM·유형 분류 (구분과 별도) */
export const ITEM_CATEGORY_TYPES: ItemType[] = ['가공품', '구매품', '사급품'];

export const ORDER_STATUSES: OrderStatus[] = [
  '접수',
  '보류',
  '취소',
  '부분납품',
  '납기지연',
  '출하대기',
  '납품완료',
];

/** 수주 화면 — 사용자가 직접 선택 가능한 상태 */
export const ORDER_MANUAL_STATUSES: OrderStatus[] = ['접수', '취소', '보류'];

export const PROCESS_STATUSES: ProcessStatus[] = [
  '수주접수',
  '도면배포',
  '생산',
  '후처리',
  '출하검사',
  '출하대기',
];

export const DEFAULT_DEFECT_TYPES = [
  '치수불량', '표면불량', '공구파손', '소재불량', '프로그램오류', '셋업오류', '기타',
];

export const DEFAULT_SETUP_TYPES = [
  '공구교체', '프로그램변경', '지그변경', '기타',
];

export type ModuleGroupId =
  | 'dashboard'
  | 'master'
  | 'orders'
  | 'production'
  | 'delivery'
  | 'settings';

export type NavIconName =
  | 'dashboard'
  | 'orders'
  | 'work-orders'
  | 'production'
  | 'production-log'
  | 'delivery'
  | 'customers'
  | 'vendors'
  | 'items'
  | 'settings';

export interface RouteConfig {
  path: string;
  label: string;
  group: ModuleGroupId;
  icon: NavIconName;
}

export const ROUTES: RouteConfig[] = [
  { path: '/', label: '대시보드', group: 'dashboard', icon: 'dashboard' },
  { path: '/orders', label: '수주관리', group: 'orders', icon: 'orders' },
  { path: '/work-orders', label: '작업지시', group: 'production', icon: 'work-orders' },
  { path: '/production', label: '생산관리', group: 'production', icon: 'production' },
  { path: '/production-log', label: '생산일보', group: 'production', icon: 'production-log' },
  { path: '/delivery', label: '납품관리', group: 'delivery', icon: 'delivery' },
  { path: '/customers', label: '고객사', group: 'master', icon: 'customers' },
  { path: '/vendors', label: '매입업체', group: 'master', icon: 'vendors' },
  { path: '/items', label: '품목/BOM', group: 'master', icon: 'items' },
  { path: '/settings', label: '설정', group: 'settings', icon: 'settings' },
];

export const MODULE_GROUPS: {
  id: ModuleGroupId;
  label: string;
  defaultPath: string;
}[] = [
  { id: 'dashboard', label: '대시보드', defaultPath: '/' },
  { id: 'master', label: '기준정보', defaultPath: '/customers' },
  { id: 'orders', label: '수주관리', defaultPath: '/orders' },
  { id: 'production', label: '생산관리', defaultPath: '/work-orders' },
  { id: 'delivery', label: '납품관리', defaultPath: '/delivery' },
  { id: 'settings', label: '설정', defaultPath: '/settings' },
];

export const SIDEBAR_SECTIONS: {
  label: string;
  paths: string[];
}[] = [
  {
    label: '주요 업무',
    paths: ['/', '/orders', '/work-orders', '/production', '/production-log', '/delivery'],
  },
  {
    label: '기준정보',
    paths: ['/customers', '/vendors', '/items'],
  },
  {
    label: '관리',
    paths: ['/settings'],
  },
];

/** @deprecated Use ROUTES — kept for backward compatibility */
export const MENU_ITEMS = ROUTES.map((r) => ({
  path: r.path,
  label: r.label,
  icon: r.icon,
}));

export function getModuleGroupLabel(groupId: ModuleGroupId): string {
  return MODULE_GROUPS.find((g) => g.id === groupId)?.label ?? groupId;
}

export interface GnbGroup {
  id: ModuleGroupId;
  label: string;
  subRoutes: string[];
}

export const GNB_GROUPS: GnbGroup[] = [
  {
    id: 'dashboard',
    label: '대시보드',
    subRoutes: ['/'],
  },
  {
    id: 'orders',
    label: '수주관리',
    subRoutes: ['/orders'],
  },
  {
    id: 'production',
    label: '생산',
    subRoutes: ['/work-orders', '/production', '/production-log'],
  },
  {
    id: 'delivery',
    label: '납품',
    subRoutes: ['/delivery'],
  },
  {
    id: 'master',
    label: '기준정보',
    subRoutes: ['/customers', '/vendors', '/items'],
  },
  {
    id: 'settings',
    label: '설정',
    subRoutes: ['/settings'],
  },
];

export function getRouteByPath(pathname: string): RouteConfig | undefined {
  const normalized = pathname === '' ? '/' : pathname;
  const exact = ROUTES.find((r) => r.path === normalized);
  if (exact) return exact;

  return ROUTES.filter((r) => r.path !== '/')
    .sort((a, b) => b.path.length - a.path.length)
    .find((r) => normalized.startsWith(r.path));
}

export function getModuleGroupByPath(pathname: string): ModuleGroupId {
  return getRouteByPath(pathname)?.group ?? 'dashboard';
}
