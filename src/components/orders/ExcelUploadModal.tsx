import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnitPriceChoice } from '../../hooks/useUnitPriceChoice';
import {
  applyMappingToRow,
  detectChangedFields,
  getFormatConfigSummary,
  getMappingColumnMeta,
  getMaxColumnCount,
  isMappingConfigured,
  loadHeaderRowForSheet,
  loadLastSheet,
  loadSavedMapping,
  padExcelRow,
  REQUIRED_COLUMNS,
  resolveCustomerId,
  resolveMappingColIndex,
  saveLastSheet,
  SERVICE_COLUMNS,
  toOrderUpsertPayload,
  type ExcelOrderRow,
} from '../../lib/excelMapping';
import {
  collectSeqSamples,
  formatExcelRowColRef,
  formatSeqColumnRange,
  formatSeqSampleList,
  type ExcelDataRow,
} from '../../lib/excelCellRef';
import { resolveUserUploadError } from '../../lib/formatAppError';
import { formatNumber } from '../../lib/formatNumber';
import { saveReferenceExcel } from '../../lib/excelReferenceCache';
import { resolveBatchOrderRowUnitPrices } from '../../lib/resolveDrawingUnitPrice';
import { createDefaultBomIfEmpty } from '../../services/bomService';
import { findOrCreateCustomer } from '../../services/customers';
import {
  syncBomFieldsByDrawingNo,
  upsertItemFromOrder,
} from '../../services/items';
import {
  getExistingSeqNos,
  linkOrderItemBySeqNo,
  upsertOrdersBySeqNo,
} from '../../services/orders';
import type { Customer, Order } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';

type UploadMode = 'single' | 'range' | 'all';
type UploadStep = 'upload' | 'preview';
type RowStatus = 'new' | 'duplicate_same' | 'duplicate_changed' | 'error';

interface PreviewRow {
  status: RowStatus;
  data: ExcelOrderRow;
  excelRow: number;
  existing?: Order;
  changedFields?: string[];
  errorMsg?: string;
  checked: boolean;
}

interface ParsedEntry {
  data: ExcelOrderRow;
  excelRow: number;
}

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onOpenFormatSetup: () => void;
  customers: Customer[];
}

const ROW_STATUS_STYLE: Record<RowStatus, CSSProperties> = {
  new: { background: '#f0faf5' },
  duplicate_same: { background: '#fffbea' },
  duplicate_changed: { background: '#fff4e6' },
  error: { background: '#fef2f2' },
};

const STATUS_LABEL: Record<RowStatus, string> = {
  new: '신규',
  duplicate_same: '중복(동일)',
  duplicate_changed: '중복(변경)',
  error: '오류',
};

const LARGE_UPLOAD_THRESHOLD = 1000;

function StepIndicator({ step }: { step: UploadStep }) {
  return (
    <div className="modal-steps">
      <span className={step === 'upload' ? 'step active' : 'step done'}>
        1. 파일 · 업로드
      </span>
      <span className="step-arrow">›</span>
      <span className={step === 'preview' ? 'step active' : 'step'}>
        2. 미리보기 · 저장
      </span>
    </div>
  );
}

function formatParseSummary(
  counts: {
    total: number;
    new: number;
    duplicate_same: number;
    duplicate_changed: number;
    error: number;
  },
  rowErrorHint = '',
): string {
  let msg =
    `파싱 완료: 총 ${counts.total}건\n` +
    `· 신규 ${counts.new}건\n` +
    `· 중복(동일) ${counts.duplicate_same}건\n` +
    `· 중복(변경) ${counts.duplicate_changed}건\n` +
    `· 오류 ${counts.error}건`;

  if (counts.error > 0) {
    msg +=
      '\n\n⚠ 오류 행은 저장되지 않습니다. 아래 표에서 사유를 확인하고' +
      ' 엑셀·형식 설정을 수정해 주세요.';
    if (rowErrorHint) msg += rowErrorHint;
  } else {
    msg += '\n\n저장할 행을 선택한 뒤 「저장」을 눌러 주세요.';
  }

  return msg;
}

function summarizeRowErrors(rows: PreviewRow[], limit = 5): string {
  const errors = rows.filter((r) => r.status === 'error');
  if (errors.length === 0) return '';

  const lines = errors.slice(0, limit).map((r) => {
    const rowLabel = r.excelRow > 0 ? `${r.excelRow}행` : '(행 미상)';
    return `  · ${rowLabel}: ${r.errorMsg ?? '오류'}`;
  });

  let msg = `\n\n[행별 오류 예시 — 엑셀에서 해당 행·열 확인]\n${lines.join('\n')}`;
  if (errors.length > limit) {
    msg += `\n  … 외 ${errors.length - limit}건 (미리보기 표 참고)`;
  }
  return msg;
}

function buildMissingFieldsError(
  excelRow: number,
  missingKeys: string[],
  mapping: Record<string, string>,
): string {
  const locations = missingKeys.map((key) => {
    const serviceLabel =
      SERVICE_COLUMNS.find((c) => c.key === key)?.label ?? key;
    const meta = getMappingColumnMeta(mapping, key);
    if (meta) {
      return formatExcelRowColRef(excelRow, meta.colIndex, meta.label || serviceLabel);
    }
    return `엑셀 ${excelRow}행 · ${serviceLabel}`;
  });
  return `필수값 누락 — ${locations.join(', ')} 셀을 확인해 주세요`;
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
    `[파일에 있는 순번 예시]\n${samples}`
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
    `[파일에 있는 순번 예시]\n${samples}\n\n` +
    `구간 숫자 형식(001 vs 1)이 파일과 다른지도 확인해 주세요.`
  );
}

function showUploadFailure(
  err: unknown,
  setParseError: (v: string) => void,
  setParseErrorDetail: (v: string) => void,
  alertTitle?: string,
): void {
  const resolved = resolveUserUploadError(err);
  setParseError(resolved.userMessage);
  setParseErrorDetail(resolved.technicalDetail ?? '');
  const title =
    alertTitle ??
    (resolved.kind === 'system' ? '시스템 오류' : '파싱 실패');
  alert(`${title}\n\n${resolved.userMessage}`);
}

export function ExcelUploadModal({
  isOpen,
  onClose,
  customers,
  onComplete,
  onOpenFormatSetup,
}: ExcelUploadModalProps) {
  const { userEmail, session, loading: authLoading, devAuthError } = useAuth();
  const unitPriceChoice = useUnitPriceChoice();
  const [formatReady, setFormatReady] = useState(isMappingConfigured);
  const [mode, setMode] = useState<UploadMode>('all');
  const [singleSeq, setSingleSeq] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [step, setStep] = useState<UploadStep>('upload');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgressMessage, setSaveProgressMessage] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [parseError, setParseError] = useState('');
  const [parseErrorDetail, setParseErrorDetail] = useState('');
  const [parseSuccessMsg, setParseSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormatReady(isMappingConfigured());
    }
  }, [isOpen]);

  const summary = useMemo(() => {
    const total = previewRows.length;
    const counts = {
      new: 0,
      duplicate_same: 0,
      duplicate_changed: 0,
      error: 0,
    };
    previewRows.forEach((r) => {
      counts[r.status] += 1;
    });
    return { total, ...counts };
  }, [previewRows]);

  const resetModal = () => {
    setMode('all');
    setSingleSeq('');
    setRangeStart('');
    setRangeEnd('');
    setFile(null);
    setFileBuffer(null);
    setSheetNames([]);
    setSelectedSheet('');
    setPreviewRows([]);
    setStep('upload');
    setParseError('');
    setParseErrorDetail('');
    setParseSuccessMsg('');
    setSaveProgressMessage('');
    setSaveSuccessMsg('');
    setSaveError('');
    setFormatReady(isMappingConfigured());
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const refreshFormatStatus = () => {
    setFormatReady(isMappingConfigured());
  };

  async function classifyRows(
    entries: ParsedEntry[],
    mapping: Record<string, string>,
  ): Promise<PreviewRow[]> {
    const seqNos = entries
      .map((e) => e.data.seq_no)
      .filter(Boolean) as string[];

    const existingMap = await getExistingSeqNos(seqNos);

    return entries.map(({ data, excelRow }) => {
      const missing = REQUIRED_COLUMNS.filter(
        (col) => !data[col as keyof ExcelOrderRow],
      );
      if (missing.length > 0) {
        return {
          status: 'error' as const,
          data,
          excelRow,
          errorMsg: buildMissingFieldsError(excelRow, missing, mapping),
          checked: false,
        };
      }

      const existing = existingMap.get(data.seq_no!);

      if (!existing) {
        return { status: 'new' as const, data, excelRow, checked: true };
      }

      const changedFields = detectChangedFields(data, existing);

      if (changedFields.length === 0) {
        return {
          status: 'duplicate_same' as const,
          data,
          excelRow,
          existing,
          changedFields: [],
          checked: false,
        };
      }

      return {
        status: 'duplicate_changed' as const,
        data,
        excelRow,
        existing,
        changedFields,
        checked: false,
      };
    });
  }

  async function handleFileChange(selectedFile: File) {
    setFile(selectedFile);
    setFileBuffer(null);
    setSheetNames([]);
    setSelectedSheet('');
    setParseError('');
    setParseErrorDetail('');
    setParseSuccessMsg('');

    try {
      const XLSX = await import('xlsx');
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { bookSheets: true, type: 'array' });
      setFileBuffer(buffer);
      setSheetNames(wb.SheetNames);

      try {
        await saveReferenceExcel(buffer);
      } catch {
        /* 참조 엑셀 저장 실패 — 업로드는 계속 */
      }

      const savedSheet = loadLastSheet();
      if (savedSheet && wb.SheetNames.includes(savedSheet)) {
        setSelectedSheet(savedSheet);
      } else if (wb.SheetNames.length === 1) {
        setSelectedSheet(wb.SheetNames[0]);
      } else if (savedSheet) {
        setParseError(
          `저장된 시트「${savedSheet}」이 이 파일에 없습니다. 시트를 선택해 주세요.`,
        );
      }
    } catch (err) {
      showUploadFailure(err, setParseError, setParseErrorDetail, '파일 읽기 실패');
    }
  }

  async function parseAndClassifyRows(): Promise<PreviewRow[]> {
    if (!fileBuffer) {
      throw new Error('업로드 파일이 없습니다.');
    }

    const mapping = loadSavedMapping();
    const sheet = selectedSheet || loadLastSheet();
    if (!sheet) {
      throw new Error('시트를 선택해 주세요.');
    }

    const headerRowIndex = loadHeaderRowForSheet(sheet) ?? 1;
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
    const wb = XLSX.read(fileBuffer, { type: 'array' });
    const ws = wb.Sheets[sheet];
    if (!ws) {
      throw new Error(`시트 "${sheet}"을 찾을 수 없습니다.`);
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

    let targetRows: ExcelDataRow[];
    if (mode === 'single') {
      const inputValue = singleSeq.trim();
      if (!inputValue) throw new Error('단건 업로드 순번을 입력해 주세요.');
      targetRows = dataRows.filter(({ row }) => {
        return String(row[seqColIdx] ?? '').trim() === inputValue;
      });
      if (targetRows.length === 0) {
        throw new Error(
          buildSeqNotFoundError(
            inputValue,
            seqColIdx,
            seqMeta?.label,
            headerRowIndex,
            dataRows,
          ),
        );
      }
    } else if (mode === 'range') {
      const start = Number(rangeStart);
      const end = Number(rangeEnd);
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
            seqMeta?.label,
            headerRowIndex,
            dataRows,
          ),
        );
      }
    } else {
      const dataRowCount = dataRows.length;
      if (dataRowCount > LARGE_UPLOAD_THRESHOLD) {
        const ok = window.confirm(
          `전체 ${dataRowCount}건을 불러옵니다.\n대용량 파일은 처리 시간이 걸릴 수 있습니다. 계속하시겠습니까?`,
        );
        if (!ok) {
          throw new Error('대용량 업로드를 취소했습니다.');
        }
      }
      targetRows = dataRows;
    }

    const entries: ParsedEntry[] = targetRows.map(({ row, excelRow }) => ({
      data: applyMappingToRow(row, mapping),
      excelRow,
    }));

    return classifyRows(entries, mapping);
  }

  const handleParse = async () => {
    refreshFormatStatus();

    if (!isMappingConfigured()) {
      setParseError(
        '엑셀 형식이 설정되지 않았습니다.\n\n「엑셀 형식 설정」에서 샘플 파일·헤더 행·컬럼 매핑을 먼저 완료해 주세요.',
      );
      return;
    }

    if (!file || !fileBuffer) {
      alert('업로드할 엑셀 파일을 선택해 주세요.');
      return;
    }

    const sheet = selectedSheet || loadLastSheet();
    if (!sheet) {
      alert('시트를 선택해 주세요.');
      return;
    }

    if (sheetNames.length > 1 && !selectedSheet) {
      alert('시트를 선택해 주세요.');
      return;
    }

    saveLastSheet(sheet);

    setParsing(true);
    setParseError('');
    setParseErrorDetail('');
    setParseSuccessMsg('');
    try {
      const classified = await parseAndClassifyRows();
      setPreviewRows(classified);

      const counts = {
        total: classified.length,
        new: 0,
        duplicate_same: 0,
        duplicate_changed: 0,
        error: 0,
      };
      classified.forEach((r) => {
        counts[r.status] += 1;
      });

      if (counts.total === 0) {
        const msg =
          '파싱 결과가 0건입니다. 파일·시트·업로드 모드·형식 설정을 확인해 주세요.';
        setParseError(msg);
        alert(msg);
        return;
      }

      const successMsg = formatParseSummary(
        counts,
        counts.error > 0 ? summarizeRowErrors(classified) : '',
      );
      setParseSuccessMsg(successMsg);
      if (
        counts.error > 0 &&
        counts.new + counts.duplicate_same + counts.duplicate_changed === 0
      ) {
        setParseError(
          `파싱된 ${counts.total}건 모두 오류입니다. 행별 사유를 확인하고 엑셀·형식 설정을 수정해 주세요.`,
        );
      }
      alert(successMsg);
      setStep('preview');
      refreshFormatStatus();
    } catch (err) {
      showUploadFailure(err, setParseError, setParseErrorDetail);
    } finally {
      setParsing(false);
    }
  };

  const toggleRow = (index: number) => {
    setPreviewRows((prev) =>
      prev.map((row, i) => {
        if (i !== index || row.status === 'error') return row;
        return { ...row, checked: !row.checked };
      }),
    );
  };

  const selectAll = (checked: boolean) => {
    setPreviewRows((prev) =>
      prev.map((row) =>
        row.status === 'error' ? row : { ...row, checked },
      ),
    );
  };

  const selectNewOnly = () => {
    setPreviewRows((prev) =>
      prev.map((row) => ({
        ...row,
        checked: row.status === 'new',
      })),
    );
  };

  const handleSave = async () => {
    setSaveError('');

    if (authLoading) {
      setSaveError('로그인 확인 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    if (!session) {
      setSaveError(
        devAuthError ??
          '로그인 세션이 없어 저장할 수 없습니다.\n페이지를 새로고침(F5)하거나 로그인 후 다시 시도해 주세요.',
      );
      return;
    }

    if (!userEmail) {
      setSaveError('로그인 정보가 없습니다.');
      return;
    }

    const checkedRows = previewRows.filter(
      (r) => r.checked && r.status !== 'error',
    );

    if (checkedRows.length === 0) {
      setSaveError('저장할 행을 선택해 주세요.');
      return;
    }

    const duplicates = checkedRows.filter(
      (r) =>
        r.status === 'duplicate_same' || r.status === 'duplicate_changed',
    );

    if (duplicates.length > 0) {
      const confirmed = window.confirm(
        `중복 항목 ${duplicates.length}건이 포함되어 있습니다.\n기존 데이터를 덮어씁니다. 계속하시겠습니까?`,
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setSaveSuccessMsg('');
    setSaveProgressMessage(`단가 확인 중... (${checkedRows.length}건)`);

    try {
      const priceOk = await resolveBatchOrderRowUnitPrices(
        checkedRows,
        (orderPrice, bomPrice, drawingNo) =>
          unitPriceChoice.prompt(orderPrice, bomPrice, drawingNo, 'bom'),
        (current, total, drawingNo) => {
          setSaveProgressMessage(
            `BOM 단가 확인 (${current}/${total}) · 도번 ${drawingNo}`,
          );
        },
      );
      if (!priceOk) {
        setSaveProgressMessage('');
        setSaving(false);
        return;
      }

      setSaveProgressMessage(`수주 ${checkedRows.length}건 저장 중...`);

      const customerIdByName = new Map<string, string>();
      for (const row of checkedRows) {
        const name = row.data._customer_name?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (customerIdByName.has(key)) continue;
        const customer = await findOrCreateCustomer(name, userEmail);
        customerIdByName.set(key, customer.id);
      }

      const orderData = checkedRows.map((r) => {
        const payload = toOrderUpsertPayload(r.data, customers, userEmail);
        const name = r.data._customer_name?.trim();
        if (name) {
          const id = customerIdByName.get(name.toLowerCase());
          if (id) payload.customer_id = id;
        }
        return payload;
      });

      const result = await upsertOrdersBySeqNo(orderData, userEmail);
      if (result.errors.length > 0) {
        const resolved = resolveUserUploadError(new Error(result.errors.join('\n')));
        setSaveError(resolved.userMessage);
        alert(resolved.userMessage);
        return;
      }

      if (result.success === 0) {
        const msg = '저장된 수주가 없습니다. 선택 행과 순번을 확인해 주세요.';
        setSaveError(msg);
        alert(msg);
        return;
      }

      const linkRows = checkedRows.filter(
        (r) => r.data.drawing_no && r.data.item_name && r.data.seq_no,
      );

      for (let i = 0; i < linkRows.length; i++) {
        const row = linkRows[i];
        setSaveProgressMessage(
          `품목·BOM 연동 중... (${i + 1}/${linkRows.length})`,
        );

        const name = row.data._customer_name?.trim();
        const customerId = name
          ? customerIdByName.get(name.toLowerCase())
          : undefined;

        const itemId = await upsertItemFromOrder({
          drawing_no: row.data.drawing_no!,
          item_name: row.data.item_name!,
          material: row.data.material ?? undefined,
          surface_treatment: row.data.surface_treatment ?? undefined,
          customer_id: customerId,
          unit_price: row.data.unit_price,
          userEmail,
          keepMasterUnitPrice: true,
        });

        await linkOrderItemBySeqNo(row.data.seq_no!, itemId, userEmail);

        await syncBomFieldsByDrawingNo(
          row.data.drawing_no!,
          {
            item_name: row.data.item_name!,
            material: row.data.material ?? null,
            surface_treatment: row.data.surface_treatment ?? null,
          },
          userEmail,
        );

        await createDefaultBomIfEmpty({
          parent_item_id: itemId,
          drawing_no: row.data.drawing_no!,
          item_name: row.data.item_name!,
          material: row.data.material ?? undefined,
          surface_treatment: row.data.surface_treatment ?? undefined,
          progress_place: row.data.progress_place ?? undefined,
          userEmail,
        });
      }

      const successText = `저장 완료 · ${result.success}건 반영\n수주 목록을 갱신합니다...`;
      setSaveProgressMessage('');
      setSaveSuccessMsg(successText);
      setSaveError('');
      alert(`저장 완료: ${result.success}건이 반영되었습니다.`);

      await new Promise((resolve) => setTimeout(resolve, 700));
      onComplete();
      handleClose();
    } catch (err) {
      const resolved = resolveUserUploadError(err);
      setSaveError(resolved.userMessage);
      alert(resolved.userMessage);
    } finally {
      setSaving(false);
      setSaveProgressMessage('');
    }
  };

  const isChangedCell = (row: PreviewRow, field: keyof Order) =>
    row.status === 'duplicate_changed' &&
    row.changedFields?.includes(field as string);

  const customerLabel = (row: PreviewRow) => {
    const name = row.data._customer_name?.trim();
    return name || '-';
  };

  const customerUnmatched = (row: PreviewRow) =>
    !!row.data._customer_name?.trim() &&
    !resolveCustomerId(row.data._customer_name, customers);

  return (
    <>
    <Modal
      title="엑셀 수주 업로드"
      open={isOpen}
      onClose={handleClose}
      size="lg"
      busyOverlay={
        saving ? (
          <div className="excel-modal-save-overlay" role="status" aria-live="polite">
            <div className="loading-spinner excel-save-progress-spinner" />
            <p>{saveProgressMessage || '저장 중...'}</p>
          </div>
        ) : undefined
      }
      footer={
        step === 'preview' ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setStep('upload');
                setParseSuccessMsg('');
              }}
              disabled={saving}
            >
              이전
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={saving}
            >
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={saving || authLoading || !session}
              title={
                !session
                  ? '로그인 세션이 없습니다. 새로고침 후 다시 시도해 주세요.'
                  : undefined
              }
            >
              {saving
                ? saveProgressMessage || '저장 중...'
                : '저장'}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            닫기
          </button>
        )
      }
    >
      <StepIndicator step={step} />

      <div
        className={`excel-format-banner ${formatReady ? 'excel-format-banner--ok' : 'excel-format-banner--warn'}`}
      >
        {formatReady ? (
          <>
            <span className="excel-format-banner-icon">✓</span>
            <span>{getFormatConfigSummary()}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm excel-format-banner-btn"
              onClick={onOpenFormatSetup}
            >
              형식 변경
            </button>
          </>
        ) : (
          <>
            <span className="excel-format-banner-icon">!</span>
            <span>엑셀 형식 미설정 — 「엑셀 형식 설정」에서 헤더 행·컬럼 매핑을 먼저 완료해 주세요.</span>
            <button
              type="button"
              className="btn btn-primary btn-sm excel-format-banner-btn"
              onClick={onOpenFormatSetup}
            >
              형식 설정
            </button>
          </>
        )}
      </div>

      {parseError && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 12 }}>
          <span className="alert-text">{parseError}</span>
          {parseErrorDetail && (
            <details className="parse-error-detail">
              <summary>기술 정보 (관리자용)</summary>
              <pre className="parse-error-detail-body">{parseErrorDetail}</pre>
            </details>
          )}
        </div>
      )}

      {saveError && step === 'preview' && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 12 }}>
          <span className="alert-text" style={{ whiteSpace: 'pre-line' }}>
            {saveError}
          </span>
        </div>
      )}

      {!session && !authLoading && step === 'preview' && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 12 }}>
          <span className="alert-text" style={{ whiteSpace: 'pre-line' }}>
            {devAuthError ??
              'DB 저장을 위해 로그인 세션이 필요합니다.\n페이지를 새로고침(F5) 후 다시 시도해 주세요.'}
          </span>
        </div>
      )}

      {saveSuccessMsg && step === 'preview' && (
        <div className="alert alert-success" role="status" style={{ marginBottom: 12 }}>
          <span className="alert-text" style={{ whiteSpace: 'pre-line' }}>
            {saveSuccessMsg}
          </span>
        </div>
      )}

      {parseSuccessMsg && step === 'preview' && !saveSuccessMsg && (
        <div className="alert alert-success" role="status" style={{ marginBottom: 12 }}>
          <span className="alert-text" style={{ whiteSpace: 'pre-line' }}>
            {parseSuccessMsg}
          </span>
        </div>
      )}

      {step === 'upload' && (
        <div className="excel-upload-step">
          <div className="excel-section-card">
            <div className="excel-section-title">파일 선택</div>
            <div className="form-group">
              <label>엑셀 파일</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) {
                    void handleFileChange(selected);
                  } else {
                    setFile(null);
                    setFileBuffer(null);
                    setSheetNames([]);
                    setSelectedSheet('');
                  }
                  setParseError('');
                }}
              />
            </div>

            {sheetNames.length > 1 && (
              <div className="form-group">
                <label>시트</label>
                <select
                  value={selectedSheet}
                  onChange={(e) => {
                    setSelectedSheet(e.target.value);
                    setParseError('');
                  }}
                  className="mapping-select"
                  style={{ maxWidth: 360 }}
                >
                  <option value="">시트를 선택해 주세요</option>
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                  형식 설정과 다른 시트를 선택할 수 있습니다.
                </p>
              </div>
            )}

            {selectedSheet && sheetNames.length <= 1 && (
              <p className="text-muted" style={{ fontSize: 12 }}>
                시트: {selectedSheet || loadLastSheet()}
              </p>
            )}
          </div>

          <div className="excel-section-card">
            <div className="excel-section-title">업로드 범위</div>
            <div className="form-group">
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <label>
                  <input
                    type="radio"
                    name="upload-mode"
                    checked={mode === 'all'}
                    onChange={() => setMode('all')}
                  />{' '}
                  전체
                </label>
                <label>
                  <input
                    type="radio"
                    name="upload-mode"
                    checked={mode === 'single'}
                    onChange={() => setMode('single')}
                  />{' '}
                  단건
                </label>
                <label>
                  <input
                    type="radio"
                    name="upload-mode"
                    checked={mode === 'range'}
                    onChange={() => setMode('range')}
                  />{' '}
                  구간
                </label>
              </div>
            </div>

            {mode === 'single' && (
              <div className="form-group">
                <label>순번</label>
                <input
                  value={singleSeq}
                  onChange={(e) => setSingleSeq(e.target.value)}
                  placeholder="예: 001"
                  style={{ width: 120 }}
                />
              </div>
            )}

            {mode === 'range' && (
              <div
                className="form-group"
                style={{ display: 'flex', gap: 8, alignItems: 'end' }}
              >
                <div>
                  <label>시작 순번</label>
                  <input
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    style={{ width: 100 }}
                  />
                </div>
                <span style={{ paddingBottom: 8 }}>~</span>
                <div>
                  <label>끝 순번</label>
                  <input
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    style={{ width: 100 }}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleParse()}
            disabled={parsing || !file || !formatReady}
            title={
              !formatReady
                ? '「엑셀 형식 설정」을 먼저 완료해 주세요.'
                : undefined
            }
          >
            {parsing ? '파싱 중...' : '파싱 · 미리보기'}
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div className="excel-upload-preview">
          {saving && saveProgressMessage && (
            <div className="excel-save-progress" role="status" aria-live="polite">
              <div className="loading-spinner excel-save-progress-spinner" />
              <p>{saveProgressMessage}</p>
            </div>
          )}

          <div className={saving ? 'excel-upload-preview-body excel-upload-preview-body--busy' : 'excel-upload-preview-body'}>
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            <span>■ 신규</span>
            <span>■ 중복(동일)</span>
            <span>■ 중복(변경)</span>
            <span>■ 오류</span>
          </div>
          <p style={{ fontSize: 12, marginBottom: 12, color: 'var(--text-muted)' }}>
            총 {formatNumber(summary.total)}건 | 신규 {formatNumber(summary.new)} | 중복(동일){' '}
            {formatNumber(summary.duplicate_same)} | 중복(변경) {formatNumber(summary.duplicate_changed)} | 오류{' '}
            {formatNumber(summary.error)}
          </p>

          {previewRows.length === 0 ? (
            <EmptyState
              message="파싱된 데이터가 없습니다"
              subMessage="파일·업로드 범위·형식 설정을 확인한 뒤 다시 시도해 주세요."
            />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => selectAll(true)}
                >
                  전체선택
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => selectNewOnly()}
                >
                  신규만선택
                </button>
              </div>

              <div className="table-wrapper" style={{ maxHeight: 360, overflow: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th style={{ width: 52 }}>엑셀행</th>
                      <th>순번</th>
                      <th>고객사</th>
                      <th>도번</th>
                      <th>품명</th>
                      <th>수량</th>
                      <th>납기일</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr
                        key={`${row.data.seq_no}-${index}`}
                        style={ROW_STATUS_STYLE[row.status]}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={row.checked}
                            disabled={row.status === 'error'}
                            onChange={() => toggleRow(index)}
                          />
                        </td>
                        <td className="text-muted" style={{ fontSize: 12 }}>
                          {row.excelRow > 0 ? row.excelRow : '-'}
                        </td>
                        <td
                          style={
                            isChangedCell(row, 'seq_no')
                              ? { fontWeight: 600, color: '#c05a10' }
                              : undefined
                          }
                        >
                          {row.data.seq_no ?? '-'}
                        </td>
                        <td
                          style={
                            customerUnmatched(row)
                              ? { background: '#fffbea' }
                              : isChangedCell(row, 'customer_id')
                                ? { fontWeight: 600, color: '#c05a10' }
                                : undefined
                          }
                        >
                          {customerLabel(row)}
                        </td>
                        <td
                          style={
                            isChangedCell(row, 'drawing_no')
                              ? { fontWeight: 600, color: '#c05a10' }
                              : undefined
                          }
                        >
                          {row.data.drawing_no ?? '-'}
                        </td>
                        <td
                          style={
                            isChangedCell(row, 'item_name')
                              ? { fontWeight: 600, color: '#c05a10' }
                              : undefined
                          }
                        >
                          {row.data.item_name ?? '-'}
                        </td>
                        <td
                          style={
                            isChangedCell(row, 'order_quantity')
                              ? { fontWeight: 600, color: '#c05a10' }
                              : undefined
                          }
                        >
                          {row.data.order_quantity != null
                            ? formatNumber(row.data.order_quantity)
                            : '-'}
                        </td>
                        <td
                          style={
                            isChangedCell(row, 'due_date')
                              ? { fontWeight: 600, color: '#c05a10' }
                              : undefined
                          }
                        >
                          {row.data.due_date ?? '-'}
                        </td>
                        <td>
                          {row.status === 'error'
                            ? row.errorMsg ?? STATUS_LABEL.error
                            : STATUS_LABEL[row.status]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </div>
        </div>
      )}
    </Modal>
    {unitPriceChoice.modal}
    </>
  );
}
