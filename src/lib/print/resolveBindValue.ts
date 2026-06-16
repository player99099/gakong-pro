import type { PrintContext } from '../../types/printTemplate';

function formatValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  return String(value);
}

/** order.due_date 등 날짜 문자열을 YYYY-MM-DD로 정규화 */
function normalizeDateString(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toISOString().slice(0, 10);
}

export function resolveBindValue(bindKey: string, context: PrintContext): string {
  const [namespace, ...rest] = bindKey.split('.');
  const prop = rest.join('.');
  if (!namespace || !prop) return '';

  const bucket = context[namespace];
  if (!bucket) return '';

  const raw = bucket[prop];
  if (raw == null) return '';

  if (prop.includes('date') || prop === 'due_date' || prop === 'log_date') {
    return normalizeDateString(formatValue(raw));
  }

  return formatValue(raw);
}

/** ProcessTravelerPrintData → PrintContext */
export function buildProcessTravelerContext(data: {
  order_no: string | null;
  customer_name: string | null;
  drawing_no: string | null;
  item_name: string | null;
  material: string | null;
  surface_treatment: string | null;
  order_quantity: number;
  due_date: string | null;
  instruction_memo: string | null;
  process_status?: string | null;
}): PrintContext {
  return {
    order: {
      order_no: data.order_no,
      customer_name: data.customer_name,
      drawing_no: data.drawing_no,
      item_name: data.item_name,
      material: data.material,
      surface_treatment: data.surface_treatment,
      order_quantity: data.order_quantity,
      due_date: data.due_date,
    },
    work_order: {
      instruction_memo: data.instruction_memo,
      process_status: data.process_status ?? '',
    },
    company: {
      company_name: '',
    },
  };
}
