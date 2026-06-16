import type { Cell, Worksheet } from 'exceljs';
import type {
  PrintElement,
  PrintLayout,
  PrintPage,
  PrintTemplateType,
} from '../../../types/printTemplate';
import type { BindMappingEntry } from './bindMapper';
import { resolveBindKeyForCell } from './bindMapper';
import { cellValueToString, isCheckboxLabel } from './cellText';
import {
  buildSheetGridMetrics,
  cellAddress,
  parsePrintArea,
  rectForRange,
  type PrintAreaRange,
} from './excelUnits';

export interface SheetCandidate {
  name: string;
  orientation: 'portrait' | 'landscape';
  printArea: string | null;
  suggested: boolean;
}

export interface ParseExcelTemplateOptions {
  templateType: PrintTemplateType;
  sheetNames?: string[];
  manualBindOverrides?: Record<string, string>;
}

export interface ParseExcelTemplateResult {
  layout: PrintLayout;
  bindMappings: BindMappingEntry[];
  sheetCandidates: SheetCandidate[];
  sourceFileHint: string;
}

interface MergeMaster {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

function parseCellRef(ref: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!m) return { row: 1, col: 1 };
  let col = 0;
  for (const ch of m[1].toUpperCase()) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { row: Number(m[2]), col };
}

function parseMerges(ws: Worksheet): {
  masters: Map<string, MergeMaster>;
  slaves: Set<string>;
} {
  const masters = new Map<string, MergeMaster>();
  const slaves = new Set<string>();
  const merges: string[] = ws.model?.merges ?? [];

  for (const range of merges) {
    const [a, b] = range.split(':');
    if (!a || !b) continue;
    const start = parseCellRef(a);
    const end = parseCellRef(b);
    const masterKey = cellAddress(start.row, start.col);
    masters.set(masterKey, {
      startRow: start.row,
      startCol: start.col,
      endRow: end.row,
      endCol: end.col,
    });
    for (let r = start.row; r <= end.row; r++) {
      for (let c = start.col; c <= end.col; c++) {
        const key = cellAddress(r, c);
        if (key !== masterKey) slaves.add(key);
      }
    }
  }
  return { masters, slaves };
}

function cellHasBorder(cell: Cell): boolean {
  const b = cell.border;
  if (!b) return false;
  return !!(b.top?.style || b.left?.style || b.bottom?.style || b.right?.style);
}

function cellStyleFromExcel(cell: Cell): PrintElement['style'] {
  const font = cell.font;
  const align = cell.alignment;
  const style: PrintElement['style'] = {};
  if (font?.size) style.fontSize = font.size;
  if (font?.bold) style.fontWeight = 'bold';
  if (align?.horizontal === 'center' || align?.horizontal === 'right') {
    style.textAlign = align.horizontal;
  }
  if (align?.vertical === 'middle' || align?.vertical === 'bottom') {
    style.verticalAlign = align.vertical;
  }
  if (cellHasBorder(cell)) {
    style.borderWidth = 1;
    style.borderStyle = 'solid';
    style.paddingMm = 0.3;
  }
  return style;
}

function getUsedRange(ws: Worksheet): PrintAreaRange {
  const fromPrint = parsePrintArea(ws.pageSetup?.printArea);
  if (fromPrint) return fromPrint;

  const dim = ws.dimensions;
  if (dim) {
    return {
      startRow: dim.top,
      startCol: dim.left,
      endRow: dim.bottom,
      endCol: dim.right,
    };
  }
  return { startRow: 1, startCol: 1, endRow: ws.rowCount, endCol: ws.columnCount };
}

function findNearbyLabel(
  ws: Worksheet,
  row: number,
  col: number,
  range: PrintAreaRange,
): string | undefined {
  const left =
    col > range.startCol ? cellValueToString(ws.getCell(row, col - 1).value) : '';
  if (left.trim()) return left;
  const top =
    row > range.startRow ? cellValueToString(ws.getCell(row - 1, col).value) : '';
  if (top.trim()) return top;
  return undefined;
}

function parseWorksheetToPage(
  ws: Worksheet,
  templateType: PrintTemplateType,
  pageId: string,
  manualOverrides: Record<string, string>,
): { page: PrintPage; bindMappings: BindMappingEntry[] } {
  const orientation =
    ws.pageSetup?.orientation === 'landscape' ? 'landscape' : 'portrait';
  const pageWidthMm = orientation === 'landscape' ? 297 : 210;
  const pageHeightMm = orientation === 'landscape' ? 210 : 297;

  const range = getUsedRange(ws);
  const metrics = buildSheetGridMetrics(
    (c) => ws.getColumn(c).width ?? 0,
    (r) => ws.getRow(r).height ?? 0,
    range,
    pageWidthMm,
    pageHeightMm,
  );

  const { masters, slaves } = parseMerges(ws);
  const elements: PrintElement[] = [];
  const bindMappings: BindMappingEntry[] = [];
  let seq = 0;

  for (let r = range.startRow; r <= range.endRow; r++) {
    for (let c = range.startCol; c <= range.endCol; c++) {
      const addr = cellAddress(r, c);
      if (slaves.has(addr)) continue;

      const merge = masters.get(addr);
      const endRow = merge?.endRow ?? r;
      const endCol = merge?.endCol ?? c;

      const cell = ws.getCell(r, c);
      const text = cellValueToString(cell.value).trim();
      const overrideKey = `${ws.name}!${addr}`;
      const manualBind =
        manualOverrides[overrideKey] ?? manualOverrides[addr.toUpperCase()];

      const bindKey =
        manualBind ||
        resolveBindKeyForCell(
          templateType,
          ws.name,
          addr,
          findNearbyLabel(ws, r, c, range),
        );

      const rect = rectForRange(metrics, r, c, endRow, endCol);
      if (rect.w < 0.2 || rect.h < 0.2) continue;

      const style = cellStyleFromExcel(cell);
      seq += 1;

      if (bindKey) {
        bindMappings.push({
          sheetName: ws.name,
          address: addr,
          bindKey,
          source: manualBind ? 'manual' : 'known',
        });
        elements.push({
          id: `imp_b_${pageId}_${seq}`,
          type: 'bind',
          ...rect,
          bindKey,
          style: { fontSize: 9, ...style },
        });
        continue;
      }

      if (text && isCheckboxLabel(text)) {
        elements.push({
          id: `imp_c_${pageId}_${seq}`,
          type: 'checkbox',
          ...rect,
          text: text.replace(/^[□☐]\s*/, '') || ' ',
          style: { fontSize: 9, ...style },
        });
        continue;
      }

      if (text) {
        elements.push({
          id: `imp_t_${pageId}_${seq}`,
          type: 'text',
          ...rect,
          text,
          style: { fontSize: 9, ...style },
        });
        continue;
      }

      if (cellHasBorder(cell)) {
        elements.push({
          id: `imp_x_${pageId}_${seq}`,
          type: 'box',
          ...rect,
          style: { borderWidth: 1, borderStyle: 'solid' },
        });
      }
    }
  }

  return {
    page: {
      id: pageId,
      name: ws.name,
      orientation,
      widthMm: pageWidthMm,
      heightMm: pageHeightMm,
      elements,
    },
    bindMappings,
  };
}

export function detectSheetCandidates(worksheets: Worksheet[]): SheetCandidate[] {
  return worksheets
    .filter((ws) => ws.state !== 'veryHidden' && ws.name)
    .map((ws) => {
      const orientation =
        ws.pageSetup?.orientation === 'landscape' ? 'landscape' : 'portrait';
      const printArea = ws.pageSetup?.printArea ?? null;
      const name = ws.name;
      const suggested = /수검|공정|출력|traveler/i.test(name) || !!printArea;
      return { name, orientation, printArea, suggested };
    });
}

function pickSheetsForImport(
  worksheets: Worksheet[],
  sheetNames?: string[],
): Worksheet[] {
  if (sheetNames?.length) {
    return sheetNames
      .map((n) => worksheets.find((ws) => ws.name === n))
      .filter((ws): ws is Worksheet => !!ws);
  }

  const visible = worksheets.filter((ws) => ws.state !== 'veryHidden');
  const suggested = visible.filter(
    (ws) => /수검|공정|출력/i.test(ws.name) || ws.pageSetup?.printArea,
  );

  if (suggested.length >= 2) {
    const portrait = suggested.find((ws) => ws.pageSetup?.orientation !== 'landscape');
    const landscape = suggested.find((ws) => ws.pageSetup?.orientation === 'landscape');
    const picked = [portrait, landscape].filter(Boolean) as Worksheet[];
    if (picked.length >= 2) return picked;
    return suggested.slice(0, 2);
  }

  if (suggested.length === 1) return suggested;
  return visible.slice(0, 2);
}

export async function parseExcelTemplateFromBuffer(
  buffer: ArrayBuffer,
  options: ParseExcelTemplateOptions,
): Promise<ParseExcelTemplateResult> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheetCandidates = detectSheetCandidates(workbook.worksheets);
  const sheets = pickSheetsForImport(workbook.worksheets, options.sheetNames);

  if (sheets.length === 0) {
    throw new Error('가져올 시트를 찾을 수 없습니다.');
  }

  const manualOverrides = options.manualBindOverrides ?? {};
  const pages: PrintPage[] = [];
  const bindMappings: BindMappingEntry[] = [];

  sheets.forEach((ws, idx) => {
    const pageId = `import_page_${idx + 1}`;
    const { page, bindMappings: maps } = parseWorksheetToPage(
      ws,
      options.templateType,
      pageId,
      manualOverrides,
    );
    pages.push(page);
    bindMappings.push(...maps);
  });

  return {
    layout: { version: 1, pages },
    bindMappings,
    sheetCandidates,
    sourceFileHint: sheets.map((s) => s.name).join(', '),
  };
}

export async function parseExcelTemplateFromFile(
  file: File,
  options: ParseExcelTemplateOptions,
): Promise<ParseExcelTemplateResult> {
  return parseExcelTemplateFromBuffer(await file.arrayBuffer(), options);
}
