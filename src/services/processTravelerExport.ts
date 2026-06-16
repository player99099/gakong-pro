import type { Worksheet } from 'exceljs';
import { todayExcelSerial, toExcelSerialDate } from '../lib/excelDate';
import { downloadBlob } from '../lib/downloadBlob';
import type { ProcessTravelerPrintData } from '../types/processTraveler';
import {
  PROCESS_TRAVELER_PRINT_SHEETS,
  PROCESS_TRAVELER_TEMPLATE_PATH,
} from '../types/processTraveler';

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

/** 수검표출력양식 (세로 · 앞면) */
function fillPortraitSheet(ws: Worksheet, data: ProcessTravelerPrintData) {
  const deploySerial = todayExcelSerial();

  setCellText(ws, 'D2', data.order_no);
  setCellText(ws, 'O2', data.customer_name);
  setCellText(ws, 'D3', data.drawing_no);
  setCellText(ws, 'O3', data.item_name);
  setCellText(ws, 'D4', data.material);
  ws.getCell('O4').value = deploySerial;
  setCellDateSerial(ws, 'T4', data.due_date);
  ws.getCell('O5').value = data.order_quantity;
  setCellText(ws, 'O6', data.surface_treatment);
}

/** 수검표출력양식_가로 (가로 · 뒷면) — 2행 데이터 */
function fillLandscapeSheet(ws: Worksheet, data: ProcessTravelerPrintData) {
  const deploySerial = todayExcelSerial();

  ws.getCell('A2').value = deploySerial;
  setCellText(ws, 'B2', data.customer_name);
  setCellText(ws, 'C2', data.drawing_no);
  setCellText(ws, 'D2', data.material);
  setCellText(ws, 'E2', data.surface_treatment);
  ws.getCell('F2').value = data.order_quantity;
  setCellDateSerial(ws, 'G2', data.due_date);
  setCellText(ws, 'H2', data.instruction_memo);
}

function sanitizeFilenamePart(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'unknown';
  return trimmed.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
}

function prepareWorkbookForPrint(workbook: import('exceljs').Workbook) {
  const printSet = new Set<string>(PROCESS_TRAVELER_PRINT_SHEETS);

  for (const ws of workbook.worksheets) {
    ws.state = printSet.has(ws.name) ? 'visible' : 'veryHidden';
  }

  const portrait = workbook.getWorksheet(PROCESS_TRAVELER_PRINT_SHEETS[0]);
  const landscape = workbook.getWorksheet(PROCESS_TRAVELER_PRINT_SHEETS[1]);

  if (portrait) {
    portrait.pageSetup = {
      ...portrait.pageSetup,
      orientation: 'portrait',
      paperSize: 9,
      fitToPage: portrait.pageSetup.fitToPage ?? false,
    };
  }
  if (landscape) {
    landscape.pageSetup = {
      ...landscape.pageSetup,
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: landscape.pageSetup.fitToPage ?? false,
    };
  }
}

/** 템플릿 유지 + 지정 셀만 채워 xlsx 다운로드 (양면 인쇄용 2시트) */
export async function exportProcessTravelerExcel(
  data: ProcessTravelerPrintData,
): Promise<void> {
  const response = await fetch(PROCESS_TRAVELER_TEMPLATE_PATH);
  if (!response.ok) {
    throw new Error(
      '공정이동표 양식 파일을 불러오지 못했습니다. public/templates/process-traveler-template.xlsx 를 확인해 주세요.',
    );
  }

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());

  const portrait = workbook.getWorksheet(PROCESS_TRAVELER_PRINT_SHEETS[0]);
  const landscape = workbook.getWorksheet(PROCESS_TRAVELER_PRINT_SHEETS[1]);
  if (!portrait || !landscape) {
    throw new Error(
      '양식에 「수검표출력양식」「수검표출력양식_가로」 시트가 없습니다.',
    );
  }

  fillPortraitSheet(portrait, data);
  fillLandscapeSheet(landscape, data);
  prepareWorkbookForPrint(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  const drawing = sanitizeFilenamePart(data.drawing_no);
  const orderNo = sanitizeFilenamePart(data.order_no);
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `공정이동표_${drawing}_${orderNo}.xlsx`,
  );
}

export const PROCESS_TRAVELER_PRINT_GUIDE =
  '다운로드된 Excel 파일을 열어 인쇄해 주세요.\n\n' +
  '【양면 인쇄】\n' +
  '1면(앞): 「수검표출력양식」(세로)\n' +
  '2면(뒤): 「수검표출력양식_가로」(가로)\n\n' +
  '프린터 설정에서 「양면 인쇄」를 선택하세요.\n' +
  '(시트는 출력용 2개만 표시되도록 설정되어 있습니다.)';
