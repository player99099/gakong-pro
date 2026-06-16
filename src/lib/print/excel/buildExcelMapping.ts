import type { PrintTemplateType } from '../../../types/printTemplate';
import type {
  ExcelCellMapping,
  ExcelCellValueType,
  ExcelTemplateMapping,
} from '../../../types/excelTemplate';
import { KNOWN_BIND_RULES } from '../import/knownBinds';

function inferValueType(bindKey: string): ExcelCellValueType {
  if (bindKey === '_meta.today') return 'excel_date_serial';
  if (bindKey.includes('quantity')) return 'number';
  if (bindKey.includes('date') || bindKey.includes('due_date')) return 'date';
  return 'text';
}

export function getKnownCellsForSheet(
  templateType: PrintTemplateType,
  sheetName: string,
): Record<string, string> {
  const rules = KNOWN_BIND_RULES[templateType];
  if (!rules) return {};

  const isLandscapeSheet = /_가로|landscape/i.test(sheetName);
  const result: Record<string, string> = {};

  for (const rule of rules) {
    const ruleIsLandscape = /가로|landscape/i.test(rule.sheetPattern.source);
    if (isLandscapeSheet && !ruleIsLandscape) continue;
    if (!isLandscapeSheet && ruleIsLandscape) continue;
    if (!rule.sheetPattern.test(sheetName)) continue;
    Object.assign(result, rule.cells);
  }
  return result;
}

function sheetOrientation(sheetName: string): 'portrait' | 'landscape' {
  return /_가로|landscape/i.test(sheetName) ? 'landscape' : 'portrait';
}

export function buildExcelTemplateMapping(
  templateType: PrintTemplateType,
  sheetNames: string[],
): ExcelTemplateMapping {
  const sheets = sheetNames.map((sheetName) => {
    const known = getKnownCellsForSheet(templateType, sheetName);
    const cells: ExcelCellMapping[] = Object.entries(known).map(([address, bindKey]) => ({
      address: address.toUpperCase(),
      bindKey,
      valueType: inferValueType(bindKey),
    }));

    if (templateType === 'process_traveler') {
      const isLandscape = /_가로|landscape/i.test(sheetName);
      if (!isLandscape && !cells.some((c) => c.address === 'O4')) {
        cells.push({
          address: 'O4',
          bindKey: '_meta.today',
          valueType: 'excel_date_serial',
        });
      }
      if (isLandscape && !cells.some((c) => c.address === 'A2')) {
        cells.push({
          address: 'A2',
          bindKey: '_meta.today',
          valueType: 'excel_date_serial',
        });
      }
    }

    return {
      sheetName,
      orientation: sheetOrientation(sheetName),
      cells,
    };
  });

  return {
    version: 1,
    printSheetNames: [...sheetNames],
    sheets,
  };
}

export const DEFAULT_PROCESS_TRAVELER_STORAGE = '/templates/process-traveler-default.xlsx';

export const DEFAULT_PROCESS_TRAVELER_SHEETS = [
  '수검표출력양식',
  '수검표출력양식_가로',
] as const;

export function buildDefaultProcessTravelerMapping(): ExcelTemplateMapping {
  return buildExcelTemplateMapping('process_traveler', [...DEFAULT_PROCESS_TRAVELER_SHEETS]);
}
