import { getReferenceUnitPriceByDrawingNo } from '../services/items';
import {
  normalizeUnitPrice,
  resolveOrderUnitPriceWithBom,
  type UnitPriceChoicePrompt,
} from './orderUnitPrice';

export type DrawingUnitPriceResult = {
  unitPrice: number;
  totalAmount: number;
  cancelled: boolean;
  /** BOM 등록 단가 없음 — 비교·모달 생략 */
  skipped: boolean;
};

/** 도번 BOM 단가와 수주 단가 불일치 시 선택 모달 후 적용 단가 반환 */
export async function resolveDrawingUnitPrice(
  drawingNo: string,
  orderUnitPrice: number,
  orderQty: number,
  promptChoice: UnitPriceChoicePrompt,
): Promise<DrawingUnitPriceResult> {
  const trimmed = drawingNo.trim();
  const order = normalizeUnitPrice(orderUnitPrice);
  const quantity = Number(orderQty) || 0;

  if (!trimmed) {
    return {
      unitPrice: order,
      totalAmount: order * quantity,
      cancelled: false,
      skipped: true,
    };
  }

  const reference = await getReferenceUnitPriceByDrawingNo(trimmed);
  if (reference == null) {
    return {
      unitPrice: order,
      totalAmount: order * quantity,
      cancelled: false,
      skipped: true,
    };
  }

  const resolved = await resolveOrderUnitPriceWithBom(
    orderUnitPrice,
    reference.price,
    orderQty,
    promptChoice,
  );

  if (resolved.cancelled) {
    return {
      unitPrice: order,
      totalAmount: order * quantity,
      cancelled: true,
      skipped: false,
    };
  }

  return {
    unitPrice: resolved.unitPrice,
    totalAmount: resolved.totalAmount,
    cancelled: false,
    skipped: false,
  };
}

type BatchOrderRow = {
  data: {
    drawing_no?: string | null;
    unit_price?: number | null;
    order_quantity?: number | null;
    total_amount?: number | null;
  };
};

/** 일괄 등록(엑셀·순번) — 행별 BOM 단가 불일치 시 순차 모달 */
export async function resolveBatchOrderRowUnitPrices(
  rows: BatchOrderRow[],
  prompt: (
    orderPrice: number,
    bomPrice: number,
    drawingNo: string,
  ) => Promise<number | null>,
  onProgress?: (current: number, total: number, drawingNo: string) => void,
): Promise<boolean> {
  const targets = rows.filter((r) => r.data.drawing_no?.trim());
  let current = 0;

  for (const row of targets) {
    const drawingNo = row.data.drawing_no!.trim();
    current += 1;
    onProgress?.(current, targets.length, drawingNo);

    const resolved = await resolveDrawingUnitPrice(
      drawingNo,
      Number(row.data.unit_price ?? 0),
      Number(row.data.order_quantity ?? 0),
      (orderPrice, bomPrice) => prompt(orderPrice, bomPrice, drawingNo),
    );

    if (resolved.cancelled) return false;

    if (!resolved.skipped) {
      row.data.unit_price = resolved.unitPrice;
      row.data.total_amount = resolved.totalAmount;
    }
  }

  return true;
}
