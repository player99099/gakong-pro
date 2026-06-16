/** 화면 표시용 — 천단위 콤마 (ko-KR) */
export function formatNumber(
  value: number | string | null | undefined,
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('ko-KR');
}

/** 입력값 파싱 — 콤마·앞자리 0 제거 */
export function parseFormattedNumber(raw: string): number {
  const s = raw.replace(/,/g, '').trim();
  if (s === '' || s === '-') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
