import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PRINT_TEMPLATE_TYPE_LABELS } from '../lib/print/fieldCatalog';
import type { PrintTemplateType } from '../types/printTemplate';
import {
  duplicatePrintTemplate,
  ensureSystemPrintTemplates,
  fetchPrintTemplates,
  setDefaultPrintTemplate,
} from '../services/printTemplates';
import type { PrintTemplate } from '../types/printTemplate';
import { EmptyState } from '../components/ui/EmptyState';
import { TemplateImportModal } from '../components/print/TemplateImportModal';

const TEMPLATE_TYPES = Object.keys(PRINT_TEMPLATE_TYPE_LABELS) as PrintTemplateType[];

export function PrintTemplatesPage() {
  const { userEmail } = useAuth();
  const [activeType, setActiveType] = useState<PrintTemplateType>('process_traveler');
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureSystemPrintTemplates(userEmail);
      const data = await fetchPrintTemplates(activeType);
      setTemplates(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '출력 양식 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [activeType, userEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => templates.filter((t) => t.template_type === activeType),
    [templates, activeType],
  );

  const handleSetDefault = async (tpl: PrintTemplate) => {
    if (tpl.is_default) return;
    try {
      await setDefaultPrintTemplate(tpl.id, userEmail);
      setSuccessMsg(`"${tpl.name}"을(를) 기본 양식으로 설정했습니다.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '기본 양식 설정에 실패했습니다.');
    }
  };

  const handleDuplicate = async (tpl: PrintTemplate) => {
    const name = prompt('새 양식 이름', `${tpl.name} (복사)`);
    if (!name?.trim()) return;
    try {
      const created = await duplicatePrintTemplate(tpl.id, name.trim(), userEmail);
      setSuccessMsg(`"${created.name}" 양식이 생성되었습니다.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '복사에 실패했습니다.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">출력 양식 관리</h1>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setImportOpen(true)}
          >
            + Excel 양식 등록
          </button>
          <Link to="/settings" className="btn btn-secondary">
            ← 설정
          </Link>
        </div>
      </div>

      <p className="text-muted" style={{ marginBottom: 16 }}>
        <strong>Excel 양식</strong>을 등록하면 원본 서식 그대로 데이터만 채워 출력합니다.
        HTML 양식은 화면 미리보기용입니다.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="tabs">
        {TEMPLATE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`tab ${activeType === type ? 'active' : ''}`}
            onClick={() => setActiveType(type)}
          >
            {PRINT_TEMPLATE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-spinner">로딩 중...</div>
          ) : filtered.length === 0 ? (
            <EmptyState message="등록된 출력 양식이 없습니다." />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>양식명</th>
                    <th style={{ width: 80 }}>엔진</th>
                    <th style={{ width: 90 }}>기본</th>
                    <th style={{ width: 90 }}>구분</th>
                    <th style={{ width: 220 }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tpl) => (
                    <tr key={tpl.id}>
                      <td>
                        {tpl.name}
                        {tpl.description && (
                          <div className="text-muted" style={{ fontSize: 12 }}>
                            {tpl.description}
                          </div>
                        )}
                      </td>
                      <td>{tpl.engine_type === 'excel' ? 'Excel' : 'HTML'}</td>
                      <td>{tpl.is_default ? '✓ 기본' : '—'}</td>
                      <td>{tpl.is_system_preset ? '시스템' : '사용자'}</td>
                      <td>
                        <Link
                          to={`/settings/print-templates/${tpl.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ marginRight: 6 }}
                        >
                          편집
                        </Link>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginRight: 6 }}
                          onClick={() => void handleDuplicate(tpl)}
                        >
                          복사
                        </button>
                        {!tpl.is_default && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => void handleSetDefault(tpl)}
                          >
                            기본
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <TemplateImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultTemplateType={activeType}
        onSaved={() => {
          setSuccessMsg('Excel 양식을 가져와 저장했습니다.');
          void load();
        }}
      />
    </div>
  );
}
