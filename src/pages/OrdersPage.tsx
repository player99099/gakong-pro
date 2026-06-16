import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUnitPriceChoice } from '../hooks/useUnitPriceChoice';
import { ORDER_MANUAL_STATUSES, ORDER_STATUSES } from '../lib/constants';
import { excelRowToOrderFields } from '../lib/excelMapping';
import { formatTechnicalError } from '../lib/formatAppError';
import { formatNumber } from '../lib/formatNumber';
import { normalizeUnitPrice } from '../lib/orderUnitPrice';
import { resolveDrawingUnitPrice } from '../lib/resolveDrawingUnitPrice';
import {
  emptyOrderForm,
  orderToForm,
  patchForm,
} from '../lib/orderForm';
import { lookupSeqInReferenceExcel } from '../lib/excelSeqLookup';
import { createDefaultBomIfEmpty } from '../services/bomService';
import { fetchCustomers, findOrCreateCustomer } from '../services/customers';
import {
  fetchItems,
  lookupBomByDrawingNo,
  lookupByDrawingNo,
  syncBomFieldsByDrawingNo,
  upsertItemFromOrder,
  type DrawingCandidate,
} from '../services/items';
import {
  createOrder,
  deleteOrder,
  fetchOrders,
  getOrderBySeqNo,
  updateOrder,
  updateOrderStatus,
  type OrderInput,
} from '../services/orders';
import type { Customer, Item, Order, OrderSearchParams, OrderStatus } from '../types';
import { ExcelFormatSetupModal } from '../components/orders/ExcelFormatSetupModal';
import { ExcelUploadModal } from '../components/orders/ExcelUploadModal';
import { OrderFormModal } from '../components/orders/OrderFormModal';
import { OrderFormFields } from '../components/orders/OrderFormFields';
import { SeqNoActionModal } from '../components/orders/SeqNoActionModal';

const emptySearch: OrderSearchParams = {
  customerName: '',
  orderNo: '',
  drawingNo: '',
  itemName: '',
  orderStatus: '',
  dueDateFrom: '',
  dueDateTo: '',
};

type SortField =
  | 'customer_name'
  | 'order_no'
  | 'drawing_no'
  | 'item_name'
  | 'order_quantity'
  | 'delivered_quantity'
  | 'remaining_quantity'
  | 'due_date'
  | 'person_in_charge'
  | 'progress_place'
  | 'total_amount'
  | 'order_status';

type SortState = { field: SortField; direction: 'asc' | 'desc' };

const SORT_LABELS: Record<SortField, string> = {
  customer_name: '거래처',
  order_no: '발주번호',
  drawing_no: '도번',
  item_name: '품명',
  order_quantity: '수량',
  delivered_quantity: '납품수량',
  remaining_quantity: '잔량',
  due_date: '납기일',
  person_in_charge: '담당자',
  progress_place: '진행처',
  total_amount: '금액',
  order_status: '상태',
};

function sortOrders(list: Order[], sort: SortState): Order[] {
  const dir = sort.direction === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const get = (o: Order): string | number => {
      switch (sort.field) {
        case 'customer_name':
          return o.customers?.customer_name ?? '';
        case 'order_no':
          return o.order_no ?? '';
        case 'drawing_no':
          return o.drawing_no ?? '';
        case 'item_name':
          return o.item_name ?? '';
        case 'order_quantity':
          return Number(o.order_quantity);
        case 'delivered_quantity':
          return Number(o.delivered_quantity);
        case 'remaining_quantity':
          return Number(o.remaining_quantity);
        case 'due_date':
          return o.due_date ?? '';
        case 'person_in_charge':
          return o.person_in_charge ?? '';
        case 'progress_place':
          return o.progress_place ?? '';
        case 'total_amount':
          return Number(o.total_amount);
        case 'order_status':
          return o.order_status;
        default:
          return '';
      }
    };
    const av = get(a);
    const bv = get(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

export function OrdersPage() {
  const { userEmail } = useAuth();
  const unitPriceChoice = useUnitPriceChoice();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [searchParams, setSearchParams] = useState<OrderSearchParams>(emptySearch);
  const [sortState, setSortState] = useState<SortState>({
    field: 'due_date',
    direction: 'asc',
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<OrderInput>(emptyOrderForm());
  const [newCustomerName, setNewCustomerName] = useState('');
  const [editForm, setEditForm] = useState<OrderInput>(emptyOrderForm());
  const [editCustomerName, setEditCustomerName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [seqModalOpen, setSeqModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [excelFormatModalOpen, setExcelFormatModalOpen] = useState(false);
  const [seqLookupLoading, setSeqLookupLoading] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  /** 도번+단가 조합에 대해 단가 선택 모달을 이미 확인했는지 */
  const priceConfirmedRef = useRef<string | null>(null);

  const priceConfirmKey = (drawingNo: string, unitPrice: number) =>
    `${drawingNo.trim().toUpperCase()}:${normalizeUnitPrice(unitPrice)}`;

  const markPriceConfirmed = (drawingNo: string, unitPrice: number) => {
    priceConfirmedRef.current = priceConfirmKey(drawingNo, unitPrice);
  };

  const isPriceConfirmed = (drawingNo: string, unitPrice: number) =>
    priceConfirmedRef.current === priceConfirmKey(drawingNo, unitPrice);

  /** 도번 기준 BOM 단가와 수주 단가 불일치 시 즉시 선택 모달 */
  const resolveFormUnitPrice = useCallback(
    async (
      drawingNo: string,
      orderUnitPrice: number,
      orderQty: number,
      setForm: Dispatch<SetStateAction<OrderInput>>,
    ) => {
      const trimmed = drawingNo.trim();
      if (!trimmed) return;

      const resolved = await resolveDrawingUnitPrice(
        trimmed,
        orderUnitPrice,
        orderQty,
        (orderPrice, refPrice) =>
          unitPriceChoice.prompt(orderPrice, refPrice, trimmed, 'bom'),
      );

      if (resolved.cancelled) return;

      markPriceConfirmed(trimmed, resolved.unitPrice);
      setForm((prev) => ({
        ...patchForm(prev, 'unit_price', resolved.unitPrice),
        total_amount: resolved.totalAmount,
      }));
    },
    [unitPriceChoice.prompt],
  );

  /** 저장 직전 — 단가 불일치 시 모달(이미 확인한 조합은 생략) */
  const ensureFormUnitPriceBeforeSave = useCallback(
    async (
      form: OrderInput,
      setForm: Dispatch<SetStateAction<OrderInput>>,
    ): Promise<OrderInput | null> => {
      const trimmed = form.drawing_no?.trim() ?? '';
      if (!trimmed) return form;

      const orderPrice = normalizeUnitPrice(form.unit_price);
      if (isPriceConfirmed(trimmed, orderPrice)) return form;

      const resolved = await resolveDrawingUnitPrice(
        trimmed,
        orderPrice,
        form.order_quantity,
        (op, refPrice) =>
          unitPriceChoice.prompt(op, refPrice, trimmed, 'bom'),
      );

      if (resolved.cancelled) return null;
      if (resolved.skipped) return form;

      const next: OrderInput = {
        ...form,
        unit_price: resolved.unitPrice,
        total_amount: resolved.totalAmount,
      };
      markPriceConfirmed(trimmed, resolved.unitPrice);
      setForm(next);
      return next;
    },
    [unitPriceChoice.prompt],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOrders(searchParams);
      setOrders(data);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '수주 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    load();
    fetchCustomers().then(setCustomers).catch(() => {});
    fetchItems().then(setItems).catch(() => {});
  }, [load]);

  const sortedOrders = useMemo(
    () => sortOrders(orders, sortState),
    [orders, sortState],
  );

  const toggleSort = (field: SortField) => {
    setSortState((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    );
  };

  const resetNewRow = () => {
    setNewForm(emptyOrderForm());
    setNewCustomerName('');
    setFormError('');
    priceConfirmedRef.current = null;
  };

  const openCreate = () => {
    resetNewRow();
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setFormError('');
  };

  const startEdit = (order: Order) => {
    setEditingId(order.id);
    setEditForm(orderToForm(order));
    setEditCustomerName(order.customers?.customer_name ?? '');
    setFormError('');
    priceConfirmedRef.current = null;
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormError('');
  };

  const applyLookupToForm = (
    lookup: {
      item_id: string;
      drawing_no: string;
      item_name: string;
      material: string | null;
      surface_treatment: string | null;
      customer_id: string | null;
      customer_name: string | null;
    },
    setForm: Dispatch<SetStateAction<OrderInput>>,
    setCustName: (n: string) => void,
    currentQty: number,
  ) => {
    setForm((prev) => ({
      ...prev,
      item_id: lookup.item_id,
      drawing_no: lookup.drawing_no,
      item_name: lookup.item_name,
      material: lookup.material ?? '',
      surface_treatment: lookup.surface_treatment ?? '',
      remaining_quantity: currentQty - (prev.delivered_quantity || 0),
      customer_id: lookup.customer_id ?? prev.customer_id,
    }));
    if (lookup.customer_name) {
      setCustName(lookup.customer_name);
    } else if (lookup.customer_id) {
      const matched = customers.find((c) => c.id === lookup.customer_id);
      if (matched) setCustName(matched.customer_name);
    }
  };

  const handleDrawingBlur = async (
    drawingNo: string,
    setForm: Dispatch<SetStateAction<OrderInput>>,
    setCustName: (n: string) => void,
    currentQty: number,
    currentUnitPrice: number,
  ) => {
    const trimmed = drawingNo.trim();
    if (!trimmed) return;
    priceConfirmedRef.current = null;
    try {
      const [lookup, bomRow] = await Promise.all([
        lookupByDrawingNo(trimmed),
        lookupBomByDrawingNo(trimmed),
      ]);
      const bomPrice =
        bomRow != null && bomRow.unit_price > 0 ? bomRow.unit_price : null;

      if (lookup) {
        applyLookupToForm(
          {
            item_id: lookup.item_id,
            drawing_no: lookup.drawing_no,
            item_name: lookup.item_name,
            material: lookup.material,
            surface_treatment: lookup.surface_treatment,
            customer_id: lookup.customer_id,
            customer_name: lookup.customer_name,
          },
          setForm,
          setCustName,
          currentQty,
        );
        await resolveFormUnitPrice(
          trimmed,
          Number(currentUnitPrice) || 0,
          currentQty,
          setForm,
        );
      } else if (bomPrice != null) {
        await resolveFormUnitPrice(
          trimmed,
          Number(currentUnitPrice) || 0,
          currentQty,
          setForm,
        );
      }
    } catch {
      /* lookup failure — keep manual input */
    }
  };

  const handleDrawingSelect = async (
    candidate: DrawingCandidate,
    setForm: Dispatch<SetStateAction<OrderInput>>,
    setCustName: (n: string) => void,
    currentQty: number,
    currentUnitPrice: number,
  ) => {
    priceConfirmedRef.current = null;
    try {
      applyLookupToForm(
        {
          item_id: candidate.item_id ?? '',
          drawing_no: candidate.drawing_no,
          item_name: candidate.item_name,
          material: candidate.material,
          surface_treatment: candidate.surface_treatment,
          customer_id: null,
          customer_name: null,
        },
        setForm,
        setCustName,
        currentQty,
      );
      await resolveFormUnitPrice(
        candidate.drawing_no,
        Number(currentUnitPrice) || 0,
        currentQty,
        setForm,
      );
    } catch {
      /* lookup failure — keep manual input */
    }
  };

  const handleSeqNoLookup = async (
    seqNo: string,
    setForm: Dispatch<SetStateAction<OrderInput>>,
    setCustName: (n: string) => void,
    excludeOrderId?: string | null,
  ) => {
    const trimmed = seqNo.trim();
    if (!trimmed) return;

    setSeqLookupLoading(true);
    setFormError('');
    try {
      const dbOrder = await getOrderBySeqNo(trimmed);
      if (dbOrder) {
        if (excludeOrderId && dbOrder.id !== excludeOrderId) {
          setFormError(
            `순번 ${trimmed}: 이미 등록된 수주입니다. (도번 ${dbOrder.drawing_no ?? '-'})`,
          );
          return;
        }
        setForm(orderToForm(dbOrder));
        setCustName(dbOrder.customers?.customer_name ?? '');
        return;
      }

      const excelRow = await lookupSeqInReferenceExcel(trimmed);
      if (excelRow) {
        const { fields, customerName } = excelRowToOrderFields(
          excelRow,
          customers,
        );
        let customerId = fields.customer_id ?? null;
        if (customerName.trim()) {
          const customer = await findOrCreateCustomer(customerName, userEmail);
          customerId = customer.id;
          setCustName(customerName);
          setCustomers(await fetchCustomers());
        }
        setForm((prev) => ({
          ...prev,
          ...fields,
          seq_no: trimmed,
          item_id: prev.item_id,
          customer_id: customerId,
        }));
        if (fields.drawing_no) {
          await resolveFormUnitPrice(
            fields.drawing_no,
            Number(fields.unit_price ?? 0),
            Number(fields.order_quantity ?? 0),
            setForm,
          );
        }
        return;
      }

      setFormError(
        `순번 ${trimmed}: DB·참조 엑셀에서 찾을 수 없습니다.\n(형식 설정 시 샘플 파일을 저장했는지 확인해 주세요)`,
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '순번 조회에 실패했습니다.',
      );
    } finally {
      setSeqLookupLoading(false);
    }
  };

  const validateAndSave = async (
    form: OrderInput,
    customerName: string,
    orderId: string | null,
    setForm: Dispatch<SetStateAction<OrderInput>>,
  ) => {
    if (!customerName.trim()) {
      setFormError('거래처를 입력해 주세요.');
      return;
    }
    if (!form.drawing_no?.trim()) {
      setFormError('도번을 입력해 주세요.');
      return;
    }
    if (!form.item_name?.trim()) {
      setFormError('품명을 입력해 주세요.');
      return;
    }
    setFormError('');
    try {
      const resolvedForm = await ensureFormUnitPriceBeforeSave(form, setForm);
      if (!resolvedForm) return;

      const customer = await findOrCreateCustomer(customerName, userEmail);
      const payload = { ...resolvedForm, customer_id: customer.id };

      setSaving(true);

      const itemId = await upsertItemFromOrder({
        drawing_no: resolvedForm.drawing_no!,
        item_name: resolvedForm.item_name!,
        material: resolvedForm.material ?? undefined,
        surface_treatment: resolvedForm.surface_treatment ?? undefined,
        customer_id: customer.id,
        unit_price: payload.unit_price,
        userEmail,
        keepMasterUnitPrice: true,
      });
      const savePayload = { ...payload, item_id: itemId };

      await syncBomFieldsByDrawingNo(
        resolvedForm.drawing_no!,
        {
          item_name: resolvedForm.item_name!,
          material: resolvedForm.material ?? null,
          surface_treatment: resolvedForm.surface_treatment ?? null,
        },
        userEmail,
      );

      setCustomers(await fetchCustomers());
      if (orderId) {
        await updateOrder(orderId, savePayload, userEmail);
        setEditingId(null);
      } else {
        await createOrder(savePayload, userEmail);
        closeCreate();
        resetNewRow();
      }

      await createDefaultBomIfEmpty({
        parent_item_id: itemId,
        drawing_no: resolvedForm.drawing_no!,
        item_name: resolvedForm.item_name!,
        material: resolvedForm.material ?? undefined,
        surface_treatment: resolvedForm.surface_treatment ?? undefined,
        progress_place: resolvedForm.progress_place ?? undefined,
        userEmail,
      });

      await load();
    } catch (err) {
      setFormError(formatTechnicalError(err) || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    setStatusUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, status, userEmail);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, order_status: status } : o)),
      );
      if (editingId === orderId) {
        setEditForm((p) => ({ ...p, order_status: status }));
      }
    } catch (err) {
      alert(
        err instanceof Error ? err.message : '상태 변경에 실패했습니다.',
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const renderStatusSelect = (order: Order) => {
    const current = order.order_status;
    const isManual = ORDER_MANUAL_STATUSES.includes(current);
    return (
      <select
        className="cell-input cell-input-status"
        value={current}
        disabled={statusUpdatingId === order.id}
        onChange={(e) => {
          const next = e.target.value as OrderStatus;
          void handleStatusChange(order.id, next);
        }}
      >
        {!isManual && (
          <option value={current}>{current}</option>
        )}
        {ORDER_MANUAL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 수주를 삭제하시겠습니까?')) return;
    try {
      await deleteOrder(id);
      if (editingId === id) setEditingId(null);
      if (expandedId === id) setExpandedId(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '삭제에 실패했습니다.',
      );
    }
  };

  const updateSearch = (field: keyof OrderSearchParams, value: string) => {
    setSearchParams((prev) => ({ ...prev, [field]: value }));
  };

  const customerDatalistId = 'order-customer-datalist';
  const drawingDatalistId = 'order-drawing-datalist';

  const renderSortTh = (field: SortField, label?: string) => {
    const active = sortState.field === field;
    return (
      <th>
        <button
          type="button"
          className={`sortable-th${active ? ' active' : ''}`}
          onClick={() => toggleSort(field)}
        >
          {label ?? SORT_LABELS[field]}
          {active && (
            <span className="sort-indicator">
              {sortState.direction === 'asc' ? ' ▲' : ' ▼'}
            </span>
          )}
        </button>
      </th>
    );
  };

  return (
    <div className="orders-inline-page">
      <div className="page-header">
        <h1 className="page-title">수주관리</h1>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon" aria-hidden="true">
            !
          </span>
          <span className="alert-text">{error}</span>
        </div>
      )}
      {formError && !createOpen && !editingId && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon" aria-hidden="true">
            !
          </span>
          <span className="alert-text">{formError}</span>
        </div>
      )}

      <div className="search-bar">
        <div className="form-group">
          <label>거래처</label>
          <input
            placeholder="거래처명"
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
          <label>상태</label>
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
        <button
          className="btn btn-secondary"
          onClick={() => setExcelModalOpen(true)}
        >
          엑셀 업로드
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setExcelFormatModalOpen(true)}
        >
          엑셀 형식 설정
        </button>
        <button className="btn btn-secondary" onClick={load}>
          검색
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            setSortState({ field: 'due_date', direction: 'asc' })
          }
        >
          정렬 초기화
        </button>
      </div>

      <div className="orders-action-bar">
        <button
          type="button"
          className="btn btn-seq-add"
          onClick={() => setSeqModalOpen(true)}
        >
          순번 추가
        </button>
        <button type="button" className="btn btn-order-add" onClick={openCreate}>
          + 수주추가
        </button>
      </div>

      <OrderFormModal
        open={createOpen}
        mode="create"
        form={newForm}
        customerName={newCustomerName}
        customers={customers}
        customerDatalistId={customerDatalistId}
        formError={formError}
        saving={saving}
        seqLookupLoading={seqLookupLoading}
        onFormChange={setNewForm}
        onCustomerChange={setNewCustomerName}
        onClose={closeCreate}
        onSave={() => validateAndSave(newForm, newCustomerName, null, setNewForm)}
        onSeqLookup={() =>
          void handleSeqNoLookup(newForm.seq_no ?? '', setNewForm, setNewCustomerName)
        }
        onDrawingBlur={(drawingNo) =>
          void handleDrawingBlur(
            drawingNo,
            setNewForm,
            setNewCustomerName,
            newForm.order_quantity,
            newForm.unit_price,
          )
        }
        onDrawingSelect={(candidate) =>
          void handleDrawingSelect(
            candidate,
            setNewForm,
            setNewCustomerName,
            newForm.order_quantity,
            newForm.unit_price,
          )
        }
        onUnitPriceBlur={(unitPrice) =>
          void resolveFormUnitPrice(
            newForm.drawing_no ?? '',
            unitPrice,
            newForm.order_quantity,
            setNewForm,
          )
        }
      />

      <OrderFormModal
        open={editingId !== null}
        mode="edit"
        form={editForm}
        customerName={editCustomerName}
        customers={customers}
        customerDatalistId={customerDatalistId}
        formError={formError}
        saving={saving}
        seqLookupLoading={seqLookupLoading}
        onFormChange={setEditForm}
        onCustomerChange={setEditCustomerName}
        onClose={cancelEdit}
        onSave={() => {
          if (editingId) {
            void validateAndSave(editForm, editCustomerName, editingId, setEditForm);
          }
        }}
        onSeqLookup={() =>
          void handleSeqNoLookup(
            editForm.seq_no ?? '',
            setEditForm,
            setEditCustomerName,
            editingId ?? undefined,
          )
        }
        onDrawingBlur={(drawingNo) =>
          void handleDrawingBlur(
            drawingNo,
            setEditForm,
            setEditCustomerName,
            editForm.order_quantity,
            editForm.unit_price,
          )
        }
        onDrawingSelect={(candidate) =>
          void handleDrawingSelect(
            candidate,
            setEditForm,
            setEditCustomerName,
            editForm.order_quantity,
            editForm.unit_price,
          )
        }
        onUnitPriceBlur={(unitPrice) =>
          void resolveFormUnitPrice(
            editForm.drawing_no ?? '',
            unitPrice,
            editForm.order_quantity,
            setEditForm,
          )
        }
      />

      <ExcelUploadModal
        isOpen={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        onComplete={load}
        onOpenFormatSetup={() => {
          setExcelModalOpen(false);
          setExcelFormatModalOpen(true);
        }}
        customers={customers}
      />

      <ExcelFormatSetupModal
        isOpen={excelFormatModalOpen}
        onClose={() => setExcelFormatModalOpen(false)}
        onSaved={() => {
          setExcelFormatModalOpen(false);
          setExcelModalOpen(true);
        }}
      />

      <SeqNoActionModal
        open={seqModalOpen}
        onClose={() => setSeqModalOpen(false)}
        onComplete={load}
        customers={customers}
        onOpenFormatSetup={() => {
          setSeqModalOpen(false);
          setExcelFormatModalOpen(true);
        }}
      />

      {unitPriceChoice.modal}

      <datalist id={customerDatalistId}>
        {customers.map((c) => (
          <option key={c.id} value={c.customer_name} />
        ))}
      </datalist>
      <datalist id={drawingDatalistId}>
        {items
          .filter((i) => i.drawing_no)
          .map((i) => (
            <option key={i.id} value={i.drawing_no!} />
          ))}
      </datalist>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-spinner">로딩 중...</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table order-inline-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>순번</th>
                    {renderSortTh('order_status', '상태')}
                    {renderSortTh('customer_name', '거래처')}
                    {renderSortTh('order_no', '발주번호')}
                    {renderSortTh('drawing_no', '도번')}
                    {renderSortTh('item_name', '품명')}
                    {renderSortTh('order_quantity', '수량')}
                    {renderSortTh('delivered_quantity', '납품')}
                    {renderSortTh('remaining_quantity', '잔량')}
                    {renderSortTh('due_date', '납기일')}
                    {renderSortTh('person_in_charge', '담당자')}
                    {renderSortTh('total_amount', '금액')}
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.length === 0 && (
                    <tr>
                      <td colSpan={14} className="order-empty-hint">
                        등록된 수주가 없습니다.{' '}
                        <button
                          type="button"
                          className="btn-link"
                          onClick={openCreate}
                        >
                          + 수주추가
                        </button>
                        로 등록해 주세요.
                      </td>
                    </tr>
                  )}

                  {sortedOrders.map((order) => {
                    const isExpanded = expandedId === order.id;
                    const detailForm = orderToForm(order);
                    const detailCustomerName =
                      order.customers?.customer_name ?? '';

                    return (
                      <Fragment key={order.id}>
                        <tr
                          className={
                            editingId === order.id ? 'order-edit-row' : undefined
                          }
                        >
                          <td>
                            <button
                              type="button"
                              className="btn-expand"
                              onClick={() =>
                                setExpandedId(
                                  isExpanded ? null : order.id,
                                )
                              }
                              aria-label="상세 펼치기"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          </td>
                          <td>{order.seq_no ?? '-'}</td>
                          <td>{renderStatusSelect(order)}</td>
                          <td>{order.customers?.customer_name ?? '-'}</td>
                          <td>{order.order_no ?? '-'}</td>
                          <td>{order.drawing_no ?? '-'}</td>
                          <td>{order.item_name ?? '-'}</td>
                          <td>{formatNumber(order.order_quantity)}</td>
                          <td>{formatNumber(order.delivered_quantity)}</td>
                          <td>{formatNumber(order.remaining_quantity)}</td>
                          <td>{order.due_date ?? '-'}</td>
                          <td>{order.person_in_charge ?? '-'}</td>
                          <td className="text-right cell-amount">
                            {formatNumber(order.total_amount)}
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => startEdit(order)}
                            >
                              편집
                            </button>{' '}
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(order.id)}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr
                            key={`${order.id}-detail`}
                            className="order-expanded-row"
                          >
                            <td colSpan={14}>
                              <div className="order-detail-panel">
                                <OrderFormFields
                                  form={detailForm}
                                  customerName={detailCustomerName}
                                  customers={customers}
                                  readonly
                                  customerDatalistId={customerDatalistId}
                                  onFormChange={() => {}}
                                  onCustomerChange={() => {}}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
