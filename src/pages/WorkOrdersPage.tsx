import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resolveWorkOrderPageError } from '../lib/formatAppError';
import { PROCESS_STATUSES } from '../lib/constants';
import { formatNumber } from '../lib/formatNumber';
import {
  mergeDisplayOrder,
  mergeSelectedOrderIntoDisplay,
  reorderIds,
  sortByIdOrder,
  sortSelectedByDisplayOrder,
} from '../lib/reorderIds';
import { useDragReorder } from '../hooks/useDragReorder';
import {
  createWorkOrderFromOrder,
  deleteWorkOrder,
  fetchOrdersWithoutWorkOrder,
  fetchWorkOrderPrintData,
  fetchWorkOrders,
  fetchWorkOrderStats,
  incrementWorkOrderPrintCounts,
} from '../services/workOrders';
import { getDefaultPrintTemplate, isExcelPrintTemplate } from '../services/printTemplates';
import { buildProcessTravelerContext } from '../lib/print/resolveBindValue';
import { downloadBlob } from '../lib/downloadBlob';
import {
  buildBatchTravelerFilename,
  buildTravelerFilename,
  EXCEL_BATCH_PRINT_GUIDE,
  EXCEL_PRINT_GUIDE,
  fillExcelBatchToBlob,
  fillExcelTemplateToBlob,
} from '../services/excelTemplateFill';
import { PrintPreviewModal } from '../components/print/PrintPreviewModal';
import { WorkOrderPrintOrderModal } from '../components/WorkOrderPrintOrderModal';
import type { PrintContext, PrintLayout } from '../types/printTemplate';
import type {
  Order,
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

export function WorkOrdersPage() {
  const { userEmail } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<WorkOrderStats | null>(null);
  const [searchParams, setSearchParams] = useState<WorkOrderSearchParams>(emptySearch);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string[]>([]);
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [printOrderModalOpen, setPrintOrderModalOpen] = useState(false);
  const [ordersWithoutWo, setOrdersWithoutWo] = useState<Order[]>([]);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printLayout, setPrintLayout] = useState<PrintLayout | null>(null);
  const [printContext, setPrintContext] = useState<PrintContext>({});
  const [printTitle, setPrintTitle] = useState('공정이동표');
  const [printCountPendingId, setPrintCountPendingId] = useState<string | null>(null);

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
        resolveWorkOrderPageError(err, '작업지시 목록을 불러오지 못했습니다.'),
      );
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  const { bindRow: bindDisplayRow } = useDragReorder(loading);

  const sortedWorkOrders = useMemo(
    () => sortByIdOrder(workOrders, displayOrder),
    [workOrders, displayOrder],
  );

  useEffect(() => {
    setDisplayOrder((prev) => mergeDisplayOrder(prev, workOrders.map((wo) => wo.id)));
  }, [workOrders]);

  const allVisibleSelected =
    sortedWorkOrders.length > 0 &&
    sortedWorkOrders.every((wo) => selectedOrder.includes(wo.id));

  const handleDisplayReorder = (fromIndex: number, toIndex: number) => {
    setDisplayOrder((prev) => {
      const next = reorderIds(prev, fromIndex, toIndex);
      setSelectedOrder((selected) => sortSelectedByDisplayOrder(next, selected));
      return next;
    });
  };

  const handleSelectedOrderChange = (ids: string[]) => {
    setSelectedOrder(ids);
    setDisplayOrder((prev) => mergeSelectedOrderIntoDisplay(prev, ids));
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedOrder((prev) => {
      if (checked) {
        const next = prev.includes(id) ? prev : [...prev, id];
        return sortSelectedByDisplayOrder(displayOrder, next);
      }
      return prev.filter((x) => x !== id);
    });
  };

  const toggleSelectAll = () => {
    const visibleIds = new Set(sortedWorkOrders.map((w) => w.id));
    if (allVisibleSelected) {
      setSelectedOrder((prev) => prev.filter((id) => !visibleIds.has(id)));
      return;
    }
    setSelectedOrder((prev) => {
      const outside = prev.filter((id) => !visibleIds.has(id));
      const visible = displayOrder.filter((id) => visibleIds.has(id));
      return [...outside, ...visible];
    });
  };

  const openCreateModal = async () => {
    setFormError('');
    setCreateModalOpen(true);
    try {
      const orders = await fetchOrdersWithoutWorkOrder();
      setOrdersWithoutWo(orders);
    } catch (err) {
      setFormError(
        resolveWorkOrderPageError(err, '수주 목록을 불러오지 못했습니다.'),
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
        resolveWorkOrderPageError(err, '작업지시 생성에 실패했습니다.'),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 작업지시를 삭제하시겠습니까?')) return;
    try {
      await deleteWorkOrder(id);
      setSuccessMsg('작업지시가 삭제되었습니다.');
      if (selectedId === id) setSelectedId(null);
      setSelectedOrder((prev) => prev.filter((x) => x !== id));
      setDisplayOrder((prev) => prev.filter((x) => x !== id));
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '삭제에 실패했습니다.',
      );
    }
  };

  const markPrinted = async (ids: string[]) => {
    await incrementWorkOrderPrintCounts(ids, userEmail);
    await load();
  };

  const handlePrint = async (wo: WorkOrder) => {
    setExportingId(wo.id);
    setError('');
    try {
      const [printData, template] = await Promise.all([
        fetchWorkOrderPrintData(wo.id),
        getDefaultPrintTemplate('process_traveler'),
      ]);
      const context = buildProcessTravelerContext({
        ...printData,
        process_status: wo.process_status,
      });

      if (!isExcelPrintTemplate(template)) {
        setPrintCountPendingId(wo.id);
        setPrintOpen(true);
        setPrintLayout(template.layout_json);
        setPrintContext(context);
        setPrintTitle(`공정이동표 — ${wo.drawing_no ?? wo.order_no ?? ''}`);
        return;
      }

      const blob = await fillExcelTemplateToBlob(template, context);
      downloadBlob(blob, `${buildTravelerFilename(context)}.xlsx`);
      await markPrinted([wo.id]);
      alert(EXCEL_PRINT_GUIDE);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '공정이동표 출력에 실패했습니다.';
      setError(message);
      alert(message);
    } finally {
      setExportingId(null);
    }
  };

  const handlePrintPreviewClose = () => {
    setPrintOpen(false);
    setPrintCountPendingId(null);
  };

  const openBatchPrint = () => {
    if (selectedOrder.length === 0) return;
    setPrintOrderModalOpen(true);
  };

  const handleBatchPrintConfirm = async () => {
    if (selectedOrder.length === 0) return;
    setBatchPrinting(true);
    setError('');
    try {
      const template = await getDefaultPrintTemplate('process_traveler');
      if (!isExcelPrintTemplate(template)) {
        alert('일괄 출력은 Excel 양식만 지원합니다.');
        return;
      }

      const byId = new Map(workOrders.map((wo) => [wo.id, wo]));
      const orderedIds = selectedOrder.filter((id) => byId.has(id));
      const contexts: PrintContext[] = [];

      for (const id of orderedIds) {
        const wo = byId.get(id)!;
        const printData = await fetchWorkOrderPrintData(id);
        contexts.push(
          buildProcessTravelerContext({
            ...printData,
            process_status: wo.process_status,
          }),
        );
      }

      const blob = await fillExcelBatchToBlob(template, contexts);
      downloadBlob(blob, `${buildBatchTravelerFilename(orderedIds.length)}.xlsx`);
      await markPrinted(orderedIds);
      alert(EXCEL_BATCH_PRINT_GUIDE);
      setPrintOrderModalOpen(false);
      setSelectedOrder([]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '일괄 출력 준비에 실패했습니다.';
      setError(message);
      alert(message);
    } finally {
      setBatchPrinting(false);
    }
  };

  const updateSearch = (field: keyof WorkOrderSearchParams, value: string) => {
    setSearchParams((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">작업지시</h1>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={openBatchPrint}
            disabled={selectedOrder.length === 0}
            title={selectedOrder.length === 0 ? '출력할 항목을 체크하세요' : undefined}
          >
            선택 출력{selectedOrder.length > 0 ? ` (${selectedOrder.length})` : ''}
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}>
            + 수주에서 작업지시 생성
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon">!</span>
          <span className="alert-text" style={{ whiteSpace: 'pre-wrap' }}>
            {error}
          </span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success">{successMsg}</div>
      )}

      <div
        className="stats-grid"
        style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}
      >
        <div className="stat-card primary">
          <div className="stat-label">전체</div>
          <div className="stat-value">{formatNumber(stats?.total ?? 0)}</div>
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
        {!loading && workOrders.length > 0 && (
          <div className="card-hint" style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
            ≡ 드래그로 출력 순서를 정한 뒤 체크하고 「선택 출력」하세요. 모달에서도 순서를 다시 조정할 수 있습니다.
          </div>
        )}
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-spinner">로딩 중...</div>
          ) : workOrders.length === 0 ? (
            <EmptyState message="등록된 작업지시가 없습니다." />
          ) : (
            <div className="table-wrapper">
              <table className="data-table print-order-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }} aria-label="순서 변경" />
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        title="현재 목록 전체 선택"
                      />
                    </th>
                    <th style={{ width: 52 }}>출력순</th>
                    <th>공정상태</th>
                    <th>고객사</th>
                    <th>발주번호</th>
                    <th>도번</th>
                    <th>품명</th>
                    <th>수량</th>
                    <th>납기일</th>
                    <th>출력횟수</th>
                    <th>지시메모</th>
                    <th>도면파일명</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWorkOrders.map((wo, index) => {
                    const printOrderIndex = selectedOrder.indexOf(wo.id);
                    const { className: dragClassName, ...dragRowProps } = bindDisplayRow(
                      index,
                      handleDisplayReorder,
                    );
                    return (
                    <tr
                      key={wo.id}
                      {...dragRowProps}
                      className={[dragClassName, selectedId === wo.id ? 'selected' : '']
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setSelectedId(wo.id)}
                    >
                      <td className="print-order-handle" title="드래그하여 순서 변경">
                        <span aria-hidden="true">≡</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedOrder.includes(wo.id)}
                          onChange={(e) => toggleSelect(wo.id, e.target.checked)}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {printOrderIndex >= 0 ? printOrderIndex + 1 : '-'}
                      </td>
                      <td>
                        <ProcessStatusBadge status={wo.process_status} />
                      </td>
                      <td>{wo.customers?.customer_name ?? '-'}</td>
                      <td>{wo.order_no ?? '-'}</td>
                      <td>{wo.drawing_no ?? '-'}</td>
                      <td>{wo.item_name ?? '-'}</td>
                      <td>{formatNumber(wo.order_quantity)}</td>
                      <td>{wo.due_date ?? '-'}</td>
                      <td>{formatNumber(wo.print_count ?? 0)}</td>
                      <td>{wo.instruction_memo ?? '-'}</td>
                      <td>{wo.drawing_file_name ?? '-'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(wo.id)}
                        >
                          삭제
                        </button>{' '}
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={exportingId === wo.id}
                          onClick={() => void handlePrint(wo)}
                        >
                          {exportingId === wo.id ? '출력 준비…' : '공정이동표 출력'}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
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
        {formError && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">!</span>
            <span className="alert-text" style={{ whiteSpace: 'pre-wrap' }}>
              {formError}
            </span>
          </div>
        )}
        {formError ? null : ordersWithoutWo.length === 0 ? (
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
                    <td>{formatNumber(order.order_quantity)}</td>
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

      <WorkOrderPrintOrderModal
        open={printOrderModalOpen}
        orderIds={selectedOrder}
        workOrders={workOrders}
        printing={batchPrinting}
        onClose={() => setPrintOrderModalOpen(false)}
        onOrderChange={handleSelectedOrderChange}
        onConfirm={() => void handleBatchPrintConfirm()}
      />

      <PrintPreviewModal
        open={printOpen}
        onClose={handlePrintPreviewClose}
        title={printTitle}
        layout={printLayout ?? { version: 1, pages: [] }}
        context={printContext}
        loading={!printLayout}
        onPrinted={
          printCountPendingId
            ? () => void markPrinted([printCountPendingId])
            : undefined
        }
      />
    </div>
  );
}
