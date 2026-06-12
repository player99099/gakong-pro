import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createDelivery,
  deleteDelivery,
  getDeliverableOrderGroups,
  getDeliveries,
  getDeliveryById,
  getDeliveryStats,
  getOrdersByOrderNo,
  updateDelivery,
} from '../services/deliveries';
import type {
  DeliveryFormData,
  DeliveryItemFormData,
  DeliveryOrderGroup,
  DeliverySearchParams,
  DeliveryStats,
  DeliveryWithItems,
  Order,
} from '../types';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { supabase } from '../lib/supabase';

const emptySearch: DeliverySearchParams = {
  deliveryDateFrom: '',
  deliveryDateTo: '',
  customerName: '',
  orderNo: '',
};

const emptyForm = (): DeliveryFormData => ({
  delivery_date: new Date().toISOString().split('T')[0],
  customer_id: null,
  customer_name: '',
  order_no: '',
  memo: '',
  items: [],
});

function ordersToFormItems(
  orders: Order[],
  existingItems?: { order_id: string; delivery_quantity: number; memo: string | null }[],
): DeliveryItemFormData[] {
  const existingMap = new Map(
    (existingItems ?? []).map((i) => [i.order_id, i]),
  );

  return orders.map((order) => {
    const existing = existingMap.get(order.id);
    const deliveryQty = existing ? Number(existing.delivery_quantity) : 0;
    const unitPrice = Number(order.unit_price) || 0;
    return {
      order_id: order.id,
      drawing_no: order.drawing_no ?? '',
      item_name: order.item_name ?? '',
      order_quantity: Number(order.order_quantity),
      delivered_quantity: Number(order.delivered_quantity),
      remaining_quantity: Number(order.remaining_quantity),
      delivery_quantity: deliveryQty,
      unit_price: unitPrice,
      amount: deliveryQty * unitPrice,
      memo: existing?.memo ?? '',
      checked: !!existing && deliveryQty > 0,
    };
  });
}

export function DeliveryPage() {
  const { userEmail } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryWithItems[]>([]);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [searchParams, setSearchParams] = useState<DeliverySearchParams>(emptySearch);
  const [orderGroups, setOrderGroups] = useState<DeliveryOrderGroup[]>([]);
  const [includeAllOrders, setIncludeAllOrders] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryWithItems | null>(null);
  const [form, setForm] = useState<DeliveryFormData>(emptyForm());
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, stat] = await Promise.all([
        getDeliveries(searchParams),
        getDeliveryStats(),
      ]);
      setDeliveries(list);
      setStats(stat);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '납품 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  const loadOrderGroups = useCallback(async (includeAll = includeAllOrders) => {
    try {
      const groups = await getDeliverableOrderGroups(includeAll);
      setOrderGroups(groups);
    } catch {
      setOrderGroups([]);
    }
  }, [includeAllOrders]);

  useEffect(() => {
    load();
    loadOrderGroups();
  }, [load, loadOrderGroups]);

  const loadOrdersForForm = async (
    orderNo: string,
    existingItems?: DeliveryWithItems['delivery_items'],
    forCreate = true,
  ) => {
    let orders = await getOrdersByOrderNo(orderNo);

    if (forCreate) {
      orders = orders.filter((o) => Number(o.remaining_quantity) > 0);
    }

    if (existingItems?.length) {
      const ids = new Set(orders.map((o) => o.id));
      const missingIds = existingItems
        .map((i) => i.order_id)
        .filter((id) => !ids.has(id));
      if (missingIds.length) {
        const { data } = await supabase
          .from('orders')
          .select('*, customers(customer_name)')
          .in('id', missingIds);
        if (data) orders = [...orders, ...data];
      }
    }

    const customer = orders[0]?.customers?.customer_name ?? '';
    const customerId = orders[0]?.customer_id ?? null;

    setForm((prev) => ({
      ...prev,
      order_no: orderNo,
      customer_id: customerId,
      customer_name: customer,
      items: ordersToFormItems(
        orders,
        existingItems?.map((i) => ({
          order_id: i.order_id,
          delivery_quantity: Number(i.delivery_quantity),
          memo: i.memo,
        })),
      ),
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = async (delivery: DeliveryWithItems) => {
    setEditing(delivery);
    setFormError('');
    setModalOpen(true);
    try {
      const full = await getDeliveryById(delivery.id);
      setForm({
        delivery_date: full.delivery_date,
        customer_id: full.customer_id,
        customer_name: full.customers?.customer_name ?? '',
        order_no: full.order_no,
        memo: full.memo ?? '',
        items: [],
      });
      await loadOrdersForForm(full.order_no, full.delivery_items, false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '납품 정보를 불러오지 못했습니다.',
      );
    }
  };

  const handleOrderNoChange = async (orderNo: string) => {
    setForm((prev) => ({ ...prev, order_no: orderNo, items: [] }));
    if (!orderNo) return;
    try {
      await loadOrdersForForm(orderNo, undefined, !editing);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '수주 정보를 불러오지 못했습니다.',
      );
    }
  };

  const updateItem = (
    orderId: string,
    field: keyof DeliveryItemFormData,
    value: string | number | boolean,
  ) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.order_id !== orderId) return item;
        const next = { ...item, [field]: value };
        if (field === 'delivery_quantity' || field === 'unit_price') {
          next.amount = Number(next.delivery_quantity) * Number(next.unit_price);
        }
        if (field === 'checked' && value === true && next.delivery_quantity === 0) {
          next.delivery_quantity = next.remaining_quantity;
          next.amount = next.delivery_quantity * next.unit_price;
        }
        return next;
      }),
    }));
  };

  const fillAllRemaining = () => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        const maxQty = editing
          ? item.remaining_quantity +
            (editing.delivery_items.find((d) => d.order_id === item.order_id)
              ? Number(
                  editing.delivery_items.find((d) => d.order_id === item.order_id)!
                    .delivery_quantity,
                )
              : 0)
          : item.remaining_quantity;
        return {
          ...item,
          checked: maxQty > 0,
          delivery_quantity: maxQty,
          amount: maxQty * item.unit_price,
        };
      }),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateDelivery(editing.id, form, userEmail);
        setSuccessMsg('납품이 수정되었습니다.');
      } else {
        await createDelivery(form, userEmail);
        setSuccessMsg('납품이 등록되었습니다.');
      }
      setModalOpen(false);
      await load();
      await loadOrderGroups();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 납품을 삭제하시겠습니까? 수주 납품수량이 재계산됩니다.')) return;
    try {
      await deleteDelivery(id, userEmail);
      setSuccessMsg('납품이 삭제되었습니다.');
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '삭제에 실패했습니다.',
      );
    }
  };

  const updateSearch = (field: keyof DeliverySearchParams, value: string) => {
    setSearchParams((prev) => ({ ...prev, [field]: value }));
  };

  const formTotalAmount = form.items
    .filter((i) => i.checked && i.delivery_quantity > 0)
    .reduce((s, i) => s + i.delivery_quantity * i.unit_price, 0);

  const formTotalQty = form.items
    .filter((i) => i.checked && i.delivery_quantity > 0)
    .reduce((s, i) => s + i.delivery_quantity, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">납품관리</h1>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={() =>
              alert('거래명세표 출력 기능은 다음 단계에서 구현 예정입니다.')
            }
          >
            거래명세표 출력
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            + 납품 등록
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && (
        <div className="alert alert-success">{successMsg}</div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card primary">
          <div className="stat-label">총 납품건수</div>
          <div className="stat-value">{stats?.totalCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">오늘 납품</div>
          <div className="stat-value">{stats?.todayCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">이번 달 납품금액</div>
          <div className="stat-value" style={{ fontSize: '22px' }}>
            {(stats?.monthAmount ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">부분납품 진행 건</div>
          <div className="stat-value">{stats?.partialOrderCount ?? 0}</div>
        </div>
      </div>

      <div className="search-bar">
        <div className="form-group">
          <label>납품일(부터)</label>
          <input
            type="date"
            value={searchParams.deliveryDateFrom ?? ''}
            onChange={(e) => updateSearch('deliveryDateFrom', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>납품일(까지)</label>
          <input
            type="date"
            value={searchParams.deliveryDateTo ?? ''}
            onChange={(e) => updateSearch('deliveryDateTo', e.target.value)}
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
        <button className="btn btn-secondary" onClick={load}>
          검색
        </button>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-spinner">로딩 중...</div>
          ) : deliveries.length === 0 ? (
            <EmptyState message="등록된 납품이 없습니다." />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>납품일</th>
                    <th>고객사</th>
                    <th>발주번호</th>
                    <th>품목수</th>
                    <th>총 납품수량</th>
                    <th className="text-right">총 납품금액</th>
                    <th>비고</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr
                      key={d.id}
                      className={selectedId === d.id ? 'selected' : ''}
                      onClick={() => setSelectedId(d.id)}
                    >
                      <td>{d.delivery_date}</td>
                      <td>{d.customers?.customer_name ?? '-'}</td>
                      <td>{d.order_no}</td>
                      <td>{d.item_count ?? d.delivery_items?.length ?? 0}</td>
                      <td>{Number(d.total_quantity).toLocaleString()}</td>
                      <td className="text-right">
                        {Number(d.total_amount).toLocaleString()}
                      </td>
                      <td>{d.memo ?? '-'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(d)}
                        >
                          수정
                        </button>{' '}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(d.id)}
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
        title={editing ? '납품 수정' : '납품 등록'}
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
              납품일 <span className="required">*</span>
            </label>
            <input
              type="date"
              value={form.delivery_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, delivery_date: e.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label>
              발주번호 <span className="required">*</span>
            </label>
            <select
              value={form.order_no}
              onChange={(e) => handleOrderNoChange(e.target.value)}
              disabled={!!editing}
            >
              <option value="">선택</option>
              {orderGroups.map((g) => (
                <option key={`${g.customer_id ?? ''}-${g.order_no}`} value={g.order_no}>
                  {g.priority ? '★ ' : ''}
                  {g.label}
                </option>
              ))}
              {editing &&
                form.order_no &&
                !orderGroups.some((g) => g.order_no === form.order_no) && (
                  <option value={form.order_no}>{form.order_no}</option>
                )}
            </select>
          </div>
          {!editing && (
            <div className="form-group">
              <label>수주 선택 범위</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={includeAllOrders}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    setIncludeAllOrders(checked);
                    await loadOrderGroups(checked);
                  }}
                />
                출하대기 외 수주도 포함
              </label>
            </div>
          )}
          <div className="form-group">
            <label>고객사</label>
            <input value={form.customer_name} readOnly style={{ background: '#f4f7fb' }} />
          </div>
          <div className="form-group full-width">
            <label>비고</label>
            <input
              value={form.memo}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, memo: e.target.value }))
              }
            />
          </div>
        </div>

        {form.order_no && (
          <div className="mt-16">
            <div className="detail-panel-header">
              <h3>납품 품목</h3>
              <button className="btn btn-secondary btn-sm" onClick={fillAllRemaining}>
                잔량 전체 납품
              </button>
            </div>

            {form.items.length === 0 ? (
              <EmptyState
                message="납품 가능한 수주 품목이 없습니다."
                subMessage="잔량이 있는 수주를 확인해 주세요."
              />
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>도번</th>
                      <th>품명</th>
                      <th>수주수량</th>
                      <th>기존 납품</th>
                      <th>잔량</th>
                      <th>이번 납품</th>
                      <th>단가</th>
                      <th>금액</th>
                      <th>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item) => (
                      <tr key={item.order_id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) =>
                              updateItem(item.order_id, 'checked', e.target.checked)
                            }
                          />
                        </td>
                        <td>{item.drawing_no || '-'}</td>
                        <td>{item.item_name || '-'}</td>
                        <td>{item.order_quantity}</td>
                        <td>{item.delivered_quantity}</td>
                        <td>{item.remaining_quantity}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            style={{ width: 80, height: 32 }}
                            value={item.delivery_quantity}
                            disabled={!item.checked}
                            onChange={(e) =>
                              updateItem(
                                item.order_id,
                                'delivery_quantity',
                                Number(e.target.value),
                              )
                            }
                          />
                        </td>
                        <td>{item.unit_price.toLocaleString()}</td>
                        <td>{item.amount.toLocaleString()}</td>
                        <td>
                          <input
                            style={{ width: 100, height: 32 }}
                            value={item.memo}
                            disabled={!item.checked}
                            onChange={(e) =>
                              updateItem(item.order_id, 'memo', e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                textAlign: 'right',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--color-text-heading)',
              }}
            >
              합계: 수량 {formTotalQty.toLocaleString()} / 금액{' '}
              {formTotalAmount.toLocaleString()}원
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
