import type { Dispatch, SetStateAction } from 'react';
import type { DrawingCandidate } from '../../services/items';
import type { OrderInput } from '../../services/orders';
import type { Customer } from '../../types';
import { Modal } from '../ui/Modal';
import { OrderFormFields } from './OrderFormFields';

interface OrderFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  form: OrderInput;
  customerName: string;
  customers: Customer[];
  customerDatalistId: string;
  formError: string;
  saving: boolean;
  seqLookupLoading: boolean;
  onFormChange: Dispatch<SetStateAction<OrderInput>>;
  onCustomerChange: (name: string) => void;
  onClose: () => void;
  onSave: () => void;
  onSeqLookup: () => void;
  onDrawingBlur: (drawingNo: string) => void;
  onDrawingSelect: (candidate: DrawingCandidate) => void;
  onUnitPriceBlur: (unitPrice: number) => void;
}

export function OrderFormModal({
  open,
  mode,
  form,
  customerName,
  customers,
  customerDatalistId,
  formError,
  saving,
  seqLookupLoading,
  onFormChange,
  onCustomerChange,
  onClose,
  onSave,
  onSeqLookup,
  onDrawingBlur,
  onDrawingSelect,
  onUnitPriceBlur,
}: OrderFormModalProps) {
  const title = mode === 'create' ? '수주 추가' : '수주 수정';

  return (
    <Modal
      title={title}
      open={open}
      onClose={onClose}
      resizable
      initialWidth={920}
      initialHeight={580}
      minWidth={640}
      minHeight={400}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving || seqLookupLoading}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </>
      }
    >
      {formError && (
        <div className="alert alert-error order-form-modal-alert" role="alert">
          <span className="alert-icon" aria-hidden="true">
            !
          </span>
          <span className="alert-text" style={{ whiteSpace: 'pre-wrap' }}>
            {formError}
          </span>
        </div>
      )}

      <OrderFormFields
        form={form}
        customerName={customerName}
        customers={customers}
        customerDatalistId={customerDatalistId}
        seqLookupLoading={seqLookupLoading}
        onFormChange={onFormChange}
        onCustomerChange={onCustomerChange}
        onSeqLookup={onSeqLookup}
        onDrawingBlur={onDrawingBlur}
        onDrawingSelect={onDrawingSelect}
        onUnitPriceBlur={onUnitPriceBlur}
      />
    </Modal>
  );
}
