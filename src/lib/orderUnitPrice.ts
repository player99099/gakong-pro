import { formatNumber } from './formatNumber';

export type UnitPriceChoicePrompt = (
  orderPrice: number,
  bomPrice: number,
) => Promise<number | null>;

export function normalizeUnitPrice(value: number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function unitPricesDiffer(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  return normalizeUnitPrice(a) !== normalizeUnitPrice(b);
}

export async function resolveOrderUnitPriceWithBom(
  orderPrice: number,
  bomPrice: number | null,
  qty: number,
  promptChoice?: UnitPriceChoicePrompt,
): Promise<{
  unitPrice: number;
  totalAmount: number;
  cancelled?: boolean;
  infoMessage?: string;
}> {
  const order = normalizeUnitPrice(orderPrice);
  const bom =
    bomPrice != null && normalizeUnitPrice(bomPrice) > 0
      ? normalizeUnitPrice(bomPrice)
      : null;
  const quantity = Number(qty) || 0;

  if (bom == null) {
    return { unitPrice: order, totalAmount: order * quantity };
  }
  if (!unitPricesDiffer(order, bom)) {
    return { unitPrice: order, totalAmount: order * quantity };
  }
  if (promptChoice) {
    const chosen = await promptChoice(order, bom);
    if (chosen == null) {
      return {
        unitPrice: order,
        totalAmount: order * quantity,
        cancelled: true,
      };
    }
    const picked = normalizeUnitPrice(chosen);
    return {
      unitPrice: picked,
      totalAmount: picked * quantity,
    };
  }
  return { unitPrice: order, totalAmount: order * quantity };
}

/** 수주 단가 vs BOM 단가 차이 요약 (모달 표시용) */
export function getUnitPriceDiffSummary(
  orderPrice: number,
  bomPrice: number,
): {
  diff: number;
  diffText: string;
  direction: 'higher' | 'lower' | 'equal';
  percentText: string | null;
} {
  const order = normalizeUnitPrice(orderPrice);
  const bom = normalizeUnitPrice(bomPrice);
  const diff = order - bom;

  if (diff === 0) {
    return { diff: 0, diffText: '0원', direction: 'equal', percentText: null };
  }

  const sign = diff > 0 ? '+' : '-';
  const diffText = `${sign}${formatNumber(Math.abs(diff))}원`;
  const direction = diff > 0 ? 'higher' : 'lower';

  let percentText: string | null = null;
  if (bom > 0) {
    const pct = ((Math.abs(diff) / bom) * 100).toFixed(1);
    percentText =
      direction === 'higher'
        ? `수주(매출) 단가가 BOM 대비 ${pct}% 높음`
        : `수주(매출) 단가가 BOM 대비 ${pct}% 낮음`;
  }

  return { diff, diffText, direction, percentText };
}
