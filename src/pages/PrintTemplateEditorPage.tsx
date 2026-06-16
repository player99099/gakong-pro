import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PrintCanvas } from '../components/print/PrintCanvas';
import { PrintPreviewModal } from '../components/print/PrintPreviewModal';
import {
  FIELD_CATALOG,
  getSampleContext,
  PRINT_TEMPLATE_TYPE_LABELS,
} from '../lib/print/fieldCatalog';
import { cloneLayout } from '../lib/print/presets/processTravelerV8';
import {
  createPrintTemplate,
  fetchPrintTemplateById,
  updatePrintTemplate,
} from '../services/printTemplates';
import type {
  PrintElement,
  PrintElementType,
  PrintLayout,
  PrintTemplate,
} from '../types/printTemplate';

function findElement(layout: PrintLayout, elementId: string): PrintElement | null {
  for (const page of layout.pages) {
    const el = page.elements.find((e) => e.id === elementId);
    if (el) return el;
  }
  return null;
}

function updateElementInLayout(
  layout: PrintLayout,
  pageId: string,
  elementId: string,
  patch: Partial<PrintElement>,
): PrintLayout {
  return {
    ...layout,
    pages: layout.pages.map((page) =>
      page.id !== pageId
        ? page
        : {
            ...page,
            elements: page.elements.map((el) =>
              el.id === elementId ? { ...el, ...patch } : el,
            ),
          },
    ),
  };
}

export function PrintTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userEmail } = useAuth();

  const [template, setTemplate] = useState<PrintTemplate | null>(null);
  const [layout, setLayout] = useState<PrintLayout | null>(null);
  const [name, setName] = useState('');
  const [activePageId, setActivePageId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isNewCopy, setIsNewCopy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const tpl = await fetchPrintTemplateById(id);
        if (cancelled) return;
        if (!tpl) {
          setError('양식을 찾을 수 없습니다.');
          return;
        }

        if (tpl.engine_type === 'excel') {
          setTemplate(tpl);
          setName(tpl.name);
          setLayout(null);
          setLoading(false);
          return;
        }

        if (tpl.is_system_preset) {
          setIsNewCopy(true);
          setTemplate({
            ...tpl,
            id: 'draft',
            is_system_preset: false,
            name: `${tpl.name} (사용자)`,
          });
          setLayout(cloneLayout(tpl.layout_json));
          setName(`${tpl.name} (사용자)`);
          setActivePageId(tpl.layout_json.pages[0]?.id ?? '');
          setLoading(false);
          return;
        }

        setTemplate(tpl);
        setLayout(cloneLayout(tpl.layout_json));
        setName(tpl.name);
        setActivePageId(tpl.layout_json.pages[0]?.id ?? '');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '양식을 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, userEmail, navigate]);

  const selected = useMemo(
    () => (layout && selectedId ? findElement(layout, selectedId) : null),
    [layout, selectedId],
  );

  const sampleContext = useMemo(
    () => (template ? getSampleContext(template.template_type) : {}),
    [template],
  );

  const activePage = layout?.pages.find((p) => p.id === activePageId) ?? layout?.pages[0];

  const handleElementMove = useCallback(
    (pageId: string, elementId: string, x: number, y: number) => {
      setLayout((prev) =>
        prev ? updateElementInLayout(prev, pageId, elementId, { x, y }) : prev,
      );
    },
    [],
  );

  const patchSelected = (patch: Partial<PrintElement>) => {
    if (!layout || !selectedId || !activePage) return;
    setLayout(updateElementInLayout(layout, activePage.id, selectedId, patch));
  };

  const addElement = (type: PrintElementType) => {
    if (!layout || !activePage) return;
    const el: PrintElement = {
      id: `el_${Date.now()}`,
      type,
      x: 20,
      y: 20,
      w: type === 'line' ? 40 : 30,
      h: type === 'line' ? 0.3 : 8,
      text: type === 'text' ? '텍스트' : type === 'checkbox' ? '체크' : undefined,
      bindKey: type === 'bind' ? FIELD_CATALOG[template!.template_type][0]?.key : undefined,
      style: { fontSize: 9, borderWidth: type === 'box' || type === 'bind' ? 1 : undefined },
    };
    setLayout({
      ...layout,
      pages: layout.pages.map((p) =>
        p.id === activePage.id ? { ...p, elements: [...p.elements, el] } : p,
      ),
    });
    setSelectedId(el.id);
  };

  const removeSelected = () => {
    if (!layout || !selectedId || !activePage) return;
    if (!confirm('선택 요소를 삭제하시겠습니까?')) return;
    setLayout({
      ...layout,
      pages: layout.pages.map((p) =>
        p.id === activePage.id
          ? { ...p, elements: p.elements.filter((e) => e.id !== selectedId) }
          : p,
      ),
    });
    setSelectedId(null);
  };

  const handleSave = async () => {
    if (!template || !layout) return;
    setSaving(true);
    setError('');
    try {
      if (isNewCopy || template.id === 'draft') {
        const created = await createPrintTemplate(
          {
            template_type: template.template_type,
            name: name.trim() || template.name,
            layout_json: layout,
          },
          userEmail,
        );
        setTemplate(created);
        setIsNewCopy(false);
        navigate(`/settings/print-templates/${created.id}`, { replace: true });
      } else {
        await updatePrintTemplate(
          template.id,
          { name: name.trim(), layout_json: layout },
          userEmail,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner">양식 로딩 중...</div>;
  }

  if (!template) {
    return (
      <div>
        <div className="alert alert-error">{error || '양식을 불러올 수 없습니다.'}</div>
        <Link to="/settings/print-templates" className="btn btn-secondary">
          목록으로
        </Link>
      </div>
    );
  }

  const fields = FIELD_CATALOG[template.template_type];

  if (template.engine_type === 'excel') {
    const bindRows =
      template.mapping_json?.sheets.flatMap((s) =>
        s.cells.map((c) => ({ sheetName: s.sheetName, ...c })),
      ) ?? [];

    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Excel 양식 — {template.name}</h1>
          <div className="page-actions">
            <Link to="/settings/print-templates" className="btn btn-secondary">
              목록
            </Link>
          </div>
        </div>
        <p className="text-muted">
          Excel 원본 파일과 셀 매핑을 관리합니다. 파일 교체는 「Excel 양식 등록」으로 새
          양식을 등록하세요.
        </p>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <p>
              <strong>파일:</strong> {template.storage_path ?? '—'}
            </p>
            <p>
              <strong>출력 시트:</strong>{' '}
              {template.mapping_json?.printSheetNames.join(', ') ?? '—'}
            </p>
          </div>
        </div>
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
    );
  }

  if (!layout) {
    return (
      <div>
        <div className="alert alert-error">{error || '양식을 불러올 수 없습니다.'}</div>
        <Link to="/settings/print-templates" className="btn btn-secondary">
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="print-editor">
      <div className="page-header">
        <h1 className="page-title">
          출력 양식 편집 — {PRINT_TEMPLATE_TYPE_LABELS[template.template_type]}
        </h1>
        <div className="page-actions">
          <Link to="/settings/print-templates" className="btn btn-secondary">
            목록
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => setPreviewOpen(true)}>
            미리보기
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {isNewCopy && (
        <div className="alert alert-success">
          시스템 양식은 직접 수정할 수 없어 복사본을 열었습니다. 저장하면 사용자 양식으로 등록됩니다.
        </div>
      )}

      <div className="form-group" style={{ maxWidth: 420, marginBottom: 12 }}>
        <label>양식명</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="print-editor__toolbar">
        <span className="text-muted">페이지:</span>
        {layout.pages.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`btn btn-sm ${activePageId === p.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActivePageId(p.id);
              setSelectedId(null);
            }}
          >
            {p.name}
          </button>
        ))}
        <span style={{ marginLeft: 16 }} className="text-muted">
          추가:
        </span>
        {(['text', 'bind', 'box', 'line', 'checkbox'] as PrintElementType[]).map((t) => (
          <button key={t} type="button" className="btn btn-secondary btn-sm" onClick={() => addElement(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="print-editor__body">
        <div className="print-editor__canvas-wrap">
          <PrintCanvas
            layout={{ ...layout, pages: activePage ? [activePage] : layout.pages }}
            context={sampleContext}
            scale={0.72}
            editMode
            selectedElementId={selectedId}
            onSelectElement={setSelectedId}
            onElementMove={handleElementMove}
          />
        </div>

        <div className="print-editor__props card">
          <div className="card-header">속성</div>
          <div className="card-body">
            {!selected ? (
              <p className="text-muted">캔버스에서 요소를 선택하세요.</p>
            ) : (
              <>
                <div className="form-group">
                  <label>유형</label>
                  <input value={selected.type} readOnly />
                </div>
                <div className="form-grid cols-2">
                  {(['x', 'y', 'w', 'h'] as const).map((key) => (
                    <div className="form-group" key={key}>
                      <label>{key.toUpperCase()} (mm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={selected[key]}
                        onChange={(e) =>
                          patchSelected({ [key]: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                  ))}
                </div>
                {(selected.type === 'text' || selected.type === 'checkbox') && (
                  <div className="form-group">
                    <label>텍스트</label>
                    <input
                      value={selected.text ?? ''}
                      onChange={(e) => patchSelected({ text: e.target.value })}
                    />
                  </div>
                )}
                {selected.type === 'bind' && (
                  <div className="form-group">
                    <label>데이터 필드</label>
                    <select
                      value={selected.bindKey ?? ''}
                      onChange={(e) => patchSelected({ bindKey: e.target.value })}
                    >
                      {fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label} ({f.key})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>글자 크기 (pt)</label>
                  <input
                    type="number"
                    value={selected.style?.fontSize ?? 9}
                    onChange={(e) =>
                      patchSelected({
                        style: { ...selected.style, fontSize: Number(e.target.value) || 9 },
                      })
                    }
                  />
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={removeSelected}>
                  삭제
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <PrintPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`미리보기 — ${name}`}
        layout={layout}
        context={sampleContext}
      />
    </div>
  );
}
