/** Excel 출력 엔진 — 셀 매핑 JSON */

export type ExcelCellValueType = 'text' | 'number' | 'date' | 'excel_date_serial';

export interface ExcelCellMapping {
  address: string;
  bindKey: string;
  valueType?: ExcelCellValueType;
}

export interface ExcelSheetMapping {
  sheetName: string;
  orientation?: 'portrait' | 'landscape';
  cells: ExcelCellMapping[];
}

export interface ExcelTemplateMapping {
  version: 1;
  /** 인쇄 시 visible 로 둘 시트명 (나머지 veryHidden) */
  printSheetNames: string[];
  sheets: ExcelSheetMapping[];
}

export type PrintEngineType = 'html' | 'excel';

export const EMPTY_PRINT_LAYOUT = { version: 1 as const, pages: [] };
