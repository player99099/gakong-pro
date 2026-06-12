import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ORDER_STATUSES, PROCESS_STATUSES } from '../lib/constants';
import { fetchCustomers, findOrCreateCustomer } from '../services/customers';
import { fetchItems, lookupByDrawingNo } from '../services/items';
import {
  createOrder,
  deleteOrder,
  fetchOrders,
  updateOrder,
  type OrderInput,
} from '../services/orders';
import type { Customer, Item, Order, OrderSearchParams } from '../types';
import { OrderStatusBadge, ProcessStatusBadge } from '../components/ui/Badge';

const emptyForm = (): OrderInput => ({
  customer_id: null,
  order_no: '',
  received_date: new Date().toISOString().split('T')[0],
  due_date: '',
  item_id: null,
  drawing_no: '',
  item_name: '',
  material: '',
  order_quantity: 0,
  unit_price: 0,
  total_amount: 0,
  surface_treatment: '',
  project_name: '',
  person_in_charge: '',
  progress_place: '',
  drawing_file_name: '',
  memo1: '',
  memo2: '',
  order_status: '접수',
  process_status: '수주접수',
  delivered_quantity: 0,
  remaining_quantity: 0,
  produced_quantity: 0,
  defect_quantity: 0,
});

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
  | 'order_status'
  | 'process_status';

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
  process_status: '공정',
};

function formatItemLabel(item: Pick<Item, 'drawing_no' | 'item_name'>) {
  return item.drawing_no
    ? `${item.drawing_no} - ${item.item_name}`
    : item.item_name;
}

function formatLinkedItem(
  itemId: string | null,
  items: Item[],
  fallback?: { drawing_no?: string | null; item_name?: string | null },
) {
  if (itemId) {
    const item = items.find((i) => i.id === itemId);
    if (item) return formatItemLabel(item);
  }
  if (fallback?.item_name || fallback?.drawing_no) {
    return fallback.drawing_no
      ? `${fallback.drawing_no} - ${fallback.item_name ?? ''}`
      : (fallback.item_name ?? '-');
  }
  return '-';
}

function orderToForm(order: Order): OrderInput {
  return {
    customer_id: order.customer_id,
    order_no: order.order_no ?? '',
    received_date: order.received_date ?? '',
    due_date: order.due_date ?? '',
    item_id: order.item_id,
    drawing_no: order.drawing_no ?? '',
    item_name: order.item_name ?? '',
    material: order.material ?? '',
    order_quantity: order.order_quantity,
    unit_price: order.unit_price,
    total_amount: order.total_amount,
    surface_treatment: order.surface_treatment ?? '',
    project_name: order.project_name ?? '',
    person_in_charge: order.person_in_charge ?? '',
    progress_place: order.progress_place ?? '',
    drawing_file_name: order.drawing_file_name ?? '',
    memo1: order.memo1 ?? '',
    memo2: order.memo2 ?? '',
    order_status: order.order_status,
    process_status: order.process_status,
    delivered_quantity: order.delivered_quantity,
    remaining_quantity: order.remaining_quantity,
    produced_quantity: order.produced_quantity ?? 0,
    defect_quantity: order.defect_quantity ?? 0,
  };
}

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
        case 'process_status':
          return o.process_status;
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

function patchForm(
  prev: OrderInput,
  field: keyof OrderInput,
  value: string | number | null,
): OrderInput {
  const next = { ...prev, [field]: value };
  if (field === 'order_quantity' || field === 'unit_price') {
    const qty = field === 'order_quantity' ? Number(value) : prev.order_quantity;
    const price = field === 'unit_price' ? Number(value) : prev.unit_price;
    next.total_amount = qty * price;
    next.remaining_quantity = qty - (prev.delivered_quantity || 0);
  }
  return next;
}

export function OrdersPage() {
  const { userEmail } = useAuth();
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
  const [newForm, setNewForm] = useState<OrderInput>(emptyForm);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [editForm, setEditForm] = useState<OrderInput>(emptyForm());
  const [editCustomerName, setEditCustomerName] = useState('');
  const [formError, setFormError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    setNewForm(emptyForm());
    setNewCustomerName('');
    setFormError('');
  };

  const startEdit = (order: Order) => {
    setEditingId(order.id);
    setEditForm(orderToForm(order));
    setEditCustomerName(order.customers?.customer_name ?? '');
    setFormError('');
    setExpandedId(order.id);
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
      unit_price: number;
      customer_id: string | null;
      customer_name: string | null;
    },
    setForm: Dispatch<SetStateAction<OrderInput>>,
    setCustName: (n: string) => void,
    currentQty: number,
  ) => {
    const price = lookup.unit_price || 0;
    setForm((prev) => ({
      ...prev,
      item_id: lookup.item_id,
      drawing_no: lookup.drawing_no,
      item_name: lookup.item_name,
      material: lookup.material ?? '',
      surface_treatment: lookup.surface_treatment ?? '',
      unit_price: price,
      total_amount: currentQty * price,
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

  const applyItemToForm = (
    itemId: string,
    setForm: Dispatch<SetStateAction<OrderInput>>,
    setCustName: (n: string) => void,
    currentQty: number,
  ) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      setForm((prev) => ({ ...prev, item_id: itemId || null }));
      return;
    }
    applyLookupToForm(
      {
        item_id: itemId,
        drawing_no: item.drawing_no ?? '',
        item_name: item.item_name,
        material: item.material,
        surface_treatment: item.surface_treatment,
        unit_price: item.unit_price || 0,
        customer_id: item.customer_id,
        customer_name: item.customers?.customer_name ?? null,
      },
      setForm,
      setCustName,
      currentQty,
    );
  };

  const handleDrawingBlur = async (
    drawingNo: string,
    setForm: Dispatch<SetStateAction<OrderInput>>,
    setCustName: (n: string) => void,
    currentQty: number,
  ) => {
    const trimmed = drawingNo.trim();
    if (!trimmed) return;
    try {
      const lookup = await lookupByDrawingNo(trimmed);
      if (lookup) {
        applyLookupToForm(lookup, setForm, setCustName, currentQty);
      }
    } catch {
      /* lookup failure — keep manual input */
    }
  };

  const validateAndSave = async (
    form: OrderInput,
    customerName: string,
    orderId: string | null,
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
    setSaving(true);
    setFormError('');
    try {
      const customer = await findOrCreateCustomer(customerName, userEmail);
      const payload = { ...form, customer_id: customer.id };
      setCustomers(await fetchCustomers());
      if (orderId) {
        await updateOrder(orderId, payload, userEmail);
        setEditingId(null);
      } else {
        await createOrder(payload, userEmail);
        resetNewRow();
      }
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
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={resetNewRow}>
            입력 초기화
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon" aria-hidden="true">
            !
          </span>
          <span className="alert-text">{error}</span>
        </div>
      )}
      {formError && (
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
                    {renderSortTh('order_status', '상태')}
                    {renderSortTh('process_status', '공정')}
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
                  {/* 신규 입력 행 */}
                  <tr className="order-input-row">
                    <td>
                      <span className="row-badge-new">신규</span>
                    </td>
                    <td>
                      <select
                        className="cell-input"
                        value={newForm.order_status}
                        onChange={(e) =>
                          setNewForm((p) =>
                            patchForm(p, 'order_status', e.target.value),
                          )
                        }
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="cell-input"
                        value={newForm.process_status}
                        onChange={(e) =>
                          setNewForm((p) =>
                            patchForm(p, 'process_status', e.target.value),
                          )
                        }
                      >
                        {PROCESS_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        list={customerDatalistId}
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="거래처"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        value={newForm.order_no ?? ''}
                        onChange={(e) =>
                          setNewForm((p) =>
                            patchForm(p, 'order_no', e.target.value),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        list={drawingDatalistId}
                        value={newForm.drawing_no ?? ''}
                        placeholder="도번"
                        onChange={(e) =>
                          setNewForm((p) =>
                            patchForm(p, 'drawing_no', e.target.value),
                          )
                        }
                        onBlur={(e) =>
                          handleDrawingBlur(
                            e.target.value,
                            setNewForm,
                            setNewCustomerName,
                            newForm.order_quantity,
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        value={newForm.item_name ?? ''}
                        placeholder="품명"
                        onChange={(e) =>
                          setNewForm((p) =>
                            patchForm(p, 'item_name', e.target.value),
                          )
                        }
                      />
                      <select
                        className="cell-input cell-input-sub"
                        value={newForm.item_id ?? ''}
                        onChange={(e) =>
                          applyItemToForm(
                            e.target.value,
                            setNewForm,
                            setNewCustomerName,
                            newForm.order_quantity,
                          )
                        }
                      >
                        <option value="">품목에서 선택</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>
                            {formatItemLabel(item)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="cell-input cell-input-num"
                        value={newForm.order_quantity}
                        onChange={(e) =>
                          setNewForm((p) =>
                            patchForm(
                              p,
                              'order_quantity',
                              Number(e.target.value),
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="text-muted">0</td>
                    <td className="text-muted">{newForm.remaining_quantity}</td>
                    <td>
                      <input
                        type="date"
                        className="cell-input"
                        value={newForm.due_date ?? ''}
                        onChange={(e) =>
                          setNewForm((p) =>
                            patchForm(p, 'due_date', e.target.value),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        value={newForm.person_in_charge ?? ''}
                        onChange={(e) =>
                          setNewForm((p) =>
                            patchForm(p, 'person_in_charge', e.target.value),
                          )
                        }
                      />
                    </td>
                    <td className="text-right cell-amount">
                      <input
                        type="number"
                        className="cell-input cell-input-num"
                        value={newForm.unit_price}
                        onChange={(e) =>
                          setNewForm((p) =>
                            patchForm(p, 'unit_price', Number(e.target.value)),
                          )
                        }
                      />
                      <span className="cell-amount-total">
                        {Number(newForm.total_amount).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={saving}
                        onClick={() =>
                          validateAndSave(newForm, newCustomerName, null)
                        }
                      >
                        {saving ? '...' : '저장'}
                      </button>
                    </td>
                  </tr>

                  {sortedOrders.length === 0 && (
                    <tr>
                      <td colSpan={14} className="order-empty-hint">
                        아래 목록이 비어 있습니다. 상단 입력 행에서 수주를
                        등록해 주세요.
                      </td>
                    </tr>
                  )}

                  {sortedOrders.map((order) => {
                    const isEditing = editingId === order.id;
                    const isExpanded = expandedId === order.id;
                    const form = isEditing ? editForm : orderToForm(order);
                    const custName = isEditing
                      ? editCustomerName
                      : order.customers?.customer_name ?? '';

                    return (
                      <Fragment key={order.id}>
                        <tr
                          className={
                            isEditing ? 'order-edit-row' : undefined
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
                          <td>
                            {isEditing ? (
                              <select
                                className="cell-input"
                                value={form.order_status}
                                onChange={(e) =>
                                  setEditForm((p) =>
                                    patchForm(p, 'order_status', e.target.value),
                                  )
                                }
                              >
                                {ORDER_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <OrderStatusBadge status={order.order_status} />
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <select
                                className="cell-input"
                                value={form.process_status}
                                onChange={(e) =>
                                  setEditForm((p) =>
                                    patchForm(
                                      p,
                                      'process_status',
                                      e.target.value,
                                    ),
                                  )
                                }
                              >
                                {PROCESS_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <ProcessStatusBadge
                                status={order.process_status}
                              />
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="cell-input"
                                list={customerDatalistId}
                                value={custName}
                                onChange={(e) =>
                                  setEditCustomerName(e.target.value)
                                }
                              />
                            ) : (
                              order.customers?.customer_name ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="cell-input"
                                value={form.order_no ?? ''}
                                onChange={(e) =>
                                  setEditForm((p) =>
                                    patchForm(p, 'order_no', e.target.value),
                                  )
                                }
                              />
                            ) : (
                              order.order_no ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="cell-input"
                                list={drawingDatalistId}
                                value={form.drawing_no ?? ''}
                                onChange={(e) =>
                                  setEditForm((p) =>
                                    patchForm(p, 'drawing_no', e.target.value),
                                  )
                                }
                                onBlur={(e) =>
                                  handleDrawingBlur(
                                    e.target.value,
                                    setEditForm,
                                    setEditCustomerName,
                                    editForm.order_quantity,
                                  )
                                }
                              />
                            ) : (
                              order.drawing_no ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <>
                                <input
                                  className="cell-input"
                                  value={form.item_name ?? ''}
                                  onChange={(e) =>
                                    setEditForm((p) =>
                                      patchForm(p, 'item_name', e.target.value),
                                    )
                                  }
                                />
                                <select
                                  className="cell-input cell-input-sub"
                                  value={form.item_id ?? ''}
                                  onChange={(e) =>
                                    applyItemToForm(
                                      e.target.value,
                                      setEditForm,
                                      setEditCustomerName,
                                      editForm.order_quantity,
                                    )
                                  }
                                >
                                  <option value="">품목에서 선택</option>
                                  {items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {formatItemLabel(item)}
                                    </option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              order.item_name ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="number"
                                className="cell-input cell-input-num"
                                value={form.order_quantity}
                                onChange={(e) =>
                                  setEditForm((p) =>
                                    patchForm(
                                      p,
                                      'order_quantity',
                                      Number(e.target.value),
                                    ),
                                  )
                                }
                              />
                            ) : (
                              order.order_quantity
                            )}
                          </td>
                          <td>{order.delivered_quantity}</td>
                          <td>{order.remaining_quantity}</td>
                          <td>
                            {isEditing ? (
                              <input
                                type="date"
                                className="cell-input"
                                value={form.due_date ?? ''}
                                onChange={(e) =>
                                  setEditForm((p) =>
                                    patchForm(p, 'due_date', e.target.value),
                                  )
                                }
                              />
                            ) : (
                              order.due_date ?? '-'
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="cell-input"
                                value={form.person_in_charge ?? ''}
                                onChange={(e) =>
                                  setEditForm((p) =>
                                    patchForm(
                                      p,
                                      'person_in_charge',
                                      e.target.value,
                                    ),
                                  )
                                }
                              />
                            ) : (
                              order.person_in_charge ?? '-'
                            )}
                          </td>
                          <td className="text-right cell-amount">
                            {isEditing ? (
                              <>
                                <input
                                  type="number"
                                  className="cell-input cell-input-num"
                                  value={form.unit_price}
                                  onChange={(e) =>
                                    setEditForm((p) =>
                                      patchForm(
                                        p,
                                        'unit_price',
                                        Number(e.target.value),
                                      ),
                                    )
                                  }
                                />
                                <span className="cell-amount-total">
                                  {Number(form.total_amount).toLocaleString()}
                                </span>
                              </>
                            ) : (
                              (order.total_amount?.toLocaleString() ?? 0)
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <>
                                <button
                                  className="btn btn-primary btn-sm"
                                  disabled={saving}
                                  onClick={() =>
                                    validateAndSave(
                                      editForm,
                                      editCustomerName,
                                      order.id,
                                    )
                                  }
                                >
                                  저장
                                </button>{' '}
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={cancelEdit}
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <>
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
                              </>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr
                            key={`${order.id}-detail`}
                            className="order-expanded-row"
                          >
                            <td colSpan={14}>
                              <OrderDetailPanel
                                form={form}
                                isEditing={isEditing}
                                items={items}
                                onFormChange={setEditForm}
                              />
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

function OrderDetailPanel({
  form,
  isEditing,
  items,
  onFormChange,
}: {
  form: OrderInput;
  isEditing: boolean;
  items: Item[];
  onFormChange: Dispatch<SetStateAction<OrderInput>>;
}) {
  const set = (field: keyof OrderInput, value: string | number | null) => {
    if (!isEditing) return;
    onFormChange((prev) => patchForm(prev, field, value));
  };

  return (
    <div className="order-detail-panel">
      <div className="order-detail-grid">
        <DetailField label="접수일" value={form.received_date ?? '-'}>
          {isEditing && (
            <input
              type="date"
              className="cell-input"
              value={form.received_date ?? ''}
              onChange={(e) => set('received_date', e.target.value)}
            />
          )}
        </DetailField>
        <DetailField
          label="연결 품목"
          value={formatLinkedItem(form.item_id, items, {
            drawing_no: form.drawing_no,
            item_name: form.item_name,
          })}
        />
        <DetailField label="재질" value={form.material ?? '-'} />
        <DetailField label="후처리" value={form.surface_treatment ?? '-'} />
        <DetailField label="단가" value={Number(form.unit_price).toLocaleString()}>
          {isEditing && (
            <input
              type="number"
              className="cell-input"
              value={form.unit_price}
              onChange={(e) => set('unit_price', Number(e.target.value))}
            />
          )}
        </DetailField>
        <DetailField
          label="생산수량"
          value={String(form.produced_quantity ?? 0)}
        />
        <DetailField
          label="불량수량"
          value={String(form.defect_quantity ?? 0)}
        />
        <DetailField label="프로젝트명" value={form.project_name ?? '-'}>
          {isEditing && (
            <input
              className="cell-input"
              value={form.project_name ?? ''}
              onChange={(e) => set('project_name', e.target.value)}
            />
          )}
        </DetailField>
        <DetailField label="진행처" value={form.progress_place ?? '-'}>
          {isEditing && (
            <input
              className="cell-input"
              value={form.progress_place ?? ''}
              onChange={(e) => set('progress_place', e.target.value)}
            />
          )}
        </DetailField>
        <DetailField label="도면파일명" value={form.drawing_file_name ?? '-'}>
          {isEditing && (
            <input
              className="cell-input"
              value={form.drawing_file_name ?? ''}
              onChange={(e) => set('drawing_file_name', e.target.value)}
            />
          )}
        </DetailField>
        <DetailField label="비고1" value={form.memo1 ?? '-'} wide>
          {isEditing && (
            <textarea
              className="cell-input"
              rows={2}
              value={form.memo1 ?? ''}
              onChange={(e) => set('memo1', e.target.value)}
            />
          )}
        </DetailField>
        <DetailField label="비고2" value={form.memo2 ?? '-'} wide>
          {isEditing && (
            <textarea
              className="cell-input"
              rows={2}
              value={form.memo2 ?? ''}
              onChange={(e) => set('memo2', e.target.value)}
            />
          )}
        </DetailField>
      </div>
      {!isEditing && (
        <p className="order-detail-hint">
          상세 항목을 수정하려면 <strong>편집</strong>을 눌러 주세요.
        </p>
      )}
    </div>
  );
}

function DetailField({
  label,
  value,
  children,
  wide,
}: {
  label: string;
  value: string;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`order-detail-field${wide ? ' wide' : ''}`}>
      <span className="order-detail-label">{label}</span>
      {children ?? (
        <span className="order-detail-value">{value || '-'}</span>
      )}
    </div>
  );
}
