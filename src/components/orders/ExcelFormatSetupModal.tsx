import { useState } from 'react';
import {
  extractMappableColumns,
  getMaxColumnCount,
  getFormatConfigSummary,
  isMappingConfigured,
  loadHeaderRowForSheet,
  loadLastSheet,
  padExcelRow,
  saveHeaderRowForSheet,
  saveLastSheet,
  type MappableColumn,
} from '../../lib/excelMapping';
import { resolveUserUploadError } from '../../lib/formatAppError';
import { saveReferenceExcel } from '../../lib/excelReferenceCache';
import { Modal } from '../ui/Modal';
import { ColumnMappingStep } from './ColumnMappingStep';

type SetupStep = 'header' | 'mapping';

const SHEET_PREVIEW_ROW_LIMIT = 25;

interface ExcelFormatSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

function SetupStepIndicator({ step }: { step: SetupStep }) {
  return (
    <div className="modal-steps">
      <span className={step === 'header' ? 'step active' : 'step done'}>
        1. 샘플 · 헤더
      </span>
      <span className="step-arrow">›</span>
      <span className={step === 'mapping' ? 'step active' : 'step'}>
        2. 컬럼 매핑
      </span>
    </div>
  );
}

export function ExcelFormatSetupModal({
  isOpen,
  onClose,
  onSaved,
}: ExcelFormatSetupModalProps) {
  const [step, setStep] = useState<SetupStep>('header');
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headerRowIndex, setHeaderRowIndex] = useState(1);
  const [sheetPreviewRows, setSheetPreviewRows] = useState<unknown[][]>([]);
  const [mappableColumns, setMappableColumns] = useState<MappableColumn[]>([]);
  const [previewSampleRows, setPreviewSampleRows] = useState<unknown[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetModal = () => {
    setStep('header');
    setFile(null);
    setFileBuffer(null);
    setSheetNames([]);
    setSelectedSheet('');
    setHeaderRowIndex(1);
    setSheetPreviewRows([]);
    setMappableColumns([]);
    setPreviewSampleRows([]);
    setError('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  async function loadSheetPreview(sheetName: string, buffer: ArrayBuffer) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, {
      type: 'array',
      sheetRows: SHEET_PREVIEW_ROW_LIMIT,
    });
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      setSheetPreviewRows([]);
      return;
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
    }) as unknown[][];

    setSheetPreviewRows(rows);
    const savedHeaderRow = loadHeaderRowForSheet(sheetName);
    setHeaderRowIndex(
      savedHeaderRow && savedHeaderRow <= rows.length ? savedHeaderRow : 1,
    );
  }

  async function handleFileChange(selectedFile: File) {
    setFile(selectedFile);
    setSheetNames([]);
    setSelectedSheet('');
    setFileBuffer(null);
    setSheetPreviewRows([]);
    setHeaderRowIndex(1);
    setError('');

    try {
      const XLSX = await import('xlsx');
      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { bookSheets: true, type: 'array' });
      setFileBuffer(buffer);
      setSheetNames(wb.SheetNames);

      const lastSheet = loadLastSheet();
      if (lastSheet && wb.SheetNames.includes(lastSheet)) {
        setSelectedSheet(lastSheet);
        await loadSheetPreview(lastSheet, buffer);
      } else if (wb.SheetNames.length === 1) {
        setSelectedSheet(wb.SheetNames[0]);
        await loadSheetPreview(wb.SheetNames[0], buffer);
      }
    } catch (err) {
      setError(resolveUserUploadError(err).userMessage);
    }
  }

  async function handleSheetChange(sheetName: string) {
    setSelectedSheet(sheetName);
    setError('');
    if (sheetName && fileBuffer) {
      await loadSheetPreview(sheetName, fileBuffer);
    } else {
      setSheetPreviewRows([]);
      setHeaderRowIndex(1);
    }
  }

  const handleHeaderStep = async () => {
    if (!file || !selectedSheet || !fileBuffer) {
      setError('샘플 파일과 시트를 선택해 주세요.');
      return;
    }

    if (headerRowIndex < 1) {
      setError('헤더 행 번호는 1 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(fileBuffer, { type: 'array' });
      const ws = wb.Sheets[selectedSheet];
      if (!ws) {
        setError(`시트 "${selectedSheet}"을 찾을 수 없습니다.`);
        return;
      }

      const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        defval: '',
      }) as unknown[][];

      const headerIdx = headerRowIndex - 1;
      if (headerIdx >= allRows.length) {
        setError(`헤더 행 ${headerRowIndex}이 시트 범위를 벗어났습니다.`);
        return;
      }

      const headerRow = allRows[headerIdx] ?? [];
      const mappable = extractMappableColumns(headerRow);

      if (mappable.length === 0) {
        setError(
          `선택한 ${headerRowIndex}행에 텍스트 헤더가 없습니다. 다른 행을 선택해 주세요.`,
        );
        return;
      }

      const columnCount = getMaxColumnCount(allRows);
      const sampleRows = allRows
        .slice(headerIdx + 1, headerIdx + 4)
        .map((row) => padExcelRow(row, columnCount));

      setMappableColumns(mappable);
      setPreviewSampleRows(sampleRows);
      saveLastSheet(selectedSheet);
      saveHeaderRowForSheet(selectedSheet, headerRowIndex);
      setStep('mapping');
    } catch (err) {
      setError(resolveUserUploadError(err).userMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleMappingSave = async (_mapping: Record<string, string>) => {
    if (!isMappingConfigured()) {
      alert('필수 항목(순번·도면번호·품명) 매핑을 완료해 주세요.');
      return;
    }

    if (fileBuffer) {
      try {
        await saveReferenceExcel(fileBuffer);
      } catch {
        alert(
          '참조 엑셀 저장에 실패했습니다.\n순번 직접 입력 조회는 DB에 저장된 수주만 가능합니다.',
        );
      }
    }

    alert(
      `엑셀 형식 설정이 저장되었습니다.\n\n${getFormatConfigSummary()}\n\n이제 「엑셀 업로드」 또는 수주 목록에서 순번을 입력해 데이터를 불러올 수 있습니다.`,
    );
    onSaved?.();
    handleClose();
  };

  const configured = isMappingConfigured();

  return (
    <Modal
      title="엑셀 형식 설정"
      open={isOpen}
      onClose={handleClose}
      size="lg"
      footer={
        step === 'header' ? (
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            닫기
          </button>
        ) : null
      }
    >
      <SetupStepIndicator step={step} />

      <div
        className={`excel-format-banner ${configured ? 'excel-format-banner--ok' : 'excel-format-banner--warn'}`}
      >
        {configured ? (
          <>
            <span className="excel-format-banner-icon">✓</span>
            <span>현재 설정: {getFormatConfigSummary()}</span>
          </>
        ) : (
          <>
            <span className="excel-format-banner-icon">!</span>
            <span>
              엑셀 형식이 아직 설정되지 않았습니다. 샘플 파일로 1회 설정해 주세요.
            </span>
          </>
        )}
      </div>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: 12 }}>
          <span className="alert-text">{error}</span>
        </div>
      )}

      {step === 'header' && (
        <div className="excel-upload-step">
          <p className="mapping-desc" style={{ marginBottom: 16 }}>
            회사 엑셀 양식의 <strong>시트·헤더 행·컬럼 매핑</strong>을 등록합니다.
            저장 후 업로드 시 자동 적용됩니다.
          </p>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>샘플 엑셀 파일</label>
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
                  setSheetPreviewRows([]);
                  setHeaderRowIndex(1);
                }
                setError('');
              }}
            />
          </div>

          {sheetNames.length > 0 && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>시트 선택</label>
              {sheetNames.length === 1 ? (
                <div className="sheet-single">
                  {sheetNames[0]}{' '}
                  <span className="text-muted">(시트 1개)</span>
                </div>
              ) : (
                <select
                  value={selectedSheet}
                  onChange={(e) => {
                    void handleSheetChange(e.target.value);
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
              )}
            </div>
          )}

          {selectedSheet && sheetPreviewRows.length > 0 && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>헤더 행 (엑셀 행 번호)</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <input
                  type="number"
                  min={1}
                  max={sheetPreviewRows.length}
                  value={headerRowIndex}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 1) {
                      setHeaderRowIndex(Math.min(n, sheetPreviewRows.length));
                    }
                  }}
                  style={{ width: 80 }}
                />
                <span className="text-muted" style={{ fontSize: 12 }}>
                  클릭하거나 번호를 입력해 헤더로 사용할 행을 지정하세요
                </span>
              </div>
              <div className="header-row-preview-scroll">
                <table className="header-row-preview-table">
                  <tbody>
                    {sheetPreviewRows.map((row, rowIdx) => {
                      const rowNum = rowIdx + 1;
                      const isHeader = rowNum === headerRowIndex;
                      return (
                        <tr
                          key={rowNum}
                          className={
                            isHeader ? 'header-row-preview--selected' : ''
                          }
                          onClick={() => setHeaderRowIndex(rowNum)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setHeaderRowIndex(rowNum);
                            }
                          }}
                        >
                          <td className="header-row-preview-num">{rowNum}</td>
                          {(row as unknown[]).slice(0, 12).map((cell, colIdx) => (
                            <td key={colIdx}>
                              {String(cell ?? '').slice(0, 24)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleHeaderStep}
            disabled={loading || !file || !selectedSheet}
          >
            {loading ? '읽는 중...' : '다음: 컬럼 매핑'}
          </button>
        </div>
      )}

      {step === 'mapping' && (
        <ColumnMappingStep
          mappableColumns={mappableColumns}
          previewRows={previewSampleRows}
          onConfirm={handleMappingSave}
          onBack={() => {
            setError('');
            setStep('header');
          }}
          confirmLabel="설정 저장"
        />
      )}
    </Modal>
  );
}
