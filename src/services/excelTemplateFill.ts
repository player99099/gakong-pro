import type { Workbook, Worksheet } from 'exceljs';
import { todayExcelSerial, toExcelSerialDate } from '../lib/excelDate';
import { downloadBlob } from '../lib/downloadBlob';
import { resolveBindValue } from '../lib/print/resolveBindValue';
import { loadPrintTemplateBytes } from './printTemplateStorage';
import type { ExcelCellMapping, ExcelTemplateMapping } from '../types/excelTemplate';
import type { PrintContext, PrintTemplate } from '../types/printTemplate';

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ISO_DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function normalizeClonedCellValue(value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE_STRING_RE.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    if ('result' in record) {
      const nextResult = normalizeClonedCellValue(record.result);
      if (nextResult !== record.result) {
        return { ...record, result: nextResult };
      }
    }
  }
  return value;
}

/** JSON 복제 후 Date → 문자열로 깨진 셀 값 복원 */
function normalizeWorksheetDates(ws: Worksheet): void {
  ws.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const next = normalizeClonedCellValue(cell.value);
      if (next !== cell.value) {
        cell.value = next as typeof cell.value;
      }
    });
  });
}

function setCellText(ws: Worksheet, address: string, value: string | number | null) {
  if (value == null || value === '') return;
  ws.getCell(address).value = value;
}

function setCellDateSerial(
  ws: Worksheet,
  address: string,
  isoDate: string | null,
  fallbackSerial?: number,
) {
  const serial = toExcelSerialDate(isoDate) ?? fallbackSerial;
  if (serial == null) return;
  ws.getCell(address).value = serial;
}

function resolveBindForExcel(bindKey: string, context: PrintContext): string | number | null {
  if (bindKey === '_meta.today') {
    return todayExcelSerial();
  }
  const text = resolveBindValue(bindKey, context);
  if (text === '') return null;
  return text;
}

function applyCellMapping(
  ws: Worksheet,
  mapping: ExcelCellMapping,
  context: PrintContext,
) {
  const raw = resolveBindForExcel(mapping.bindKey, context);
  if (raw == null) return;

  const type = mapping.valueType ?? 'text';
  const address = mapping.address.toUpperCase();

  if (type === 'excel_date_serial') {
    if (mapping.bindKey === '_meta.today') {
      ws.getCell(address).value = todayExcelSerial();
      return;
    }
    if (typeof raw === 'number') {
      ws.getCell(address).value = raw;
      return;
    }
    setCellDateSerial(ws, address, String(raw));
    return;
  }

  if (type === 'date') {
    setCellDateSerial(ws, address, String(raw));
    return;
  }

  if (type === 'number') {
    const n = Number(raw);
    ws.getCell(address).value = Number.isFinite(n) ? n : raw;
    return;
  }

  setCellText(ws, address, raw);
}

function applySheetMapping(
  ws: Worksheet,
  cells: ExcelCellMapping[],
  context: PrintContext,
) {
  for (const cell of cells) {
    applyCellMapping(ws, cell, context);
  }
}

function applyPageSetup(
  ws: Worksheet,
  orientation: 'portrait' | 'landscape',
) {
  ws.pageSetup = {
    ...ws.pageSetup,
    orientation,
    paperSize: ws.pageSetup?.paperSize ?? 9,
    fitToPage: ws.pageSetup?.fitToPage ?? false,
  };
}

function prepareWorkbookForPrint(
  workbook: Workbook,
  mapping: ExcelTemplateMapping,
) {
  const printSet = new Set(mapping.printSheetNames);

  for (const ws of workbook.worksheets) {
    ws.state = printSet.has(ws.name) ? 'visible' : 'veryHidden';
  }

  for (const sheet of mapping.sheets) {
    const ws = workbook.getWorksheet(sheet.sheetName);
    if (!ws) continue;
    applyPageSetup(ws, sheet.orientation ?? 'portrait');
  }
}

function sanitizeFilenamePart(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'unknown';
  return trimmed.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
}

function applyMappingToWorkbook(
  workbook: Workbook,
  mapping: ExcelTemplateMapping,
  context: PrintContext,
) {
  for (const sheetMapping of mapping.sheets) {
    const ws = workbook.getWorksheet(sheetMapping.sheetName);
    if (!ws) {
      throw new Error(`양식에 「${sheetMapping.sheetName}」 시트가 없습니다.`);
    }
    applySheetMapping(ws, sheetMapping.cells, context);
  }
}

/** 같은 워크북 안에서 시트 복제 — 스타일·병합 유지 */
function duplicateWorksheetInWorkbook(
  workbook: Workbook,
  sourceSheet: Worksheet,
  newSheetName: string,
): Worksheet {
  const copy = workbook.addWorksheet(newSheetName);
  copy.model = JSON.parse(JSON.stringify(sourceSheet.model)) as typeof sourceSheet.model;
  copy.name = newSheetName;
  normalizeWorksheetDates(copy);
  return copy;
}

function uniqueSheetName(base: string, used: Set<string>): string {
  let name = base.slice(0, 31);
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  for (let n = 2; n < 100; n++) {
    const suffix = `_${n}`;
    const trimmed = base.slice(0, 31 - suffix.length) + suffix;
    if (!used.has(trimmed)) {
      used.add(trimmed);
      return trimmed;
    }
  }
  throw new Error(`시트 이름을 만들 수 없습니다: ${base}`);
}

function renameWorksheet(
  ws: Worksheet,
  newName: string,
  used: Set<string>,
): void {
  used.delete(ws.name);
  ws.name = newName;
  used.add(newName);
}

async function buildBatchMergedWorkbook(
  templateBuffer: ArrayBuffer,
  mapping: ExcelTemplateMapping,
  contexts: PrintContext[],
): Promise<Workbook> {
  const ExcelJS = await import('exceljs');
  const master = new ExcelJS.Workbook();
  await master.xlsx.load(templateBuffer);

  const sheetOrder = [
    ...new Set(
      mapping.printSheetNames.length
        ? mapping.printSheetNames
        : mapping.sheets.map((s) => s.sheetName),
    ),
  ];

  for (const ws of [...master.worksheets]) {
    if (/^_[Tt]\d+$/.test(ws.name)) {
      master.removeWorksheet(ws.id);
    }
  }

  const usedNames = new Set(master.worksheets.map((ws) => ws.name));
  const templateStash = new Map<string, string>();

  sheetOrder.forEach((sheetName, idx) => {
    const ws = master.getWorksheet(sheetName);
    if (!ws) {
      throw new Error(`양식에 「${sheetName}」 시트가 없습니다.`);
    }
    const stashName = uniqueSheetName(`_T${idx}`, usedNames);
    renameWorksheet(ws, stashName, usedNames);
    ws.state = 'veryHidden';
    templateStash.set(sheetName, stashName);
  });

  for (let i = 0; i < contexts.length; i++) {
    for (const sheetName of sheetOrder) {
      const stashName = templateStash.get(sheetName)!;
      const tpl = master.getWorksheet(stashName);
      if (!tpl) {
        throw new Error(`양식 템플릿 시트 「${sheetName}」를 찾을 수 없습니다.`);
      }

      const baseName = `${String(i + 1).padStart(2, '0')}_${sheetName}`;
      const outName = uniqueSheetName(baseName, usedNames);
      const copy = duplicateWorksheetInWorkbook(master, tpl, outName);

      const sheetMapping = mapping.sheets.find((s) => s.sheetName === sheetName);
      if (sheetMapping) {
        applySheetMapping(copy, sheetMapping.cells, contexts[i]);
        applyPageSetup(copy, sheetMapping.orientation ?? 'portrait');
      }
      copy.state = 'visible';
    }
  }

  for (const ws of master.worksheets) {
    if (/^_[Tt]\d+$/.test(ws.name) || !/^\d{2}_/.test(ws.name)) {
      ws.state = 'veryHidden';
    }
  }

  return master;
}

function assertExcelTemplate(template: PrintTemplate): ExcelTemplateMapping {
  if (!template.storage_path) {
    throw new Error('Excel 양식 파일 경로(storage_path)가 없습니다.');
  }
  if (!template.mapping_json?.sheets?.length) {
    throw new Error('Excel 셀 매핑(mapping_json)이 없습니다.');
  }
  return template.mapping_json;
}

async function buildSingleFilledWorkbook(
  template: PrintTemplate,
  context: PrintContext,
): Promise<Workbook> {
  const mapping = assertExcelTemplate(template);
  const buffer = await loadPrintTemplateBytes(template.storage_path!);
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  applyMappingToWorkbook(workbook, mapping, context);
  prepareWorkbookForPrint(workbook, mapping);
  return workbook;
}

export async function fillExcelTemplateToBlob(
  template: PrintTemplate,
  context: PrintContext,
): Promise<Blob> {
  const workbook = await buildSingleFilledWorkbook(template, context);
  const out = await workbook.xlsx.writeBuffer();
  return new Blob([out], { type: XLSX_MIME });
}

export async function fillExcelBatchToBlob(
  template: PrintTemplate,
  contexts: PrintContext[],
): Promise<Blob> {
  const mapping = assertExcelTemplate(template);
  if (contexts.length === 0) {
    throw new Error('출력할 작업지시가 없습니다.');
  }
  const buffer = await loadPrintTemplateBytes(template.storage_path!);
  const workbook = await buildBatchMergedWorkbook(buffer, mapping, contexts);
  const out = await workbook.xlsx.writeBuffer();
  return new Blob([out], { type: XLSX_MIME });
}

export async function fillExcelTemplateAndDownload(
  template: PrintTemplate,
  context: PrintContext,
  filenameBase: string,
): Promise<void> {
  const blob = await fillExcelTemplateToBlob(template, context);
  downloadBlob(blob, `${filenameBase}.xlsx`);
}

export async function fillExcelBatchAndDownload(
  template: PrintTemplate,
  contexts: PrintContext[],
  filenameBase: string,
): Promise<void> {
  const blob = await fillExcelBatchToBlob(template, contexts);
  downloadBlob(blob, `${filenameBase}.xlsx`);
}

export const EXCEL_PRINT_GUIDE =
  'Excel 파일이 다운로드되었습니다.\n\n' +
  '【인쇄 방법】\n' +
  '1. 다운로드된 파일을 Excel에서 엽니다.\n' +
  '2. 「양면 인쇄」를 선택합니다.\n' +
  '3. 1면(앞): 세로 시트 / 2면(뒤): 가로 시트\n\n' +
  '※ 양식·서식은 업로드한 Excel 원본 그대로 유지됩니다.';

export const EXCEL_BATCH_PRINT_GUIDE =
  'Excel 통합 파일이 다운로드되었습니다.\n\n' +
  '【인쇄 방법】\n' +
  '1. 다운로드된 파일을 Excel에서 엽니다.\n' +
  '2. 「전체 인쇄」 + 「양면 인쇄」를 선택합니다.\n' +
  '3. 시트 순서 = 선택한 작업지시 순서 (각 건: 세로 → 가로)\n\n' +
  '※ 한 번의 인쇄로 모든 공정이동표를 출력할 수 있습니다.';

export function buildTravelerFilename(context: PrintContext): string {
  const order = context.order ?? {};
  const drawing = sanitizeFilenamePart(
    typeof order.drawing_no === 'string' ? order.drawing_no : null,
  );
  const orderNo = sanitizeFilenamePart(
    typeof order.order_no === 'string' ? order.order_no : null,
  );
  return `공정이동표_${drawing}_${orderNo}`;
}

export function buildBatchTravelerFilename(count: number): string {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `공정이동표_일괄_${count}건_${y}${m}${d}`;
}
