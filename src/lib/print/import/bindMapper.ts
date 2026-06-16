import type { PrintTemplateType } from '../../../types/printTemplate';
import { FIELD_CATALOG } from '../fieldCatalog';
import { normalizeLabel } from './cellText';
import { getKnownBindKey } from './knownBinds';

const LABEL_ALIASES: Record<string, string[]> = {
  'order.order_no': ['수주번호', '발주번호', 'orderno', 'order_no'],
  'order.customer_name': ['고객사', '거래처', 'customer'],
  'order.drawing_no': ['도면번호', '도면', 'drawing', 'dwg'],
  'order.item_name': ['품명', '품목명', 'item'],
  'order.material': ['재질', '소재', 'material'],
  'order.surface_treatment': ['후처리', '후처리색상', '표면처리', 'surface'],
  'order.order_quantity': ['수주수량', '발주수량', '수량', 'qty', 'quantity'],
  'order.due_date': ['납기', '납기일', 'duedate'],
  'work_order.instruction_memo': ['특이사항', '작업지시', '지시메모', 'memo'],
  'work_order.process_status': ['공정상태', '공정'],
};

export function guessBindKeyFromLabel(
  label: string,
  templateType: PrintTemplateType,
): string | undefined {
  const norm = normalizeLabel(label);
  if (!norm) return undefined;

  const catalog = FIELD_CATALOG[templateType];
  for (const field of catalog) {
    const candidates = [
      normalizeLabel(field.label),
      ...(LABEL_ALIASES[field.key] ?? []).map(normalizeLabel),
    ];
    if (candidates.some((c) => norm.includes(c) || c.includes(norm))) {
      return field.key;
    }
  }
  return undefined;
}

export function resolveBindKeyForCell(
  templateType: PrintTemplateType,
  sheetName: string,
  address: string,
  nearbyLabel?: string,
): string | undefined {
  const known = getKnownBindKey(templateType, sheetName, address);
  if (known) return known;
  if (nearbyLabel) {
    return guessBindKeyFromLabel(nearbyLabel, templateType);
  }
  return undefined;
}

export interface BindMappingEntry {
  sheetName: string;
  address: string;
  bindKey: string;
  source: 'known' | 'label' | 'manual';
}
