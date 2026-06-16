/** 0-based column index → Excel column letter (A, B, …, AA) */
export function colIndexToLetter(colIndex: number): string {
  let n = colIndex + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function formatExcelColumnRef(
  colIndex: number,
  headerLabel?: string,
): string {
  const letter = colIndexToLetter(colIndex);
  const label = headerLabel?.trim();
  return label ? `「${label}」(${letter}열)` : `${letter}열`;
}

export function formatExcelRowColRef(
  excelRow: number,
  colIndex: number,
  headerLabel?: string,
): string {
  return `엑셀 ${excelRow}행 · ${formatExcelColumnRef(colIndex, headerLabel)}`;
}

export interface ExcelDataRow {
  row: unknown[];
  excelRow: number;
}

export function collectSeqSamples(
  dataRows: ExcelDataRow[],
  seqColIdx: number,
  limit = 8,
): { value: string; excelRow: number }[] {
  const samples: { value: string; excelRow: number }[] = [];
  for (const { row, excelRow } of dataRows) {
    const value = String(row[seqColIdx] ?? '').trim();
    if (!value) continue;
    samples.push({ value, excelRow });
    if (samples.length >= limit) break;
  }
  return samples;
}

export function formatSeqColumnRange(
  seqColIdx: number,
  seqHeaderLabel: string | undefined,
  headerRowIndex: number,
  dataRowCount: number,
): string {
  const colRef = formatExcelColumnRef(seqColIdx, seqHeaderLabel ?? '순번');
  const start = headerRowIndex + 1;
  const end = headerRowIndex + dataRowCount;
  return `${colRef} · ${start}~${end}행`;
}

export function formatSeqSampleList(
  samples: { value: string; excelRow: number }[],
): string {
  if (samples.length === 0) {
    return '(순번 열에 값이 없습니다 — 빈 셀·헤더 행 설정을 확인해 주세요)';
  }
  return samples.map((s) => `${s.value}(${s.excelRow}행)`).join(', ');
}
