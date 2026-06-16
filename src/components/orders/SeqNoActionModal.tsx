import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnitPriceChoice } from '../../hooks/useUnitPriceChoice';
import {
  detectChangedFields,
  getFormatConfigSummary,
  getMappingColumnMeta,
  isMappingConfigured,
  loadSavedMapping,
  REQUIRED_COLUMNS,
  SERVICE_COLUMNS,
  toOrderUpsertPayload,
  type ExcelOrderRow,
} from '../../lib/excelMapping';
import { formatExcelRowColRef } from '../../lib/excelCellRef';
import { resolveUserUploadError } from '../../lib/formatAppError';
import { formatNumber } from '../../lib/formatNumber';
import {
  parseReferenceExcelBySeq,
  type SeqScopeMode,
} from '../../lib/excelSeqParse';
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
import { Modal } from '../ui/Modal';

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

interface SeqNoActionModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  customers: Customer[];
  onOpenFormatSetup?: () => void;
}

const ROW_STATUS_STYLE: Record<RowStatus, CSSProperties> = {
  new: { background: '#f0fdf4' },
  duplicate_same: { background: '#f8fafc' },
  duplicate_changed: { background: '#fff7ed' },
  error: { background: '#fef2f2' },
};

const STATUS_LABEL: Record<RowStatus, string> = {
  new: '신규',
  duplicate_same: '중복(동일)',
  duplicate_changed: '중복(변경)',
  error: '오류',
};

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

export function SeqNoActionModal({
  open,
  onClose,
  onComplete,
  customers,
  onOpenFormatSetup,
}: SeqNoActionModalProps) {
  const { userEmail, session, loading: authLoading } = useAuth();
  const unitPriceChoice = useUnitPriceChoice();
  const [scopeMode, setScopeMode] = useState<SeqScopeMode>('single');
  const [singleSeq, setSingleSeq] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (open) {
      setStep('input');
      setPreviewRows([]);
      setError('');
      setInfo('');
    }
  }, [open]);

  const formatReady = isMappingConfigured();

  const summary = useMemo(() => {
    const counts = {
      total: previewRows.length,
      new: 0,
      duplicate_same: 0,
      duplicate_changed: 0,
      error: 0,
    };
    previewRows.forEach((r) => {
      counts[r.status] += 1;
    });
    return counts;
  }, [previewRows]);

  const reset = () => {
    setScopeMode('single');
    setSingleSeq('');
    setRangeStart('');
    setRangeEnd('');
    setStep('input');
    setPreviewRows([]);
    setError('');
    setInfo('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  async function classifyRows(
    entries: { data: ExcelOrderRow; excelRow: number }[],
  ): Promise<PreviewRow[]> {
    const mapping = loadSavedMapping();
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

  const handleExecute = async () => {
    setError('');
    setInfo('');

    if (!formatReady) {
      setError(
        '엑셀 형식이 설정되지 않았습니다.\n「엑셀 형식 설정」을 먼저 완료해 주세요.',
      );
      return;
    }

    setBusy(true);
    try {
      const entries = await parseReferenceExcelBySeq({
        mode: scopeMode,
        singleSeq,
        rangeStart,
        rangeEnd,
      });
      const classified = await classifyRows(entries);
      setPreviewRows(classified);
      setStep('preview');

      const ok =
        classified.filter((r) => r.status !== 'error').length;
      if (ok === 0) {
        setError('추가 가능한 행이 없습니다. 오류 행을 확인해 주세요.');
      }
    } catch (err) {
      const resolved = resolveUserUploadError(err);
      setError(resolved.userMessage);
    } finally {
      setBusy(false);
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
    if (authLoading) {
      setError('로그인 확인 중입니다.');
      return;
    }
    if (!session || !userEmail) {
      setError('로그인 후 저장할 수 있습니다.');
      return;
    }

    const checkedRows = previewRows.filter(
      (r) => r.checked && r.status !== 'error',
    );
    if (checkedRows.length === 0) {
      setError('저장할 행을 선택해 주세요.');
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
    setError('');
    try {
      const priceOk = await resolveBatchOrderRowUnitPrices(
        checkedRows,
        (orderPrice, bomPrice, drawingNo) =>
          unitPriceChoice.prompt(orderPrice, bomPrice, drawingNo, 'bom'),
      );
      if (!priceOk) return;

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
        setError(resolved.userMessage);
        return;
      }

      for (const row of checkedRows) {
        if (!row.data.drawing_no || !row.data.item_name || !row.data.seq_no) {
          continue;
        }
        const name = row.data._customer_name?.trim();
        const customerId = name
          ? customerIdByName.get(name.toLowerCase())
          : undefined;

        const itemId = await upsertItemFromOrder({
          drawing_no: row.data.drawing_no,
          item_name: row.data.item_name,
          material: row.data.material ?? undefined,
          surface_treatment: row.data.surface_treatment ?? undefined,
          customer_id: customerId,
          unit_price: row.data.unit_price,
          userEmail,
          keepMasterUnitPrice: true,
        });

        await linkOrderItemBySeqNo(row.data.seq_no, itemId, userEmail);

        await syncBomFieldsByDrawingNo(
          row.data.drawing_no,
          {
            item_name: row.data.item_name,
            material: row.data.material ?? null,
            surface_treatment: row.data.surface_treatment ?? null,
          },
          userEmail,
        );

        await createDefaultBomIfEmpty({
          parent_item_id: itemId,
          drawing_no: row.data.drawing_no,
          item_name: row.data.item_name,
          material: row.data.material ?? undefined,
          surface_treatment: row.data.surface_treatment ?? undefined,
          progress_place: row.data.progress_place ?? undefined,
          userEmail,
        });
      }

      alert(`저장 완료 · ${result.success}건 반영`);
      onComplete();
      handleClose();
    } catch (err) {
      const resolved = resolveUserUploadError(err);
      setError(resolved.userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
    <Modal
      title="순번 추가"
      open={open}
      onClose={handleClose}
      size="lg"
      footer={
        step === 'input' ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void handleExecute()}
            >
              {busy ? '처리 중…' : '불러오기'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep('input')}
              disabled={saving}
            >
              ← 입력
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </>
        )
      }
    >
      <div className="seq-action-modal">
        {step === 'input' && (
          <>
            <p className="seq-action-desc">
              저장된 참조 엑셀에서 순번으로 수주를 불러와 DB에 등록합니다. (파일
              업로드 불필요)
            </p>

            {!formatReady && (
              <div className="alert alert-error" role="alert">
                <span className="alert-icon">!</span>
                <span className="alert-text">
                  엑셀 형식 설정이 필요합니다.
                  {onOpenFormatSetup && (
                    <>
                      {' '}
                      <button
                        type="button"
                        className="btn-link"
                        onClick={onOpenFormatSetup}
                      >
                        형식 설정
                      </button>
                    </>
                  )}
                </span>
              </div>
            )}

            {formatReady && (
              <p className="seq-action-format-hint">{getFormatConfigSummary()}</p>
            )}

            <div className="seq-action-scope">
              <span className="seq-action-scope-label">범위</span>
              <label>
                <input
                  type="radio"
                  name="seq-scope"
                  checked={scopeMode === 'single'}
                  onChange={() => setScopeMode('single')}
                />{' '}
                단건
              </label>
              <label>
                <input
                  type="radio"
                  name="seq-scope"
                  checked={scopeMode === 'range'}
                  onChange={() => setScopeMode('range')}
                />{' '}
                구간
              </label>
            </div>

            {scopeMode === 'single' ? (
              <div className="form-group">
                <label>순번</label>
                <input
                  value={singleSeq}
                  onChange={(e) => setSingleSeq(e.target.value)}
                  placeholder="예: 13183"
                  style={{ width: 160 }}
                />
              </div>
            ) : (
              <div className="form-group seq-action-range">
                <div>
                  <label>시작 순번</label>
                  <input
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    style={{ width: 120 }}
                  />
                </div>
                <span>~</span>
                <div>
                  <label>끝 순번</label>
                  <input
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    style={{ width: 120 }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {step === 'preview' && (
          <>
            <p className="seq-action-desc">
              총 {formatNumber(summary.total)}건 | 신규 {formatNumber(summary.new)} |
              중복(동일) {formatNumber(summary.duplicate_same)} | 중복(변경){' '}
              {formatNumber(summary.duplicate_changed)} | 오류{' '}
              {formatNumber(summary.error)}
            </p>
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
                    <th>순번</th>
                    <th>거래처</th>
                    <th>도번</th>
                    <th>품명</th>
                    <th>수량</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={`${row.data.seq_no}-${index}`} style={ROW_STATUS_STYLE[row.status]}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.checked}
                          disabled={row.status === 'error'}
                          onChange={() => toggleRow(index)}
                        />
                      </td>
                      <td>{row.data.seq_no ?? '-'}</td>
                      <td>{row.data._customer_name ?? '-'}</td>
                      <td>{row.data.drawing_no ?? '-'}</td>
                      <td>{row.data.item_name ?? '-'}</td>
                      <td>
                        {row.data.order_quantity != null
                          ? formatNumber(row.data.order_quantity)
                          : '-'}
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

        {error && (
          <div className="alert alert-error seq-action-alert" role="alert">
            <span className="alert-icon">!</span>
            <span className="alert-text" style={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </span>
          </div>
        )}
        {info && (
          <div className="alert alert-success seq-action-alert" role="status">
            {info}
          </div>
        )}
      </div>
    </Modal>
    {unitPriceChoice.modal}
    </>
  );
}
