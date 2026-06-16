import type { Customer, Order } from '../types';

/** 엑셀 파싱 행 — 고객사명은 매칭 전 임시 필드 */
export type ExcelOrderRow = Partial<Order> & {
  _customer_name?: string;
};

export interface ServiceColumn {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

export const SERVICE_COLUMNS: ServiceColumn[] = [
  { key: 'seq_no', label: '순번', required: true, description: '엑셀 연동 핵심 키. 반드시 매핑 필요' },
  { key: 'received_date', label: '접수일자', required: false, description: '수주 접수 날짜' },
  { key: '_customer_name', label: '고객사', required: false, description: '고객사명 (DB 자동 매칭)' },
  { key: 'order_no', label: '발주번호', required: false, description: '고객사 발주번호' },
  { key: 'drawing_no', label: '도면번호', required: true, description: '품목 식별 기준' },
  { key: 'item_name', label: '품명', required: true, description: '품목명' },
  { key: 'material', label: '재질', required: false, description: '소재 재질' },
  { key: 'surface_treatment', label: '후처리', required: false, description: '표면처리 방법' },
  { key: 'order_quantity', label: '납품수량', required: false, description: '주문 수량' },
  { key: 'due_date', label: '납기일', required: false, description: '납품 기한' },
  { key: 'progress_place', label: '진행처', required: false, description: '외주/협력사명' },
  { key: 'memo1', label: '진행처예정일', required: false, description: '진행처 납기 예정일' },
  { key: 'person_in_charge', label: '고객사담당자', required: false, description: '고객사 담당자명' },
  { key: 'memo2', label: '비고', required: false, description: '비고 메모' },
  { key: 'unit_price', label: '매출처단가', required: false, description: '고객사 청구 단가' },
  { key: 'total_amount', label: '금액', required: false, description: '총 금액' },
  { key: 'vendor_unit_price', label: '협력사단가', required: false, description: '외주 단가' },
  { key: 'vendor_amount', label: '협력사금액', required: false, description: '외주 금액' },
];

/** @deprecated — autoDetectMapping에서 레거시 헤더명 매칭용 */
export const ORDER_EXCEL_COLUMN_MAP: Record<string, string> = {
  순번: 'seq_no',
  접수일자: 'received_date',
  고객사: '_customer_name',
  '발주NO': 'order_no',
  발주번호: 'order_no',
  도면번호: 'drawing_no',
  품명: 'item_name',
  재질: 'material',
  후처리: 'surface_treatment',
  납품수량: 'order_quantity',
  납품일자: 'due_date',
  납기일: 'due_date',
  진행처: 'progress_place',
  진행처예정일: 'memo1',
  고객사담당자: 'person_in_charge',
  비고1: 'memo2',
  비고2: 'memo2',
  매출처단가: 'unit_price',
  금액: 'total_amount',
  협력사단가: 'vendor_unit_price',
  협력사금액: 'vendor_amount',
};

export const REQUIRED_COLUMNS = SERVICE_COLUMNS.filter((c) => c.required).map(
  (c) => c.key,
);

const MAPPING_STORAGE_KEY = 'gakong_excel_column_mapping';
const SHEET_STORAGE_KEY = 'gakong_excel_last_sheet';
const HEADER_ROW_STORAGE_KEY = 'gakong_excel_header_rows';

export interface MappableColumn {
  colIndex: number;
  label: string;
  key: string;
}

export function formatMappingKey(colIndex: number, label: string): string {
  return `${colIndex}::${label}`;
}

export function parseMappingKey(
  key: string,
): { colIndex: number; label: string } | null {
  const sep = key.indexOf('::');
  if (sep === -1) return null;
  const colIndex = Number(key.slice(0, sep));
  if (!Number.isFinite(colIndex)) return null;
  return { colIndex, label: key.slice(sep + 2) };
}

export function getMappingColumnMeta(
  mapping: Record<string, string>,
  serviceKey: string,
): { colIndex: number; label: string } | null {
  const mappingKey = mapping[serviceKey];
  if (!mappingKey) return null;
  return parseMappingKey(mappingKey);
}

export function saveHeaderRowForSheet(sheetName: string, rowNumber1Based: number): void {
  try {
    const raw = localStorage.getItem(HEADER_ROW_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[sheetName] = rowNumber1Based;
    localStorage.setItem(HEADER_ROW_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadHeaderRowForSheet(sheetName: string): number | null {
  try {
    const raw = localStorage.getItem(HEADER_ROW_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, number>;
    const row = map[sheetName];
    return row && row >= 1 ? row : null;
  } catch {
    return null;
  }
}

/** 헤더 행에서 텍스트가 있는 셀만 매핑 대상으로 추출 */
export function extractMappableColumns(headerRow: unknown[]): MappableColumn[] {
  const columns: MappableColumn[] = [];
  headerRow.forEach((cell, colIndex) => {
    const label = String(cell ?? '').trim();
    if (label) {
      columns.push({
        colIndex,
        label,
        key: formatMappingKey(colIndex, label),
      });
    }
  });
  return columns;
}

export function getMaxColumnCount(rows: unknown[][]): number {
  return rows.reduce(
    (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
    0,
  );
}

export function saveLastSheet(sheetName: string): void {
  localStorage.setItem(SHEET_STORAGE_KEY, sheetName);
}

export function loadLastSheet(): string {
  return localStorage.getItem(SHEET_STORAGE_KEY) ?? '';
}

/** 헤더 행 → 컬럼명 배열 (빈 헤더는 열N으로 대체, 컬럼 누락 방지) */
export function extractExcelHeaders(headerRow: unknown[]): string[] {
  return headerRow.map((cell, index) => {
    const trimmed = String(cell ?? '').trim();
    return trimmed || `열${index + 1}`;
  });
}

/** 데이터 행을 헤더 컬럼 수에 맞게 패딩 */
export function padExcelRow(row: unknown[], columnCount: number): unknown[] {
  const padded = [...row];
  while (padded.length < columnCount) {
    padded.push('');
  }
  return padded.slice(0, columnCount);
}

export const EXCEL_COMPARE_FIELDS: (keyof Order)[] = [
  'seq_no',
  'received_date',
  'order_no',
  'drawing_no',
  'item_name',
  'material',
  'surface_treatment',
  'order_quantity',
  'due_date',
  'progress_place',
  'memo1',
  'memo2',
  'person_in_charge',
  'unit_price',
  'total_amount',
  'vendor_unit_price',
  'vendor_amount',
];

const NUMERIC_FIELDS = new Set([
  'order_quantity',
  'unit_price',
  'total_amount',
  'vendor_unit_price',
  'vendor_amount',
]);

const DATE_FIELDS = new Set(['received_date', 'due_date']);

export function loadSavedMapping(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveMapping(mapping: Record<string, string>): void {
  localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping));
}

export function clearMapping(): void {
  localStorage.removeItem(MAPPING_STORAGE_KEY);
}

/** 필수 컬럼 매핑 + 시트 + 헤더 행이 모두 저장되어 있는지 */
export function isMappingConfigured(): boolean {
  const mapping = loadSavedMapping();
  const sheet = loadLastSheet();
  if (!sheet.trim()) return false;

  for (const key of REQUIRED_COLUMNS) {
    const mappingKey = mapping[key];
    if (!mappingKey || resolveMappingColIndex(mappingKey) < 0) {
      return false;
    }
  }

  const headerRow = loadHeaderRowForSheet(sheet);
  return headerRow != null && headerRow >= 1;
}

export function getFormatConfigSummary(): string {
  if (!isMappingConfigured()) return '미설정';

  const sheet = loadLastSheet();
  const headerRow = loadHeaderRowForSheet(sheet);
  const mapping = loadSavedMapping();
  const seqLabel = parseMappingKey(mapping.seq_no ?? '')?.label ?? '순번';
  const drawingLabel =
    parseMappingKey(mapping.drawing_no ?? '')?.label ?? '도면번호';

  return `시트「${sheet}」· 헤더 ${headerRow}행 · ${seqLabel}·${drawingLabel} 등 매핑됨`;
}

export function autoDetectMapping(
  columns: MappableColumn[],
  savedMapping: Record<string, string>,
): Record<string, string> {
  const validKeys = new Set(columns.map((c) => c.key));
  const labelToKeys = new Map<string, string[]>();
  columns.forEach((c) => {
    const list = labelToKeys.get(c.label) ?? [];
    list.push(c.key);
    labelToKeys.set(c.label, list);
  });

  const result: Record<string, string> = {};

  for (const col of SERVICE_COLUMNS) {
    const saved = savedMapping[col.key];
    if (!saved) continue;

    if (validKeys.has(saved)) {
      result[col.key] = saved;
      continue;
    }

    const parsed = parseMappingKey(saved);
    const label = parsed?.label ?? saved;
    const keys = labelToKeys.get(label);
    if (keys?.length) {
      result[col.key] = keys[0];
    }
  }

  for (const col of SERVICE_COLUMNS) {
    if (result[col.key]) continue;

    for (const [excelHeader, key] of Object.entries(ORDER_EXCEL_COLUMN_MAP)) {
      if (key !== col.key) continue;
      const keys = labelToKeys.get(excelHeader);
      if (keys?.length) {
        result[col.key] = keys[0];
        break;
      }
    }
    if (result[col.key]) continue;

    const exactKeys = labelToKeys.get(col.label);
    if (exactKeys?.length) {
      result[col.key] = exactKeys[0];
      continue;
    }

    const partialMatch = columns.find(
      (c) => c.label.includes(col.label) || col.label.includes(c.label),
    );
    if (partialMatch) {
      result[col.key] = partialMatch.key;
    }
  }

  return result;
}

export function resolveCustomerId(
  customerName: string | undefined,
  customers: Customer[],
): string | undefined {
  if (!customerName?.trim()) return undefined;
  const term = customerName.trim().toLowerCase();
  const found = customers.find(
    (c) => c.customer_name.trim().toLowerCase() === term,
  );
  return found?.id;
}

function parseExcelDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(epoch.getTime() + value * 86400000);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  const str = String(value).trim();
  if (!str) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const normalized = str.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return str;
}

function parseCellValue(field: string, value: unknown): unknown {
  if (value == null || value === '') return undefined;
  if (DATE_FIELDS.has(field)) return parseExcelDate(value);
  if (NUMERIC_FIELDS.has(field)) {
    const num = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(num) ? num : undefined;
  }
  return String(value).trim();
}

export function applyMappingToRow(
  row: unknown[],
  mapping: Record<string, string>,
): ExcelOrderRow {
  const result: ExcelOrderRow = {};

  for (const [serviceKey, mappingKey] of Object.entries(mapping)) {
    if (!mappingKey) continue;
    const parsed = parseMappingKey(mappingKey);
    if (!parsed) continue;
    const parsedValue = parseCellValue(serviceKey, row[parsed.colIndex]);
    if (parsedValue === undefined) continue;
    (result as Record<string, unknown>)[serviceKey] = parsedValue;
  }

  if (result.seq_no != null) {
    result.seq_no = String(result.seq_no).trim();
  }

  return result;
}

export function resolveMappingColIndex(mappingKey: string): number {
  const parsed = parseMappingKey(mappingKey);
  return parsed?.colIndex ?? -1;
}

function normalizeCompareValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return String(value);
  return String(value).trim();
}

export function detectChangedFields(
  row: ExcelOrderRow,
  existing: Order,
): string[] {
  const changed: string[] = [];

  for (const field of EXCEL_COMPARE_FIELDS) {
    const newVal = normalizeCompareValue(row[field]);
    const oldVal = normalizeCompareValue(existing[field]);
    if (newVal !== oldVal) {
      changed.push(field);
    }
  }

  return changed;
}

export function toOrderUpsertPayload(
  row: ExcelOrderRow,
  customers: Customer[],
  userEmail: string,
): Partial<Order> {
  const customerId = resolveCustomerId(row._customer_name, customers);
  const { _customer_name: _, ...rest } = row;

  return {
    ...rest,
    customer_id: customerId ?? null,
    order_status: row.order_status ?? '접수',
    process_status: row.process_status ?? '수주접수',
    remaining_quantity:
      row.remaining_quantity ??
      Number(row.order_quantity ?? 0) - Number(row.delivered_quantity ?? 0),
    delivered_quantity: row.delivered_quantity ?? 0,
    produced_quantity: row.produced_quantity ?? 0,
    defect_quantity: row.defect_quantity ?? 0,
    unit_price: row.unit_price ?? 0,
    total_amount: row.total_amount ?? 0,
    vendor_unit_price: row.vendor_unit_price ?? 0,
    vendor_amount: row.vendor_amount ?? 0,
    created_by: userEmail,
    updated_by: userEmail,
  };
}

/** 참조 엑셀 행 → 수주 입력 폼 필드 */
export function excelRowToOrderFields(
  row: ExcelOrderRow,
  customers: Customer[],
): { fields: Partial<ExcelOrderRow>; customerName: string } {
  const customerName = row._customer_name?.trim() ?? '';
  const qty = Number(row.order_quantity ?? 0);
  const price = Number(row.unit_price ?? 0);
  const delivered = Number(row.delivered_quantity ?? 0);

  return {
    customerName,
    fields: {
      seq_no: row.seq_no ?? '',
      customer_id: resolveCustomerId(row._customer_name, customers) ?? null,
      order_no: row.order_no ?? '',
      received_date: row.received_date ?? '',
      due_date: row.due_date ?? '',
      drawing_no: row.drawing_no ?? '',
      item_name: row.item_name ?? '',
      material: row.material ?? '',
      order_quantity: qty,
      unit_price: price,
      total_amount: row.total_amount ?? qty * price,
      surface_treatment: row.surface_treatment ?? '',
      project_name: row.project_name ?? '',
      person_in_charge: row.person_in_charge ?? '',
      progress_place: row.progress_place ?? '',
      memo1: row.memo1 ?? '',
      memo2: row.memo2 ?? '',
      order_status: row.order_status ?? '접수',
      process_status: row.process_status ?? '수주접수',
      delivered_quantity: delivered,
      remaining_quantity: row.remaining_quantity ?? qty - delivered,
      vendor_unit_price: row.vendor_unit_price ?? 0,
      vendor_amount: row.vendor_amount ?? 0,
    },
  };
}
