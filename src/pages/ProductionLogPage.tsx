import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_DEFECT_TYPES, DEFAULT_SETUP_TYPES } from '../lib/constants';
import { formatNumber } from '../lib/formatNumber';
import {
  createProductionLog,
  deleteProductionLog,
  fetchOrdersForProductionSelect,
  fetchProductionLogById,
  fetchProductionLogStats,
  fetchProductionLogs,
  updateProductionLog,
} from '../services/productionLogs';
import {
  fetchActiveDefectTypes,
  fetchActiveSetupTypes,
} from '../services/settings';
import type {
  Order,
  ProductionLog,
  ProductionLogInput,
  ProductionLogSearchParams,
  ProductionLogStats,
  WorkOrder,
} from '../types';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { NumericInput } from '../components/ui/NumericInput';

const emptySearch: ProductionLogSearchParams = {
  workDateFrom: '',
  workDateTo: '',
  workerName: '',
  equipment: '',
  customerName: '',
  orderNo: '',
  drawingNo: '',
};

const emptyForm = (): ProductionLogInput => ({
  order_id: '',
  work_order_id: null,
  work_date: new Date().toISOString().split('T')[0],
  worker_name: '',
  department: null,
  equipment: null,
  customer_name: null,
  order_no: null,
  drawing_no: null,
  item_name: null,
  processing_minutes: 0,
  production_quantity: 0,
  defect_quantity: 0,
  defect_type: null,
  defect_note: null,
  setup_minutes: 0,
  setup_type: null,
  note: null,
  special_note: null,
});

type OrderForSelect = Order & { work_orders?: WorkOrder[] };

function orderSelectLabel(order: OrderForSelect): string {
  const no = order.order_no ?? '-';
  const drawing = order.drawing_no ?? '-';
  const name = order.item_name ?? '-';
  return `${no} / ${drawing} / ${name}`;
}

function getWorkOrderId(order: OrderForSelect): string | null {
  return order.work_orders?.[0]?.id ?? null;
}

export function ProductionLogPage() {
  const { userEmail } = useAuth();
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [stats, setStats] = useState<ProductionLogStats | null>(null);
  const [orders, setOrders] = useState<OrderForSelect[]>([]);
  const [defectTypes, setDefectTypes] = useState<string[]>(DEFAULT_DEFECT_TYPES);
  const [setupTypes, setSetupTypes] = useState<string[]>(DEFAULT_SETUP_TYPES);
  const [searchParams, setSearchParams] = useState<ProductionLogSearchParams>(emptySearch);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionLog | null>(null);
  const [form, setForm] = useState<ProductionLogInput>(emptyForm());
  const [updateProcessToProduction, setUpdateProcessToProduction] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, stat] = await Promise.all([
        fetchProductionLogs(searchParams),
        fetchProductionLogStats(),
      ]);
      setLogs(list);
      setStats(stat);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '생산일보 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchOrdersForProductionSelect()
      .then(setOrders)
      .catch(() => {});
    fetchActiveDefectTypes()
      .then((types) => setDefectTypes(types.length ? types : DEFAULT_DEFECT_TYPES))
      .catch(() => setDefectTypes(DEFAULT_DEFECT_TYPES));
    fetchActiveSetupTypes()
      .then((types) => setSetupTypes(types.length ? types : DEFAULT_SETUP_TYPES))
      .catch(() => setSetupTypes(DEFAULT_SETUP_TYPES));
  }, []);

  const updateSearch = (field: keyof ProductionLogSearchParams, value: string) => {
    setSearchParams((prev) => ({ ...prev, [field]: value }));
  };

  const updateField = <K extends keyof ProductionLogInput>(
    field: K,
    value: ProductionLogInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOrderSelect = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      updateField('order_id', orderId);
      return;
    }
    setForm((prev) => ({
      ...prev,
      order_id: order.id,
      work_order_id: getWorkOrderId(order),
      customer_name: order.customers?.customer_name ?? null,
      order_no: order.order_no,
      drawing_no: order.drawing_no,
      item_name: order.item_name,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setUpdateProcessToProduction(false);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = async (log: ProductionLog) => {
    setEditing(log);
    setFormError('');
    setModalOpen(true);
    try {
      const full = await fetchProductionLogById(log.id);
      setForm({
        order_id: full.order_id,
        work_order_id: full.work_order_id,
        work_date: full.work_date,
        worker_name: full.worker_name,
        department: full.department,
        equipment: full.equipment,
        customer_name: full.customer_name,
        order_no: full.order_no,
        drawing_no: full.drawing_no,
        item_name: full.item_name,
        processing_minutes: full.processing_minutes,
        production_quantity: full.production_quantity,
        defect_quantity: full.defect_quantity,
        defect_type: full.defect_type,
        defect_note: full.defect_note,
        setup_minutes: full.setup_minutes,
        setup_type: full.setup_type,
        note: full.note,
        special_note: full.special_note,
      });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '생산일보 정보를 불러오지 못했습니다.',
      );
    }
  };

  const handleSave = async () => {
    if (!form.order_id) {
      setFormError('수주/작업지시를 선택해 주세요.');
      return;
    }
    if (!form.worker_name?.trim()) {
      setFormError('작업자를 입력해 주세요.');
      return;
    }
    if (!form.work_date) {
      setFormError('작업일자를 입력해 주세요.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateProductionLog(editing.id, form, userEmail);
        setSuccessMsg('생산일보가 수정되었습니다.');
      } else {
        await createProductionLog(form, userEmail, {
          updateProcessToProduction,
        });
        setSuccessMsg('생산일보가 등록되었습니다.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        '이 생산일보를 삭제하시겠습니까? 수주 생산/불량 수량이 재계산됩니다.',
      )
    ) {
      return;
    }
    try {
      await deleteProductionLog(id, userEmail);
      setSuccessMsg('생산일보가 삭제되었습니다.');
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '삭제에 실패했습니다.',
      );
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">생산일보</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            + 생산일보 등록
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card primary">
          <div className="stat-label">오늘 등록건수</div>
          <div className="stat-value">{formatNumber(stats?.todayCount ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">오늘 가공시간(분)</div>
          <div className="stat-value">{formatNumber(stats?.todayMinutes ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">오늘 생산수량</div>
          <div className="stat-value">{formatNumber(stats?.todayProductionQty ?? 0)}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">오늘 불량수량</div>
          <div className="stat-value">{formatNumber(stats?.todayDefectQty ?? 0)}</div>
        </div>
      </div>

      <div className="search-bar">
        <div className="form-group">
          <label>작업일(부터)</label>
          <input
            type="date"
            value={searchParams.workDateFrom ?? ''}
            onChange={(e) => updateSearch('workDateFrom', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>작업일(까지)</label>
          <input
            type="date"
            value={searchParams.workDateTo ?? ''}
            onChange={(e) => updateSearch('workDateTo', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>작업자</label>
          <input
            placeholder="작업자명"
            value={searchParams.workerName ?? ''}
            onChange={(e) => updateSearch('workerName', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>설비</label>
          <input
            placeholder="설비명"
            value={searchParams.equipment ?? ''}
            onChange={(e) => updateSearch('equipment', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>고객사</label>
          <input
            placeholder="고객사명"
            value={searchParams.customerName ?? ''}
            onChange={(e) => updateSearch('customerName', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>발주번호</label>
          <input
            value={searchParams.orderNo ?? ''}
            onChange={(e) => updateSearch('orderNo', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>도번</label>
          <input
            value={searchParams.drawingNo ?? ''}
            onChange={(e) => updateSearch('drawingNo', e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" onClick={load}>
          검색
        </button>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-spinner">로딩 중...</div>
          ) : logs.length === 0 ? (
            <EmptyState message="등록된 생산일보가 없습니다." />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>작업일</th>
                    <th>작업자</th>
                    <th>부서</th>
                    <th>설비</th>
                    <th>고객사</th>
                    <th>발주번호</th>
                    <th>도번</th>
                    <th>품명</th>
                    <th>가공(분)</th>
                    <th>생산</th>
                    <th>불량</th>
                    <th>불량유형</th>
                    <th>세팅(분)</th>
                    <th>세팅유형</th>
                    <th>비고</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className={selectedId === log.id ? 'selected' : ''}
                      onClick={() => setSelectedId(log.id)}
                    >
                      <td>{log.work_date}</td>
                      <td>{log.worker_name}</td>
                      <td>{log.department ?? '-'}</td>
                      <td>{log.equipment ?? '-'}</td>
                      <td>{log.customer_name ?? '-'}</td>
                      <td>{log.order_no ?? '-'}</td>
                      <td>{log.drawing_no ?? '-'}</td>
                      <td>{log.item_name ?? '-'}</td>
                      <td>{formatNumber(log.processing_minutes)}</td>
                      <td>{formatNumber(log.production_quantity)}</td>
                      <td>{formatNumber(log.defect_quantity)}</td>
                      <td>{log.defect_type ?? '-'}</td>
                      <td>{formatNumber(log.setup_minutes)}</td>
                      <td>{log.setup_type ?? '-'}</td>
                      <td>{log.note ?? '-'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(log)}
                        >
                          수정
                        </button>{' '}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(log.id)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        title={editing ? '생산일보 수정' : '생산일보 등록'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              취소
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}

        <div className="form-grid cols-3">
          <div className="form-group full-width">
            <label>
              수주/작업지시 <span className="required">*</span>
            </label>
            <select
              value={form.order_id}
              onChange={(e) => handleOrderSelect(e.target.value)}
            >
              <option value="">선택 (발주번호 / 도번 / 품명)</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {orderSelectLabel(order)}
                </option>
              ))}
              {editing &&
                form.order_id &&
                !orders.some((o) => o.id === form.order_id) && (
                  <option value={form.order_id}>
                    {form.order_no ?? '-'} / {form.drawing_no ?? '-'} /{' '}
                    {form.item_name ?? '-'}
                  </option>
                )}
            </select>
          </div>
          <div className="form-group">
            <label>고객사</label>
            <input
              value={form.customer_name ?? ''}
              onChange={(e) => updateField('customer_name', e.target.value || null)}
            />
          </div>
          <div className="form-group">
            <label>발주번호</label>
            <input
              value={form.order_no ?? ''}
              onChange={(e) => updateField('order_no', e.target.value || null)}
            />
          </div>
          <div className="form-group">
            <label>도번</label>
            <input
              value={form.drawing_no ?? ''}
              onChange={(e) => updateField('drawing_no', e.target.value || null)}
            />
          </div>
          <div className="form-group">
            <label>품명</label>
            <input
              value={form.item_name ?? ''}
              onChange={(e) => updateField('item_name', e.target.value || null)}
            />
          </div>
          <div className="form-group">
            <label>
              작업일자 <span className="required">*</span>
            </label>
            <input
              type="date"
              value={form.work_date}
              onChange={(e) => updateField('work_date', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>
              작업자 <span className="required">*</span>
            </label>
            <input
              value={form.worker_name}
              onChange={(e) => updateField('worker_name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>부서</label>
            <input
              value={form.department ?? ''}
              onChange={(e) => updateField('department', e.target.value || null)}
            />
          </div>
          <div className="form-group">
            <label>설비</label>
            <input
              value={form.equipment ?? ''}
              onChange={(e) => updateField('equipment', e.target.value || null)}
            />
          </div>
          <div className="form-group">
            <label>가공시간(분)</label>
            <NumericInput
              value={Number(form.processing_minutes)}
              onChange={(n) => updateField('processing_minutes', n)}
            />
          </div>
          <div className="form-group">
            <label>생산수량</label>
            <NumericInput
              value={Number(form.production_quantity)}
              onChange={(n) => updateField('production_quantity', n)}
            />
          </div>
          <div className="form-group">
            <label>불량수량</label>
            <NumericInput
              value={Number(form.defect_quantity)}
              onChange={(n) => updateField('defect_quantity', n)}
            />
          </div>
          <div className="form-group">
            <label>불량유형</label>
            <select
              value={form.defect_type ?? ''}
              onChange={(e) =>
                updateField('defect_type', e.target.value || null)
              }
            >
              <option value="">선택</option>
              {defectTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>불량내용</label>
            <input
              value={form.defect_note ?? ''}
              onChange={(e) => updateField('defect_note', e.target.value || null)}
            />
          </div>
          <div className="form-group">
            <label>세팅시간(분)</label>
            <NumericInput
              value={Number(form.setup_minutes)}
              onChange={(n) => updateField('setup_minutes', n)}
            />
          </div>
          <div className="form-group">
            <label>세팅유형</label>
            <select
              value={form.setup_type ?? ''}
              onChange={(e) => updateField('setup_type', e.target.value || null)}
            >
              <option value="">선택</option>
              {setupTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group full-width">
            <label>비고</label>
            <input
              value={form.note ?? ''}
              onChange={(e) => updateField('note', e.target.value || null)}
            />
          </div>
          <div className="form-group full-width">
            <label>특이사항</label>
            <input
              value={form.special_note ?? ''}
              onChange={(e) => updateField('special_note', e.target.value || null)}
            />
          </div>
          {!editing && (
            <div className="form-group full-width">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={updateProcessToProduction}
                  onChange={(e) => setUpdateProcessToProduction(e.target.checked)}
                />
                생산 공정으로 변경
              </label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
