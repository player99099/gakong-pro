import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  FIELD_CATALOG,
  getSampleContext,
  PRINT_TEMPLATE_TYPE_LABELS,
} from '../../lib/print/fieldCatalog';
import { buildExcelTemplateMapping } from '../../lib/print/excel/buildExcelMapping';
import {
  detectSheetCandidates,
  type SheetCandidate,
} from '../../lib/print/import/excelTemplateParser';
import { resolvePrintTemplateSaveError } from '../../lib/formatAppError';
import {
  EXCEL_PRINT_GUIDE,
  fillExcelTemplateAndDownload,
} from '../../services/excelTemplateFill';
import {
  createPrintTemplate,
  setDefaultPrintTemplate,
} from '../../services/printTemplates';
import {
  buildStoragePathForTemplate,
  uploadPrintTemplateFile,
} from '../../services/printTemplateStorage';
import type { ExcelTemplateMapping } from '../../types/excelTemplate';
import { EMPTY_PRINT_LAYOUT } from '../../types/excelTemplate';
import type { PrintTemplateType } from '../../types/printTemplate';
import { Modal } from '../ui/Modal';

type ImportStep = 'upload' | 'configure' | 'preview';

interface TemplateImportModalProps {
  open: boolean;
  onClose: () => void;
  defaultTemplateType: PrintTemplateType;
  onSaved: () => void;
}

export function TemplateImportModal({
  open,
  onClose,
  defaultTemplateType,
  onSaved,
}: TemplateImportModalProps) {
  const { userEmail } = useAuth();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [templateType, setTemplateType] = useState<PrintTemplateType>(defaultTemplateType);
  const [templateName, setTemplateName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [sheetCandidates, setSheetCandidates] = useState<SheetCandidate[]>([]);
  const [mapping, setMapping] = useState<ExcelTemplateMapping | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sampleContext = useMemo(
    () => getSampleContext(templateType),
    [templateType],
  );

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setTemplateType(defaultTemplateType);
    setTemplateName('');
    setSetAsDefault(true);
    setSelectedSheets([]);
    setSheetCandidates([]);
    setMapping(null);
    setError('');
  }, [defaultTemplateType]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const applySheets = (names: string[]) => {
    setSelectedSheets(names);
    setMapping(buildExcelTemplateMapping(templateType, names));
  };

  const analyzeFile = async (f: File, type: PrintTemplateType) => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await f.arrayBuffer());
    const candidates = detectSheetCandidates(workbook.worksheets);
    setSheetCandidates(candidates);
    const auto = candidates.filter((s) => s.suggested).map((s) => s.name);
    const picked =
      auto.length >= 2 ? auto.slice(0, 2) : candidates.slice(0, 2).map((s) => s.name);
    applySheets(picked);
    setMapping(buildExcelTemplateMapping(type, picked));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) {
      setError('현재 .xlsx 파일만 지원합니다.');
      return;
    }
    setFile(f);
    setTemplateName(f.name.replace(/\.xlsx$/i, ''));
    setParsing(true);
    setError('');
    try {
      await analyzeFile(f, templateType);
      setStep('configure');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Excel 분석에 실패했습니다.');
    } finally {
      setParsing(false);
    }
  };

  const toggleSheet = (name: string) => {
    setSelectedSheets((prev) => {
      let next: string[];
      if (prev.includes(name)) {
        next = prev.filter((n) => n !== name);
      } else if (prev.length >= 2) {
        next = [...prev.slice(1), name];
      } else {
        next = [...prev, name];
      }
      if (next.length > 0) {
        setMapping(buildExcelTemplateMapping(templateType, next));
      }
      return next;
    });
  };

  const handlePreview = () => {
    if (selectedSheets.length === 0) {
      setError('가져올 시트를 1개 이상 선택하세요.');
      return;
    }
    setMapping(buildExcelTemplateMapping(templateType, selectedSheets));
    setStep('preview');
  };

  const handleSampleDownload = async () => {
    if (!file || !mapping) return;
    setError('');
    try {
      const tempId = crypto.randomUUID();
      const storagePath = buildStoragePathForTemplate(tempId, file.name);
      await uploadPrintTemplateFile(file, storagePath);
      const tempTemplate = {
        id: tempId,
        template_type: templateType,
        name: templateName,
        description: null,
        engine_type: 'excel' as const,
        storage_path: storagePath,
        mapping_json: mapping,
        is_system_preset: false,
        is_default: false,
        layout_json: EMPTY_PRINT_LAYOUT,
        created_by: null,
        updated_by: null,
        created_at: '',
        updated_at: '',
      };
      await fillExcelTemplateAndDownload(tempTemplate, sampleContext, '양식_미리보기_샘플');
      alert(EXCEL_PRINT_GUIDE);
    } catch (err) {
      setError(
        resolvePrintTemplateSaveError(err, '샘플 Excel 생성에 실패했습니다.'),
      );
    }
  };

  const handleSave = async () => {
    if (!file || !mapping || !templateName.trim()) {
      setError('양식명과 Excel 파일을 확인해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const id = crypto.randomUUID();
      const storagePath = buildStoragePathForTemplate(id, file.name);
      await uploadPrintTemplateFile(file, storagePath);

      const created = await createPrintTemplate(
        {
          template_type: templateType,
          name: templateName.trim(),
          description: `Excel 양식 (${mapping.printSheetNames.join(', ')})`,
          engine_type: 'excel',
          storage_path: storagePath,
          mapping_json: mapping,
          layout_json: EMPTY_PRINT_LAYOUT,
          is_default: setAsDefault,
        },
        userEmail,
        id,
      );

      if (setAsDefault) {
        await setDefaultPrintTemplate(created.id, userEmail);
      }
      onSaved();
      handleClose();
    } catch (err) {
      setError(resolvePrintTemplateSaveError(err, '양식 저장에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const fields = FIELD_CATALOG[templateType];
  const bindRows =
    mapping?.sheets.flatMap((s) =>
      s.cells.map((c) => ({ sheetName: s.sheetName, ...c })),
    ) ?? [];

  return (
    <Modal
      title="Excel 양식 등록"
      open={open}
      onClose={handleClose}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            취소
          </button>
          {step === 'configure' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={parsing || selectedSheets.length === 0}
              onClick={handlePreview}
            >
              다음
            </button>
          )}
          {step === 'preview' && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleSampleDownload()}
              >
                샘플 Excel 받기
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? '저장 중…' : '양식으로 저장'}
              </button>
            </>
          )}
        </>
      }
    >
      {error && <div className="alert alert-error">{error}</div>}

      {step === 'upload' && (
        <div className="template-import-upload">
          <p className="text-muted" style={{ marginBottom: 12 }}>
            Excel(.xlsx) <strong>원본 파일</strong>을 등록합니다. 프로그램이 지정 셀에만
            데이터를 넣고, 서식은 Excel 그대로 유지합니다. (HTML 변환 없음)
          </p>
          <div className="form-group">
            <label>양식 종류</label>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as PrintTemplateType)}
            >
              {Object.entries(PRINT_TEMPLATE_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Excel 파일 (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx"
              disabled={parsing}
              onChange={(e) => void handleFileChange(e)}
            />
          </div>
          {parsing && <div className="loading-spinner">시트 분석 중…</div>}
        </div>
      )}

      {step === 'configure' && file && (
        <div>
          <p>
            파일: <strong>{file.name}</strong>
          </p>
          <div className="form-group">
            <label>양식명</label>
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>출력 시트 (양면 · 최대 2장)</label>
            <div className="template-import-sheets">
              {sheetCandidates.map((s) => (
                <label key={s.name} className="template-import-sheet-option">
                  <input
                    type="checkbox"
                    checked={selectedSheets.includes(s.name)}
                    onChange={() => toggleSheet(s.name)}
                  />
                  {s.name}
                  <span className="text-muted">
                    ({s.orientation === 'landscape' ? '가로' : '세로'})
                  </span>
                </label>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
            />
            저장 후 이 양식을 기본으로 설정
          </label>
        </div>
      )}

      {step === 'preview' && mapping && (
        <div>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
            등록 시 Excel 파일이 Storage에 저장되고, 아래 셀에 프로그램 데이터가
            연결됩니다. 「샘플 Excel 받기」로 실제 양식을 확인하세요.
          </p>
          {bindRows.length > 0 && (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>시트</th>
                    <th>셀</th>
                    <th>필드</th>
                  </tr>
                </thead>
                <tbody>
                  {bindRows.map((row, i) => (
                    <tr key={`${row.sheetName}-${row.address}-${i}`}>
                      <td>{row.sheetName}</td>
                      <td>{row.address}</td>
                      <td>
                        {fields.find((f) => f.key === row.bindKey)?.label ?? row.bindKey}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
