import type { CellValue } from 'exceljs';

export function cellValueToString(value: CellValue | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text ?? '').join('');
    }
    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }
    if ('result' in value && value.result != null) {
      return cellValueToString(value.result as CellValue);
    }
    if ('formula' in value) {
      return '';
    }
  }
  return String(value);
}

export function normalizeLabel(text: string): string {
  return text.replace(/\s+/g, '').replace(/[.:：]/g, '').toLowerCase();
}

export function isCheckboxLabel(text: string): boolean {
  const t = text.trim();
  return t === '□' || t === '☐' || t.startsWith('□') || t.startsWith('☐');
}
