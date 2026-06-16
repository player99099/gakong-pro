import { useState } from 'react';
import {
  SERVICE_COLUMNS,
  autoDetectMapping,
  clearMapping,
  loadSavedMapping,
  saveMapping,
  type MappableColumn,
} from '../../lib/excelMapping';

interface ColumnMappingStepProps {
  mappableColumns: MappableColumn[];
  previewRows: unknown[][];
  onConfirm: (mapping: Record<string, string>) => void;
  onBack: () => void;
  confirmLabel?: string;
  saveOnConfirm?: boolean;
}

function columnOptionLabel(col: MappableColumn, columns: MappableColumn[]): string {
  const duplicates = columns.filter((c) => c.label === col.label).length > 1;
  return duplicates ? `${col.label} (열${col.colIndex + 1})` : col.label;
}

export function ColumnMappingStep({
  mappableColumns,
  previewRows,
  onConfirm,
  onBack,
  confirmLabel = '설정 저장',
  saveOnConfirm = true,
}: ColumnMappingStepProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const saved = loadSavedMapping();
    return autoDetectMapping(mappableColumns, saved);
  });

  const handleChange = (serviceKey: string, mappingKey: string) => {
    setMapping((prev) => ({
      ...prev,
      [serviceKey]: mappingKey,
    }));
  };

  const handleConfirm = () => {
    const missingRequired = SERVICE_COLUMNS.filter(
      (col) => col.required && !mapping[col.key],
    ).map((col) => col.label);

    if (missingRequired.length > 0) {
      alert(`필수 항목을 매핑해 주세요: ${missingRequired.join(', ')}`);
      return;
    }

    if (saveOnConfirm) {
      saveMapping(mapping);
    }
    onConfirm(mapping);
  };

  const handleClear = () => {
    if (!window.confirm('저장된 매핑을 초기화하시겠습니까?')) return;
    clearMapping();
    setMapping(autoDetectMapping(mappableColumns, {}));
  };

  return (
    <div className="mapping-step">
      <p className="mapping-desc">
        엑셀 헤더와 서비스 항목을 연결해 주세요.
        <strong> 한 번 설정하면 다음부터 자동 적용됩니다.</strong>
      </p>

      <div className="mapping-table-wrap">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>서비스 항목</th>
              <th>엑셀 헤더 선택</th>
              <th>설명</th>
            </tr>
          </thead>
          <tbody>
            {SERVICE_COLUMNS.map((col) => (
              <tr
                key={col.key}
                className={col.required ? 'mapping-row--required' : ''}
              >
                <td>
                  {col.required && <span className="required-mark">✱ </span>}
                  {col.label}
                </td>
                <td>
                  <select
                    value={mapping[col.key] ?? ''}
                    onChange={(e) => handleChange(col.key, e.target.value)}
                    className={`mapping-select ${mapping[col.key] ? 'mapped' : ''}`}
                  >
                    <option value="">(매핑 안함)</option>
                    {mappableColumns.map((excelCol) => (
                      <option key={excelCol.key} value={excelCol.key}>
                        {columnOptionLabel(excelCol, mappableColumns)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="mapping-desc-cell">{col.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mapping-preview">
        <div className="mapping-preview-title">데이터 미리보기 (헤더 아래 3행)</div>
        <div className="mapping-preview-scroll">
          <table className="preview-table">
            <thead>
              <tr>
                {mappableColumns.map((col) => (
                  <th key={col.key}>{columnOptionLabel(col, mappableColumns)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i}>
                  {mappableColumns.map((col) => (
                    <td key={col.key}>
                      {String((row as unknown[])[col.colIndex] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mapping-actions">
        <button type="button" className="btn btn-ghost" onClick={handleClear}>
          매핑 초기화
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            이전
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
