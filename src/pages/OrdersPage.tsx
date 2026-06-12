import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ORDER_STATUSES, PROCESS_STATUSES } from '../lib/constants';
import { fetchCustomers } from '../services/customers';
import { fetchItems } from '../services/items';
import {
  createOrder,
  deleteOrder,
  fetchOrders,
  updateOrder,
  type OrderInput,
} from '../services/orders';
import type { Customer, Item, Order, OrderSearchParams } from '../types';
import { OrderStatusBadge, ProcessStatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

const emptyForm: OrderInput = {
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
};

const emptySearch: OrderSearchParams = {
  customerName: '',
  orderNo: '',
  drawingNo: '',
  itemName: '',
  orderStatus: '',
  dueDateFrom: '',
  dueDateTo: '',
};

export function OrdersPage() {
  const { userEmail } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [searchParams, setSearchParams] = useState<OrderSearchParams>(emptySearch);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderInput>(emptyForm);
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

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      received_date: new Date().toISOString().split('T')[0],
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (order: Order) => {
    setEditing(order);
    setForm({
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
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleItemSelect = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      updateField('item_id', itemId || null);
      return;
    }
    const qty = form.order_quantity || 0;
    const price = item.unit_price || 0;
    setForm((prev) => ({
      ...prev,
      item_id: itemId,
      drawing_no: item.drawing_no ?? '',
      item_name: item.item_name,
      material: item.material ?? '',
      surface_treatment: item.surface_treatment ?? '',
      unit_price: price,
      total_amount: qty * price,
      remaining_quantity: qty - (prev.delivered_quantity || 0),
      customer_id: item.customer_id ?? prev.customer_id,
    }));
  };

  const updateField = (
    field: keyof OrderInput,
    value: string | number | null,
  ) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'order_quantity' || field === 'unit_price') {
        const qty =
          field === 'order_quantity' ? Number(value) : prev.order_quantity;
        const price = field === 'unit_price' ? Number(value) : prev.unit_price;
        next.total_amount = qty * price;
        next.remaining_quantity = qty - (prev.delivered_quantity || 0);
      }
      if (field === 'delivered_quantity') {
        next.remaining_quantity =
          (prev.order_quantity || 0) - Number(value);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.customer_id) {
      setFormError('거래처를 선택해 주세요.');
      return;
    }
    if (!form.item_name?.trim() && !form.drawing_no?.trim()) {
      setFormError('품목 또는 도번을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateOrder(editing.id, form, userEmail);
      } else {
        await createOrder(form, userEmail);
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
    if (!confirm('이 수주를 삭제하시겠습니까?')) return;
    try {
      await deleteOrder(id);
      if (selectedId === id) setSelectedId(null);
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">수주관리</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            + 수주 등록
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

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
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-spinner">로딩 중...</div>
          ) : orders.length === 0 ? (
            <EmptyState message="등록된 수주가 없습니다." />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>공정상태</th>
                    <th>거래처</th>
                    <th>발주번호</th>
                    <th>도번</th>
                    <th>품명</th>
                    <th>수량</th>
                    <th>납품수량</th>
                    <th>잔량</th>
                    <th>납기일</th>
                    <th>담당자</th>
                    <th>진행처</th>
                    <th className="text-right">금액</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className={selectedId === order.id ? 'selected' : ''}
                      onClick={() => setSelectedId(order.id)}
                    >
                      <td>
                        <OrderStatusBadge status={order.order_status} />
                      </td>
                      <td>
                        <ProcessStatusBadge status={order.process_status} />
                      </td>
                      <td>{order.customers?.customer_name ?? '-'}</td>
                      <td>{order.order_no ?? '-'}</td>
                      <td>{order.drawing_no ?? '-'}</td>
                      <td>{order.item_name ?? '-'}</td>
                      <td>{order.order_quantity}</td>
                      <td>{order.delivered_quantity}</td>
                      <td>{order.remaining_quantity}</td>
                      <td>{order.due_date ?? '-'}</td>
                      <td>{order.person_in_charge ?? '-'}</td>
                      <td>{order.progress_place ?? '-'}</td>
                      <td className="text-right">
                        {order.total_amount?.toLocaleString() ?? 0}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(order)}
                        >
                          수정
                        </button>{' '}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(order.id)}
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
        title={editing ? '수주 수정' : '수주 등록'}
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
          <div className="form-group">
            <label>
              거래처 <span className="required">*</span>
            </label>
            <select
              value={form.customer_id ?? ''}
              onChange={(e) =>
                updateField('customer_id', e.target.value || null)
              }
            >
              <option value="">선택</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>발주번호</label>
            <input
              value={form.order_no ?? ''}
              onChange={(e) => updateField('order_no', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>접수일</label>
            <input
              type="date"
              value={form.received_date ?? ''}
              onChange={(e) => updateField('received_date', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>납기일</label>
            <input
              type="date"
              value={form.due_date ?? ''}
              onChange={(e) => updateField('due_date', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>품목 선택</label>
            <select
              value={form.item_id ?? ''}
              onChange={(e) => handleItemSelect(e.target.value)}
            >
              <option value="">직접 입력</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.drawing_no ? `${item.drawing_no} - ` : ''}
                  {item.item_name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>도번</label>
            <input
              value={form.drawing_no ?? ''}
              onChange={(e) => updateField('drawing_no', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>품명</label>
            <input
              value={form.item_name ?? ''}
              onChange={(e) => updateField('item_name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>재질</label>
            <input
              value={form.material ?? ''}
              onChange={(e) => updateField('material', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>후처리</label>
            <input
              value={form.surface_treatment ?? ''}
              onChange={(e) => updateField('surface_treatment', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>수량</label>
            <input
              type="number"
              value={form.order_quantity}
              onChange={(e) =>
                updateField('order_quantity', Number(e.target.value))
              }
            />
          </div>
          <div className="form-group">
            <label>단가</label>
            <input
              type="number"
              value={form.unit_price}
              onChange={(e) => updateField('unit_price', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>금액</label>
            <input
              type="number"
              value={form.total_amount}
              readOnly
              style={{ background: '#f4f7fb' }}
            />
          </div>
          <div className="form-group">
            <label>납품수량</label>
            <input
              type="number"
              value={form.delivered_quantity}
              onChange={(e) =>
                updateField('delivered_quantity', Number(e.target.value))
              }
            />
          </div>
          <div className="form-group">
            <label>잔량</label>
            <input
              type="number"
              value={form.remaining_quantity}
              readOnly
              style={{ background: '#f4f7fb' }}
            />
          </div>
          <div className="form-group">
            <label>설비명/프로젝트명</label>
            <input
              value={form.project_name ?? ''}
              onChange={(e) => updateField('project_name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>담당자</label>
            <input
              value={form.person_in_charge ?? ''}
              onChange={(e) => updateField('person_in_charge', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>진행처</label>
            <input
              value={form.progress_place ?? ''}
              onChange={(e) => updateField('progress_place', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>도면파일명</label>
            <input
              value={form.drawing_file_name ?? ''}
              onChange={(e) => updateField('drawing_file_name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>수주상태</label>
            <select
              value={form.order_status}
              onChange={(e) => updateField('order_status', e.target.value)}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>공정상태</label>
            <select
              value={form.process_status}
              onChange={(e) => updateField('process_status', e.target.value)}
            >
              {PROCESS_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group full-width">
            <label>비고1</label>
            <textarea
              value={form.memo1 ?? ''}
              onChange={(e) => updateField('memo1', e.target.value)}
            />
          </div>
          <div className="form-group full-width">
            <label>비고2</label>
            <textarea
              value={form.memo2 ?? ''}
              onChange={(e) => updateField('memo2', e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
