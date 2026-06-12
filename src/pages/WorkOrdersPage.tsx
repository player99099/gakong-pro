import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PROCESS_STATUSES } from '../lib/constants';
import {
  createWorkOrderFromOrder,
  deleteWorkOrder,
  fetchOrdersWithoutWorkOrder,
  fetchWorkOrderById,
  fetchWorkOrders,
  fetchWorkOrderStats,
  updateWorkOrder,
} from '../services/workOrders';
import type {
  Order,
  ProcessStatus,
  WorkOrder,
  WorkOrderSearchParams,
  WorkOrderStats,
} from '../types';
import { ProcessStatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

const emptySearch: WorkOrderSearchParams = {
  processStatus: '',
  customerName: '',
  orderNo: '',
  drawingNo: '',
  dueDateFrom: '',
  dueDateTo: '',
};

interface EditForm {
  instruction_memo: string;
  drawing_file_name: string;
  process_status: ProcessStatus;
}

export function WorkOrdersPage() {
  const { userEmail } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<WorkOrderStats | null>(null);
  const [searchParams, setSearchParams] = useState<WorkOrderSearchParams>(emptySearch);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [ordersWithoutWo, setOrdersWithoutWo] = useState<Order[]>([]);
  const [editing, setEditing] = useState<WorkOrder | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    instruction_memo: '',
    drawing_file_name: '',
    process_status: '수주접수',
  });
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, stat] = await Promise.all([
        fetchWorkOrders(searchParams),
        fetchWorkOrderStats(),
      ]);
      setWorkOrders(list);
      setStats(stat);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '작업지시 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreateModal = async () => {
    setFormError('');
    setCreateModalOpen(true);
    try {
      const orders = await fetchOrdersWithoutWorkOrder();
      setOrdersWithoutWo(orders);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '수주 목록을 불러오지 못했습니다.',
      );
    }
  };

  const handleCreateFromOrder = async (orderId: string) => {
    setCreating(true);
    setFormError('');
    try {
      await createWorkOrderFromOrder(orderId, userEmail);
      setSuccessMsg('작업지시가 생성되었습니다.');
      setCreateModalOpen(false);
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '작업지시 생성에 실패했습니다.',
      );
    } finally {
      setCreating(false);
    }
  };

  const openEdit = async (wo: WorkOrder) => {
    setEditing(wo);
    setFormError('');
    setEditModalOpen(true);
    try {
      const full = await fetchWorkOrderById(wo.id);
      setEditForm({
        instruction_memo: full.instruction_memo ?? '',
        drawing_file_name: full.drawing_file_name ?? '',
        process_status: full.process_status,
      });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '작업지시 정보를 불러오지 못했습니다.',
      );
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setFormError('');
    try {
      await updateWorkOrder(
        editing.id,
        {
          instruction_memo: editForm.instruction_memo || null,
          drawing_file_name: editForm.drawing_file_name || null,
          process_status: editForm.process_status,
        },
        userEmail,
      );
      setSuccessMsg('작업지시가 수정되었습니다.');
      setEditModalOpen(false);
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
    if (!confirm('이 작업지시를 삭제하시겠습니까?')) return;
    try {
      await deleteWorkOrder(id);
      setSuccessMsg('작업지시가 삭제되었습니다.');
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '삭제에 실패했습니다.',
      );
    }
  };

  const handlePrint = () => {
    alert('출력 기능은 다음 단계에서 구현 예정입니다.');
  };

  const updateSearch = (field: keyof WorkOrderSearchParams, value: string) => {
    setSearchParams((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">작업지시</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreateModal}>
            + 수주에서 작업지시 생성
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && (
        <div className="alert alert-success">{successMsg}</div>
      )}

      <div
        className="stats-grid"
        style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}
      >
        <div className="stat-card primary">
          <div className="stat-label">전체</div>
          <div className="stat-value">{stats?.total ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">도면배포</div>
          <div className="stat-value">{stats?.drawingDeploy ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">생산</div>
          <div className="stat-value">{stats?.production ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">후처리</div>
          <div className="stat-value">{stats?.postProcess ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">출하검사</div>
          <div className="stat-value">{stats?.shipInspect ?? 0}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">출하대기</div>
          <div className="stat-value">{stats?.readyToShip ?? 0}</div>
        </div>
      </div>

      <div className="search-bar">
        <div className="form-group">
          <label>공정상태</label>
          <select
            value={searchParams.processStatus ?? ''}
            onChange={(e) => updateSearch('processStatus', e.target.value)}
          >
            <option value="">전체</option>
            {PROCESS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
        <div className="form-group">
          <label>납기일(부터)</label>
          <input
            type="date"
            value={searchParams.dueDateFrom ?? ''}
            onChange={(e) => updateSearch('dueDateFrom', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>납기일(까지)</label>
          <input
            type="date"
            value={searchParams.dueDateTo ?? ''}
            onChange={(e) => updateSearch('dueDateTo', e.target.value)}
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
          ) : workOrders.length === 0 ? (
            <EmptyState message="등록된 작업지시가 없습니다." />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>공정상태</th>
                    <th>고객사</th>
                    <th>발주번호</th>
                    <th>도번</th>
                    <th>품명</th>
                    <th>수량</th>
                    <th>납기일</th>
                    <th>지시메모</th>
                    <th>도면파일명</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((wo) => (
                    <tr
                      key={wo.id}
                      className={selectedId === wo.id ? 'selected' : ''}
                      onClick={() => setSelectedId(wo.id)}
                    >
                      <td>
                        <ProcessStatusBadge status={wo.process_status} />
                      </td>
                      <td>{wo.customers?.customer_name ?? '-'}</td>
                      <td>{wo.order_no ?? '-'}</td>
                      <td>{wo.drawing_no ?? '-'}</td>
                      <td>{wo.item_name ?? '-'}</td>
                      <td>{wo.order_quantity}</td>
                      <td>{wo.due_date ?? '-'}</td>
                      <td>{wo.instruction_memo ?? '-'}</td>
                      <td>{wo.drawing_file_name ?? '-'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(wo)}
                        >
                          수정
                        </button>{' '}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(wo.id)}
                        >
                          삭제
                        </button>{' '}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={handlePrint}
                        >
                          공정이동표 출력
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
        title="수주에서 작업지시 생성"
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        size="lg"
        footer={
          <button
            className="btn btn-secondary"
            onClick={() => setCreateModalOpen(false)}
          >
            닫기
          </button>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        {ordersWithoutWo.length === 0 ? (
          <EmptyState
            message="작업지시를 생성할 수주가 없습니다."
            subMessage="모든 수주에 작업지시가 이미 생성되었거나 취소된 수주만 있습니다."
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>고객사</th>
                  <th>발주번호</th>
                  <th>도번</th>
                  <th>품명</th>
                  <th>수량</th>
                  <th>납기일</th>
                  <th>공정상태</th>
                  <th>선택</th>
                </tr>
              </thead>
              <tbody>
                {ordersWithoutWo.map((order) => (
                  <tr key={order.id}>
                    <td>{order.customers?.customer_name ?? '-'}</td>
                    <td>{order.order_no ?? '-'}</td>
                    <td>{order.drawing_no ?? '-'}</td>
                    <td>{order.item_name ?? '-'}</td>
                    <td>{order.order_quantity}</td>
                    <td>{order.due_date ?? '-'}</td>
                    <td>
                      <ProcessStatusBadge status={order.process_status} />
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={creating}
                        onClick={() => handleCreateFromOrder(order.id)}
                      >
                        {creating ? '생성 중...' : '생성'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        title="작업지시 수정"
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setEditModalOpen(false)}
            >
              취소
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        <div className="form-grid cols-2">
          <div className="form-group">
            <label>공정상태</label>
            <select
              value={editForm.process_status}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  process_status: e.target.value as ProcessStatus,
                }))
              }
            >
              {PROCESS_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>도면파일명</label>
            <input
              value={editForm.drawing_file_name}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  drawing_file_name: e.target.value,
                }))
              }
            />
          </div>
          <div className="form-group full-width">
            <label>지시메모</label>
            <textarea
              value={editForm.instruction_memo}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  instruction_memo: e.target.value,
                }))
              }
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
