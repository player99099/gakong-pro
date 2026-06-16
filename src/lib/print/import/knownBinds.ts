import type { PrintTemplateType } from '../../../types/printTemplate';

/** 시트명 패턴 → 알려진 데이터 셀 주소 → bindKey */
export interface KnownBindRule {
  sheetPattern: RegExp;
  cells: Record<string, string>;
}

const PROCESS_TRAVELER_PORTRAIT: Record<string, string> = {
  D2: 'order.order_no',
  O2: 'order.customer_name',
  D3: 'order.drawing_no',
  O3: 'order.item_name',
  D4: 'order.material',
  T4: 'order.due_date',
  O5: 'order.order_quantity',
  O6: 'order.surface_treatment',
};

const PROCESS_TRAVELER_LANDSCAPE: Record<string, string> = {
  B2: 'order.customer_name',
  C2: 'order.drawing_no',
  D2: 'order.material',
  E2: 'order.surface_treatment',
  F2: 'order.order_quantity',
  G2: 'order.due_date',
  H2: 'work_order.instruction_memo',
};

export const KNOWN_BIND_RULES: Partial<Record<PrintTemplateType, KnownBindRule[]>> = {
  process_traveler: [
    {
      sheetPattern: /수검표|출력양식(?!_가로)|portrait/i,
      cells: PROCESS_TRAVELER_PORTRAIT,
    },
    {
      sheetPattern: /가로|landscape/i,
      cells: PROCESS_TRAVELER_LANDSCAPE,
    },
  ],
};

export function getKnownBindKey(
  templateType: PrintTemplateType,
  sheetName: string,
  address: string,
): string | undefined {
  const rules = KNOWN_BIND_RULES[templateType];
  if (!rules) return undefined;

  const isLandscapeSheet = /_가로|landscape/i.test(sheetName);

  for (const rule of rules) {
    const ruleIsLandscape = /가로|landscape/i.test(rule.sheetPattern.source);
    if (isLandscapeSheet && !ruleIsLandscape) continue;
    if (!isLandscapeSheet && ruleIsLandscape) continue;
    if (!rule.sheetPattern.test(sheetName)) continue;
    const key = rule.cells[address.toUpperCase()];
    if (key) return key;
  }
  return undefined;
}
