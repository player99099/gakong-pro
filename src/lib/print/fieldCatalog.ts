import type { PrintTemplateType } from '../../types/printTemplate';

export interface PrintFieldDef {
  key: string;
  label: string;
  sample?: string;
}

const PROCESS_TRAVELER_FIELDS: PrintFieldDef[] = [
  { key: 'order.order_no', label: '수주번호', sample: 'SO-2026-001' },
  { key: 'order.customer_name', label: '고객사', sample: '(주)테스트' },
  { key: 'order.drawing_no', label: '도면번호', sample: 'DWG-001' },
  { key: 'order.item_name', label: '품명', sample: '브래킷' },
  { key: 'order.material', label: '소재', sample: 'AL6061' },
  { key: 'order.surface_treatment', label: '후처리', sample: '아노다이징' },
  { key: 'order.order_quantity', label: '수주수량', sample: '100' },
  { key: 'order.due_date', label: '납기일', sample: '2026-06-30' },
  { key: 'work_order.instruction_memo', label: '작업지시 메모', sample: '긴급' },
  { key: 'work_order.process_status', label: '공정상태', sample: '생산' },
  { key: 'company.company_name', label: '회사명', sample: '가공(주)' },
];

const PRODUCTION_LOG_FIELDS: PrintFieldDef[] = [
  { key: 'production_log.log_date', label: '일보일자', sample: '2026-06-15' },
  { key: 'production_log.machine_name', label: '설비', sample: 'MCT-01' },
  { key: 'production_log.operator_name', label: '작업자', sample: '홍길동' },
  { key: 'order.drawing_no', label: '도면번호', sample: 'DWG-001' },
  { key: 'order.item_name', label: '품명', sample: '브래킷' },
];

const DELIVERY_NOTE_FIELDS: PrintFieldDef[] = [
  { key: 'delivery.delivery_no', label: '납품번호', sample: 'DL-001' },
  { key: 'delivery.delivery_date', label: '납품일', sample: '2026-06-15' },
  { key: 'order.customer_name', label: '고객사', sample: '(주)테스트' },
  { key: 'order.order_no', label: '수주번호', sample: 'SO-2026-001' },
];

const PRODUCTION_SCHEDULE_FIELDS: PrintFieldDef[] = [
  { key: 'schedule.week_label', label: '주차', sample: '2026-W24' },
  { key: 'order.drawing_no', label: '도면번호', sample: 'DWG-001' },
  { key: 'order.due_date', label: '납기일', sample: '2026-06-30' },
];

export const PRINT_TEMPLATE_TYPE_LABELS: Record<PrintTemplateType, string> = {
  process_traveler: '공정이동표',
  production_log: '생산일보',
  delivery_note: '납품일지',
  production_schedule: '생산일정',
};

export const FIELD_CATALOG: Record<PrintTemplateType, PrintFieldDef[]> = {
  process_traveler: PROCESS_TRAVELER_FIELDS,
  production_log: PRODUCTION_LOG_FIELDS,
  delivery_note: DELIVERY_NOTE_FIELDS,
  production_schedule: PRODUCTION_SCHEDULE_FIELDS,
};

export function getFieldLabel(key: string, templateType: PrintTemplateType): string {
  const found = FIELD_CATALOG[templateType].find((f) => f.key === key);
  return found?.label ?? key;
}

export function getSampleContext(templateType: PrintTemplateType): Record<string, Record<string, unknown>> {
  const fields = FIELD_CATALOG[templateType];
  const ctx: Record<string, Record<string, unknown>> = {};
  for (const f of fields) {
    const [ns, prop] = f.key.split('.');
    if (!ctx[ns]) ctx[ns] = {};
    ctx[ns][prop] = f.sample ?? '';
  }
  return ctx;
}
