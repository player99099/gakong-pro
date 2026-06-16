import { Modal } from './ui/Modal';
import { useDragReorder } from '../hooks/useDragReorder';
import { reorderIds } from '../lib/reorderIds';
import type { WorkOrder } from '../types';

interface WorkOrderPrintOrderModalProps {
  open: boolean;
  orderIds: string[];
  workOrders: WorkOrder[];
  printing: boolean;
  onClose: () => void;
  onOrderChange: (ids: string[]) => void;
  onConfirm: () => void;
}

function resolveOrderRows(orderIds: string[], workOrders: WorkOrder[]): WorkOrder[] {
  const byId = new Map(workOrders.map((wo) => [wo.id, wo]));
  return orderIds.map((id) => byId.get(id)).filter((wo): wo is WorkOrder => !!wo);
}

export function WorkOrderPrintOrderModal({
  open,
  orderIds,
  workOrders,
  printing,
  onClose,
  onOrderChange,
  onConfirm,
}: WorkOrderPrintOrderModalProps) {
  const rows = resolveOrderRows(orderIds, workOrders);
  const { bindRow } = useDragReorder(printing);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    onOrderChange(reorderIds(orderIds, fromIndex, toIndex));
  };

  return (
    <Modal
      title="출력 순서 확인"
      open={open}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={printing}>
            취소
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={printing || rows.length === 0}
          >
            {printing ? '출력 준비…' : `이 순서로 출력 (${rows.length}건)`}
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--text-muted)' }}>
        아래 순서대로 Excel 시트가 배치됩니다. 행을 드래그해서 순서를 변경한 뒤 출력하세요.
      </p>
      <div className="table-wrapper">
        <table className="data-table print-order-table">
          <thead>
            <tr>
              <th style={{ width: 36 }} aria-label="순서 변경" />
              <th style={{ width: 48 }}>순서</th>
              <th>고객사</th>
              <th>발주번호</th>
              <th>도번</th>
              <th>품명</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((wo, index) => (
              <tr key={wo.id} {...bindRow(index, handleReorder)}>
                <td className="print-order-handle" title="드래그하여 순서 변경">
                  <span aria-hidden="true">≡</span>
                </td>
                <td>{index + 1}</td>
                <td>{wo.customers?.customer_name ?? '-'}</td>
                <td>{wo.order_no ?? '-'}</td>
                <td>{wo.drawing_no ?? '-'}</td>
                <td>{wo.item_name ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
