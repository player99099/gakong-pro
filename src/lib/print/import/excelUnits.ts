/** Excel 열宽·행高 → mm (A4 fitToPage 스케일 적용) */

const DEFAULT_COL_WIDTH = 8.43;
const DEFAULT_ROW_HEIGHT_PT = 15;

/** Excel 열 문자 폭 → mm (96dpi 근사) */
export function colWidthToMm(charWidth: number): number {
  const w = charWidth > 0 ? charWidth : DEFAULT_COL_WIDTH;
  return (w * 7) / 96 * 25.4;
}

/** Excel 행 높이(pt) → mm */
export function rowHeightToMm(heightPt: number): number {
  const h = heightPt > 0 ? heightPt : DEFAULT_ROW_HEIGHT_PT;
  return h * 0.352778;
}

export interface CellAddress {
  row: number;
  col: number;
}

export function parseCellAddress(address: string): CellAddress {
  const m = /^([A-Z]+)(\d+)$/i.exec(address.trim());
  if (!m) throw new Error(`Invalid cell address: ${address}`);
  const letters = m[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: Number(m[2]), col };
}

export function colLetter(col: number): string {
  let n = col;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function cellAddress(row: number, col: number): string {
  return `${colLetter(col)}${row}`;
}

export interface PrintAreaRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export function parsePrintArea(area: string | undefined): PrintAreaRange | null {
  if (!area) return null;
  const parts = area.split(':');
  if (parts.length !== 2) return null;
  const start = parseCellAddress(parts[0]);
  const end = parseCellAddress(parts[1]);
  return {
    startRow: start.row,
    startCol: start.col,
    endRow: end.row,
    endCol: end.col,
  };
}

export interface SheetGridMetrics {
  colLeftMm: number[];
  rowTopMm: number[];
  colWidthMm: number[];
  rowHeightMm: number[];
  contentWidthMm: number;
  contentHeightMm: number;
  scale: number;
  pageWidthMm: number;
  pageHeightMm: number;
}

export function buildSheetGridMetrics(
  getColWidth: (col: number) => number,
  getRowHeight: (row: number) => number,
  range: PrintAreaRange,
  pageWidthMm: number,
  pageHeightMm: number,
): SheetGridMetrics {
  const colLeftMm: number[] = [0];
  const colWidthMm: number[] = [0];
  let x = 0;
  for (let c = range.startCol; c <= range.endCol; c++) {
    const w = colWidthToMm(getColWidth(c));
    colWidthMm[c] = w;
    colLeftMm[c] = x;
    x += w;
  }

  const rowTopMm: number[] = [0];
  const rowHeightMm: number[] = [0];
  let y = 0;
  for (let r = range.startRow; r <= range.endRow; r++) {
    const h = rowHeightToMm(getRowHeight(r));
    rowHeightMm[r] = h;
    rowTopMm[r] = y;
    y += h;
  }

  const contentWidthMm = x;
  const contentHeightMm = y;
  const scale = Math.min(pageWidthMm / contentWidthMm, pageHeightMm / contentHeightMm);

  return {
    colLeftMm,
    rowTopMm,
    colWidthMm,
    rowHeightMm,
    contentWidthMm,
    contentHeightMm,
    scale,
    pageWidthMm,
    pageHeightMm,
  };
}

export function rectForRange(
  metrics: SheetGridMetrics,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): { x: number; y: number; w: number; h: number } {
  const x0 = metrics.colLeftMm[startCol] * metrics.scale;
  const y0 = metrics.rowTopMm[startRow] * metrics.scale;
  let w = 0;
  for (let c = startCol; c <= endCol; c++) {
    w += metrics.colWidthMm[c] ?? 0;
  }
  let h = 0;
  for (let r = startRow; r <= endRow; r++) {
    h += metrics.rowHeightMm[r] ?? 0;
  }
  return {
    x: x0,
    y: y0,
    w: w * metrics.scale,
    h: h * metrics.scale,
  };
}
