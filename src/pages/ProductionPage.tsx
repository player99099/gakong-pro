import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ORDER_STATUSES, PROCESS_STATUSES } from '../lib/constants';
import { formatNumber } from '../lib/formatNumber';
import {
  changeProcessStatus,
  fetchProcessLogs,
  fetchProductionStats,
  fetchProductionTargets,
} from '../services/production';
import type {
  ProcessLog,
  ProcessStatus,
  ProductionSearchParams,
  ProductionStats,
  ProductionTarget,
} from '../types';
import { OrderStatusBadge, ProcessStatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

const emptySearch: ProductionSearchParams = {
  processStatus: '',
  orderStatus: '',
  customerName: '',
  orderNo: '',
  drawingNo: '',
  itemName: '',
  dueDateFrom: '',
  dueDateTo: '',
};

export function ProductionPage() {
  const { userEmail } = useAuth();
  const [targets, setTargets] = useState<ProductionTarget[]>([]);
  const [stats, setStats] = useState<ProductionStats | null>(null);
  const [searchParams, setSearchParams] = useState<ProductionSearchParams>(emptySearch);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<ProductionTarget | null>(null);
  const [toStatus, setToStatus] = useState<ProcessStatus>('수주접수');
  const [statusMemo, setStatusMemo] = useState('');
  const [processLogs, setProcessLogs] = useState<ProcessLog[]>([]);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, stat] = await Promise.all([
        fetchProductionTargets(searchParams),
        fetchProductionStats(),
      ]);
      setTargets(list);
      setStats(stat);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '생산 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  const openStatusModal = (target: ProductionTarget) => {
    setSelectedTarget(target);
    setToStatus(target.process_status);
    setStatusMemo('');
    setFormError('');
    setStatusModalOpen(true);
  };

  const openHistoryModal = async (target: ProductionTarget) => {
    setSelectedTarget(target);
    setFormError('');
    setHistoryModalOpen(true);
    setLogsLoading(true);
    try {
      const logs = await fetchProcessLogs(target.id);
      setProcessLogs(logs);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '이력을 불러오지 못했습니다.',
      );
      setProcessLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedTarget) return;
    setSaving(true);
    setFormError('');
    try {
      await changeProcessStatus(
        selectedTarget.id,
        toStatus,
        statusMemo,
        userEmail,
      );
      setSuccessMsg('공정상태가 변경되었습니다.');
      setStatusModalOpen(false);
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '상태 변경에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateSearch = (field: keyof ProductionSearchParams, value: string) => {
    setSearchParams((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">생산관리</h1>
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
          <div className="stat-label">수주접수</div>
          <div className="stat-value">{formatNumber(stats?.received ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">도면배포</div>
          <div className="stat-value">{formatNumber(stats?.drawingDeploy ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">생산</div>
          <div className="stat-value">{formatNumber(stats?.production ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">후처리</div>
          <div className="stat-value">{formatNumber(stats?.postProcess ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">출하검사</div>
          <div className="stat-value">{formatNumber(stats?.shipInspect ?? 0)}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">출하대기</div>
          <div className="stat-value">{formatNumber(stats?.readyToShip ?? 0)}</div>
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
          <label>수주상태</label>
          <select
            value={searchParams.orderStatus ?? ''}
            onChange={(e) => updateSearch('orderStatus', e.target.value)}
          >
            <option value="">전체</option>
            {ORDER_STATUSES.map((s) => (
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
          <label>품명</label>
          <input
            value={searchParams.itemName ?? ''}
            onChange={(e) => updateSearch('itemName', e.target.value)}
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
          ) : targets.length === 0 ? (
            <EmptyState message="생산 대상 수주가 없습니다." />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>공정상태</th>
                    <th>수주상태</th>
                    <th>고객사</th>
                    <th>발주번호</th>
                    <th>도번</th>
                    <th>품명</th>
                    <th>수주수량</th>
                    <th>생산수량</th>
                    <th>불량수량</th>
                    <th>납품수량</th>
                    <th>잔량</th>
                    <th>납기일</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target) => (
                    <tr
                      key={target.id}
                      className={selectedId === target.id ? 'selected' : ''}
                      onClick={() => setSelectedId(target.id)}
                    >
                      <td>
                        <ProcessStatusBadge status={target.process_status} />
                      </td>
                      <td>
                        <OrderStatusBadge status={target.order_status} />
                      </td>
                      <td>{target.customers?.customer_name ?? '-'}</td>
                      <td>{target.order_no ?? '-'}</td>
                      <td>{target.drawing_no ?? '-'}</td>
                      <td>{target.item_name ?? '-'}</td>
                      <td>{formatNumber(target.order_quantity)}</td>
                      <td>{formatNumber(target.produced_quantity ?? 0)}</td>
                      <td>{formatNumber(target.defect_quantity ?? 0)}</td>
                      <td>{formatNumber(target.delivered_quantity ?? 0)}</td>
                      <td>{formatNumber(target.remaining_quantity ?? 0)}</td>
                      <td>{target.due_date ?? '-'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openStatusModal(target)}
                        >
                          상태변경
                        </button>{' '}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openHistoryModal(target)}
                        >
                          이력보기
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
        title="공정상태 변경"
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setStatusModalOpen(false)}
            >
              취소
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStatusChange}
              disabled={saving}
            >
              {saving ? '변경 중...' : '변경'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        {selectedTarget && (
          <div className="form-grid cols-2">
            <div className="form-group">
              <label>발주번호</label>
              <input
                value={selectedTarget.order_no ?? ''}
                readOnly
                style={{ background: '#f4f7fb' }}
              />
            </div>
            <div className="form-group">
              <label>현재 공정상태</label>
              <input
                value={selectedTarget.process_status}
                readOnly
                style={{ background: '#f4f7fb' }}
              />
            </div>
            <div className="form-group">
              <label>
                변경 공정상태 <span className="required">*</span>
              </label>
              <select
                value={toStatus}
                onChange={(e) => setToStatus(e.target.value as ProcessStatus)}
              >
                {PROCESS_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group full-width">
              <label>메모</label>
              <textarea
                value={statusMemo}
                onChange={(e) => setStatusMemo(e.target.value)}
                placeholder="상태 변경 사유를 입력하세요"
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="공정 변경 이력"
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        size="lg"
        footer={
          <button
            className="btn btn-secondary"
            onClick={() => setHistoryModalOpen(false)}
          >
            닫기
          </button>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        {selectedTarget && (
          <div style={{ marginBottom: 12, fontSize: 14, color: 'var(--color-text-muted)' }}>
            {selectedTarget.order_no ?? '-'} / {selectedTarget.drawing_no ?? '-'} /{' '}
            {selectedTarget.item_name ?? '-'}
          </div>
        )}
        {logsLoading ? (
          <div className="loading-spinner">로딩 중...</div>
        ) : processLogs.length === 0 ? (
          <EmptyState message="공정 변경 이력이 없습니다." />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>변경일시</th>
                  <th>이전상태</th>
                  <th>변경상태</th>
                  <th>메모</th>
                  <th>변경자</th>
                </tr>
              </thead>
              <tbody>
                {processLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      {log.changed_at
                        ? new Date(log.changed_at).toLocaleString('ko-KR')
                        : '-'}
                    </td>
                    <td>{log.from_status ?? '-'}</td>
                    <td>
                      <ProcessStatusBadge status={log.to_status} />
                    </td>
                    <td>{log.memo ?? '-'}</td>
                    <td>{log.changed_by ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
