import { formatNumber } from './formatNumber';

/** 저장 전 단가 변경 확인 — 품목·BOM·수주 동기화 */
export function confirmUnitPriceSync(params: {
  drawingNo: string;
  newPrice: number;
  itemPrice: number | null;
  bomPrice: number | null;
}): boolean {
  const newP = Number(params.newPrice) || 0;
  const oldSet = new Set<number>();

  const itemP = params.itemPrice != null ? Number(params.itemPrice) : null;
  const bomP = params.bomPrice != null ? Number(params.bomPrice) : null;

  if (itemP != null && itemP > 0 && itemP !== newP) oldSet.add(itemP);
  if (bomP != null && bomP > 0 && bomP !== newP) oldSet.add(bomP);

  if (oldSet.size === 0) return true;

  const changes = [...oldSet]
    .map((old) => `${formatNumber(old)} → ${formatNumber(newP)}`)
    .join('\n');

  return confirm(
    `도번 ${params.drawingNo}\n\n단가가 변경됩니다.\n${changes}\n\n품목·BOM·수주에 모두 반영합니다.\n변경하시겠습니까?`,
  );
}
