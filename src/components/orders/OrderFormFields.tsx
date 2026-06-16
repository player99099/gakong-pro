import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { ORDER_MANUAL_STATUSES } from '../../lib/constants';
import { formatNumber } from '../../lib/formatNumber';
import { patchForm } from '../../lib/orderForm';
import type { OrderInput } from '../../services/orders';
import type { Customer, OrderStatus } from '../../types';
import { NumericInput } from '../ui/NumericInput';
import { ItemDrawingCombobox } from './ItemDrawingCombobox';
import type { DrawingCandidate } from '../../services/items';

export interface OrderFormFieldsProps {
  form: OrderInput;
  customerName: string;
  customers: Customer[];
  readonly?: boolean;
  seqLookupLoading?: boolean;
  customerDatalistId: string;
  onFormChange: Dispatch<SetStateAction<OrderInput>>;
  onCustomerChange: (name: string) => void;
  onSeqLookup?: () => void;
  onDrawingBlur?: (drawingNo: string) => void;
  onDrawingSelect?: (candidate: DrawingCandidate) => void;
  onUnitPriceBlur?: (unitPrice: number) => void;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="order-form-field-label">{children}</div>;
}

function ReadonlyValue({ value }: { value: string }) {
  return <div className="order-form-readonly">{value || '-'}</div>;
}

function StatusSelect({
  value,
  readonly,
  onChange,
}: {
  value: OrderStatus;
  readonly?: boolean;
  onChange: (v: OrderStatus) => void;
}) {
  if (readonly) {
    return <ReadonlyValue value={value} />;
  }

  const isManual = ORDER_MANUAL_STATUSES.includes(value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as OrderStatus)}
    >
      {!isManual && <option value={value}>{value}</option>}
      {ORDER_MANUAL_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function OrderFormFields({
  form,
  customerName,
  customers,
  readonly = false,
  seqLookupLoading,
  customerDatalistId,
  onFormChange,
  onCustomerChange,
  onSeqLookup,
  onDrawingBlur,
  onDrawingSelect,
  onUnitPriceBlur,
}: OrderFormFieldsProps) {
  const set = (field: keyof OrderInput, value: string | number | null) => {
    if (readonly) return;
    onFormChange((prev) => patchForm(prev, field, value));
  };

  return (
    <div className="order-form-layout">
      <div className="order-form-section">
        <div className="order-form-section-label">일정 · 상태</div>
        <div className="order-form-grid-4">
          <div className="order-form-field">
            <FieldLabel>순번</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.seq_no ?? ''} />
            ) : (
              <div className="order-form-seq-row">
                <input
                  type="text"
                  placeholder="순번"
                  value={form.seq_no ?? ''}
                  onChange={(e) => set('seq_no', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSeqLookup?.();
                    }
                  }}
                  disabled={seqLookupLoading}
                />
                <button
                  type="button"
                  className="order-form-seq-btn"
                  onClick={() => onSeqLookup?.()}
                  disabled={seqLookupLoading}
                >
                  {seqLookupLoading ? '…' : '조회'}
                </button>
              </div>
            )}
          </div>

          <div className="order-form-field">
            <FieldLabel>접수일</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.received_date ?? ''} />
            ) : (
              <input
                type="date"
                value={form.received_date ?? ''}
                onChange={(e) => set('received_date', e.target.value)}
              />
            )}
          </div>

          <div className="order-form-field">
            <FieldLabel>납기일</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.due_date ?? ''} />
            ) : (
              <input
                type="date"
                value={form.due_date ?? ''}
                onChange={(e) => set('due_date', e.target.value)}
              />
            )}
          </div>

          <div className="order-form-field">
            <FieldLabel>상태</FieldLabel>
            <StatusSelect
              value={form.order_status}
              readonly={readonly}
              onChange={(v) => set('order_status', v)}
            />
          </div>
        </div>
      </div>

      <hr className="order-form-divider" />

      <div className="order-form-section">
        <div className="order-form-section-label">품목</div>
        <div className="order-form-grid-4 order-form-grid-row-gap">
          <div className="order-form-field">
            <FieldLabel>거래처</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={customerName} />
            ) : (
              <input
                list={customerDatalistId}
                placeholder="거래처"
                value={customerName}
                onChange={(e) => onCustomerChange(e.target.value)}
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>도번</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.drawing_no ?? ''} />
            ) : (
              <ItemDrawingCombobox
                value={form.drawing_no ?? ''}
                onChange={(v) => set('drawing_no', v)}
                onSelect={(c) => onDrawingSelect?.(c)}
                onBlur={(drawingNo) => onDrawingBlur?.(drawingNo)}
                className=""
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>품명</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.item_name ?? ''} />
            ) : (
              <input
                placeholder="품명"
                value={form.item_name ?? ''}
                onChange={(e) => set('item_name', e.target.value)}
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>재질</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.material ?? ''} />
            ) : (
              <input
                placeholder="재질"
                value={form.material ?? ''}
                onChange={(e) => set('material', e.target.value)}
              />
            )}
          </div>
        </div>
        <div className="order-form-grid-4">
          <div className="order-form-field">
            <FieldLabel>후처리</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.surface_treatment ?? ''} />
            ) : (
              <input
                placeholder="후처리"
                value={form.surface_treatment ?? ''}
                onChange={(e) => set('surface_treatment', e.target.value)}
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>진행처</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.progress_place ?? ''} />
            ) : (
              <input
                placeholder="진행처"
                value={form.progress_place ?? ''}
                onChange={(e) => set('progress_place', e.target.value)}
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>프로젝트명</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.project_name ?? ''} />
            ) : (
              <input
                placeholder="프로젝트명"
                value={form.project_name ?? ''}
                onChange={(e) => set('project_name', e.target.value)}
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>도면파일명</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.drawing_file_name ?? ''} />
            ) : (
              <input
                placeholder="도면파일명"
                value={form.drawing_file_name ?? ''}
                onChange={(e) => set('drawing_file_name', e.target.value)}
              />
            )}
          </div>
        </div>
      </div>

      <hr className="order-form-divider" />

      <div className="order-form-section">
        <div className="order-form-section-label">금액 · 수량</div>
        <div className="order-form-grid-5 order-form-grid-row-gap">
          <div className="order-form-field">
            <FieldLabel>수주수량</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={formatNumber(form.order_quantity)} />
            ) : (
              <NumericInput
                value={Number(form.order_quantity)}
                onChange={(n) => set('order_quantity', n)}
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>납품수량</FieldLabel>
            <ReadonlyValue value={formatNumber(form.delivered_quantity)} />
          </div>
          <div className="order-form-field">
            <FieldLabel>잔량</FieldLabel>
            <ReadonlyValue value={formatNumber(form.remaining_quantity)} />
          </div>
          <div className="order-form-field">
            <FieldLabel>단가</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={formatNumber(form.unit_price)} />
            ) : (
              <NumericInput
                value={Number(form.unit_price)}
                onChange={(n) => set('unit_price', n)}
                onValueBlur={(n) => onUnitPriceBlur?.(n)}
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>합계금액</FieldLabel>
            <ReadonlyValue value={formatNumber(form.total_amount)} />
          </div>
        </div>
        <div className="order-form-grid-3">
          <div className="order-form-field">
            <FieldLabel>외주단가</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={formatNumber(form.vendor_unit_price ?? 0)} />
            ) : (
              <NumericInput
                value={Number(form.vendor_unit_price ?? 0)}
                onChange={(n) => set('vendor_unit_price', n)}
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>외주금액</FieldLabel>
            <ReadonlyValue value={formatNumber(form.vendor_amount ?? 0)} />
          </div>
          <div className="order-form-field">
            <FieldLabel>발주번호</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.order_no ?? ''} />
            ) : (
              <input
                placeholder="발주번호"
                value={form.order_no ?? ''}
                onChange={(e) => set('order_no', e.target.value)}
              />
            )}
          </div>
        </div>
      </div>

      <hr className="order-form-divider" />

      <div className="order-form-section">
        <div className="order-form-section-label">기타</div>
        <div className="order-form-grid-3">
          <div className="order-form-field">
            <FieldLabel>담당자</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.person_in_charge ?? ''} />
            ) : (
              <input
                placeholder="담당자"
                value={form.person_in_charge ?? ''}
                onChange={(e) => set('person_in_charge', e.target.value)}
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>비고1</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.memo1 ?? ''} />
            ) : (
              <input
                placeholder="비고1"
                value={form.memo1 ?? ''}
                onChange={(e) => set('memo1', e.target.value)}
              />
            )}
          </div>
          <div className="order-form-field">
            <FieldLabel>비고2</FieldLabel>
            {readonly ? (
              <ReadonlyValue value={form.memo2 ?? ''} />
            ) : (
              <input
                placeholder="비고2"
                value={form.memo2 ?? ''}
                onChange={(e) => set('memo2', e.target.value)}
              />
            )}
          </div>
        </div>
      </div>

      {!readonly && (
        <datalist id={customerDatalistId}>
          {customers.map((c) => (
            <option key={c.id} value={c.customer_name} />
          ))}
        </datalist>
      )}
    </div>
  );
}
