import {
  applyMappingToRow,
  getMappingColumnMeta,
  getMaxColumnCount,
  isMappingConfigured,
  loadHeaderRowForSheet,
  loadLastSheet,
  loadSavedMapping,
  padExcelRow,
  resolveMappingColIndex,
  type ExcelOrderRow,
} from './excelMapping';
import { loadReferenceExcel } from './excelReferenceCache';
import {
  collectSeqSamples,
  formatSeqColumnRange,
  formatSeqSampleList,
  type ExcelDataRow,
} from './excelCellRef';

export type SeqScopeMode = 'single' | 'range';

export interface ParsedSeqEntry {
  data: ExcelOrderRow;
  excelRow: number;
}

function buildSeqNotFoundError(
  inputValue: string,
  seqColIdx: number,
  seqHeaderLabel: string | undefined,
  headerRowIndex: number,
  dataRows: ExcelDataRow[],
): string {
  const range = formatSeqColumnRange(
    seqColIdx,
    seqHeaderLabel,
    headerRowIndex,
    dataRows.length,
  );
  const samples = formatSeqSampleList(collectSeqSamples(dataRows, seqColIdx));
  return (
    `입력한 순번 「${inputValue}」을(를) 찾을 수 없습니다.\n\n` +
    `[확인 위치]\n${range}\n\n` +
    `[참조 엑셀에 있는 순번 예시]\n${samples}`
  );
}

function buildSeqRangeNotFoundError(
  start: number,
  end: number,
  seqColIdx: number,
  seqHeaderLabel: string | undefined,
  headerRowIndex: number,
  dataRows: ExcelDataRow[],
): string {
  const range = formatSeqColumnRange(
    seqColIdx,
    seqHeaderLabel,
    headerRowIndex,
    dataRows.length,
  );
  const samples = formatSeqSampleList(collectSeqSamples(dataRows, seqColIdx));
  return (
    `순번 ${start}~${end} 구간에 해당하는 행이 없습니다.\n\n` +
    `[확인 위치]\n${range}\n\n` +
    `[참조 엑셀에 있는 순번 예시]\n${samples}\n\n` +
    `구간 숫자 형식(001 vs 1)이 파일과 다른지도 확인해 주세요.`
  );
}

async function loadReferenceDataRows(): Promise<{
  dataRows: ExcelDataRow[];
  seqColIdx: number;
  seqMetaLabel: string | undefined;
  headerRowIndex: number;
}> {
  if (!isMappingConfigured()) {
    throw new Error(
      '엑셀 형식이 설정되지 않았습니다.\n\n「엑셀 형식 설정」에서 샘플 파일·헤더 행·컬럼 매핑을 먼저 완료해 주세요.',
    );
  }

  const buffer = await loadReferenceExcel();
  if (!buffer) {
    throw new Error(
      '저장된 참조 엑셀이 없습니다.\n\n「엑셀 형식 설정」에서 샘플 파일을 저장하거나, 「엑셀 업로드」로 파일을 한 번 선택해 주세요.',
    );
  }

  const mapping = loadSavedMapping();
  const sheet = loadLastSheet();
  const headerRowIndex = loadHeaderRowForSheet(sheet) ?? 1;
  if (!sheet) {
    throw new Error('저장된 시트 정보가 없습니다. 엑셀 형식 설정을 다시 저장해 주세요.');
  }
  if (headerRowIndex < 1) {
    throw new Error(
      '헤더 행 설정이 없습니다.\n\n「엑셀 형식 설정」에서 헤더 행을 지정해 주세요.',
    );
  }

  const seqColIdx = resolveMappingColIndex(mapping.seq_no ?? '');
  if (seqColIdx < 0) {
    throw new Error(
      '순번 열 매핑이 없습니다.\n\n「엑셀 형식 설정」→ 컬럼 매핑에서 순번에 해당하는 엑셀 헤더를 지정해 주세요.',
    );
  }

  const seqMeta = getMappingColumnMeta(mapping, 'seq_no');

  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[sheet];
  if (!ws) {
    throw new Error(`시트 "${sheet}"을 참조 엑셀에서 찾을 수 없습니다.`);
  }

  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
  }) as unknown[][];

  const headerIdx = headerRowIndex - 1;
  if (headerIdx < 0 || headerIdx >= allRows.length) {
    throw new Error(
      `헤더 ${headerRowIndex}행이 시트 범위를 벗어났습니다. 형식 설정을 확인해 주세요.`,
    );
  }

  const columnCount = getMaxColumnCount(allRows);
  const dataRows: ExcelDataRow[] = allRows
    .slice(headerIdx + 1)
    .map((row, index) => ({
      row: padExcelRow(row, columnCount),
      excelRow: headerRowIndex + 1 + index,
    }));

  if (dataRows.length === 0) {
    throw new Error(
      `헤더 ${headerRowIndex}행 아래에 데이터가 없습니다.\n\n「엑셀 형식 설정」에서 헤더 행 번호가 맞는지 확인해 주세요.`,
    );
  }

  return {
    dataRows,
    seqColIdx,
    seqMetaLabel: seqMeta?.label,
    headerRowIndex,
  };
}

/** 참조 엑셀 — 순번 단건/구간 파싱 (파일 업로드 없음) */
export async function parseReferenceExcelBySeq(params: {
  mode: SeqScopeMode;
  singleSeq?: string;
  rangeStart?: string;
  rangeEnd?: string;
}): Promise<ParsedSeqEntry[]> {
  const mapping = loadSavedMapping();
  const { dataRows, seqColIdx, seqMetaLabel, headerRowIndex } =
    await loadReferenceDataRows();

  let targetRows: ExcelDataRow[];

  if (params.mode === 'single') {
    const inputValue = (params.singleSeq ?? '').trim();
    if (!inputValue) throw new Error('순번을 입력해 주세요.');
    targetRows = dataRows.filter(({ row }) => {
      return String(row[seqColIdx] ?? '').trim() === inputValue;
    });
    if (targetRows.length === 0) {
      throw new Error(
        buildSeqNotFoundError(
          inputValue,
          seqColIdx,
          seqMetaLabel,
          headerRowIndex,
          dataRows,
        ),
      );
    }
  } else {
    const start = Number(params.rangeStart);
    const end = Number(params.rangeEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error('구간 순번을 숫자로 입력해 주세요.');
    }
    if (start > end) {
      throw new Error('구간 시작 순번이 끝 순번보다 클 수 없습니다.');
    }
    targetRows = dataRows.filter(({ row }) => {
      const seqValue = Number(String(row[seqColIdx] ?? '').trim());
      return Number.isFinite(seqValue) && seqValue >= start && seqValue <= end;
    });
    if (targetRows.length === 0) {
      throw new Error(
        buildSeqRangeNotFoundError(
          start,
          end,
          seqColIdx,
          seqMetaLabel,
          headerRowIndex,
          dataRows,
        ),
      );
    }
  }

  return targetRows.map(({ row, excelRow }) => {
    const data = applyMappingToRow(row, mapping);
    if (data.seq_no) {
      data.seq_no = String(data.seq_no).trim();
    }
    return { data, excelRow };
  });
}

/** 참조 엑셀 — 순번 1건 (폼 자동채움용) */
export async function lookupSeqInReferenceExcel(
  seqNo: string,
): Promise<ExcelOrderRow | null> {
  const trimmed = seqNo.trim();
  if (!trimmed || !isMappingConfigured()) return null;

  try {
    const entries = await parseReferenceExcelBySeq({
      mode: 'single',
      singleSeq: trimmed,
    });
    return entries[0]?.data ?? null;
  } catch {
    return null;
  }
}

export function orderMatchesSeqFilter(
  seqNo: string | null | undefined,
  filter: { exact?: string; from?: string; to?: string },
): boolean {
  const val = (seqNo ?? '').trim();
  if (!val) return false;

  if (filter.exact?.trim()) {
    return val === filter.exact.trim();
  }

  const from = filter.from?.trim();
  const to = filter.to?.trim();
  if (!from || !to) return true;

  const n = Number(val);
  const start = Number(from);
  const end = Number(to);
  if (Number.isFinite(n) && Number.isFinite(start) && Number.isFinite(end)) {
    return n >= start && n <= end;
  }

  return val >= from && val <= to;
}
