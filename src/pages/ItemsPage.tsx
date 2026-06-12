import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ITEM_TYPES } from '../lib/constants';
import { fetchCustomers } from '../services/customers';
import {
  createBomItem,
  createItem,
  deleteBomItem,
  deleteItem,
  fetchBomItems,
  fetchItems,
  updateBomItem,
  updateItem,
  type BomItemInput,
  type ItemInput,
} from '../services/items';
import type { BomItem, Customer, Item } from '../types';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

const emptyItemForm: ItemInput = {
  customer_id: null,
  drawing_no: '',
  item_name: '',
  material: '',
  surface_treatment: '',
  level: '',
  item_type: '가공품',
  quantity: 0,
  total_quantity: 0,
  unit_price: 0,
  memo: '',
};

const emptyBomForm: BomItemInput = {
  parent_item_id: '',
  no: 1,
  level: '',
  drawing_no: '',
  item_name: '',
  material: '',
  surface_treatment: '',
  item_type: '단품',
  quantity: 0,
  total_quantity: 0,
  unit_price: 0,
  memo: '',
};

export function ItemsPage() {
  const { userEmail } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [bomModalOpen, setBomModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingBom, setEditingBom] = useState<BomItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemInput>(emptyItemForm);
  const [bomForm, setBomForm] = useState<BomItemInput>(emptyBomForm);
  const [formError, setFormError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchItems(search);
      setItems(data);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '품목 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadBom = useCallback(async (parentId: string) => {
    try {
      const data = await fetchBomItems(parentId);
      setBomItems(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'BOM 목록을 불러오지 못했습니다.',
      );
    }
  }, []);

  useEffect(() => {
    loadItems();
    fetchCustomers().then(setCustomers).catch(() => {});
  }, [loadItems]);

  useEffect(() => {
    if (selectedId) {
      loadBom(selectedId);
    } else {
      setBomItems([]);
    }
  }, [selectedId, loadBom]);

  const openCreateItem = () => {
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setFormError('');
    setItemModalOpen(true);
  };

  const openEditItem = (item: Item) => {
    setEditingItem(item);
    setItemForm({
      customer_id: item.customer_id,
      drawing_no: item.drawing_no ?? '',
      item_name: item.item_name,
      material: item.material ?? '',
      surface_treatment: item.surface_treatment ?? '',
      level: item.level ?? '',
      item_type: item.item_type ?? '가공품',
      quantity: item.quantity,
      total_quantity: item.total_quantity,
      unit_price: item.unit_price,
      memo: item.memo ?? '',
    });
    setFormError('');
    setItemModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.item_name.trim()) {
      setFormError('품명은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, itemForm, userEmail);
      } else {
        const created = await createItem(itemForm, userEmail);
        setSelectedId(created.id);
      }
      setItemModalOpen(false);
      await loadItems();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('이 품목을 삭제하시겠습니까? BOM도 함께 삭제됩니다.')) return;
    try {
      await deleteItem(id);
      if (selectedId === id) setSelectedId(null);
      await loadItems();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '삭제에 실패했습니다.',
      );
    }
  };

  const openCreateBom = () => {
    if (!selectedId) return;
    setEditingBom(null);
    setBomForm({ ...emptyBomForm, parent_item_id: selectedId, no: bomItems.length + 1 });
    setFormError('');
    setBomModalOpen(true);
  };

  const openEditBom = (bom: BomItem) => {
    setEditingBom(bom);
    setBomForm({
      parent_item_id: bom.parent_item_id,
      no: bom.no,
      level: bom.level ?? '',
      drawing_no: bom.drawing_no ?? '',
      item_name: bom.item_name,
      material: bom.material ?? '',
      surface_treatment: bom.surface_treatment ?? '',
      item_type: bom.item_type ?? '단품',
      quantity: bom.quantity,
      total_quantity: bom.total_quantity,
      unit_price: bom.unit_price,
      memo: bom.memo ?? '',
    });
    setFormError('');
    setBomModalOpen(true);
  };

  const handleSaveBom = async () => {
    if (!bomForm.item_name.trim()) {
      setFormError('품명은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      if (editingBom) {
        await updateBomItem(editingBom.id, bomForm, userEmail);
      } else {
        await createBomItem(bomForm, userEmail);
      }
      setBomModalOpen(false);
      if (selectedId) await loadBom(selectedId);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBom = async (id: string) => {
    if (!confirm('이 BOM 항목을 삭제하시겠습니까?')) return;
    try {
      await deleteBomItem(id);
      if (selectedId) await loadBom(selectedId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '삭제에 실패했습니다.',
      );
    }
  };

  const updateItemField = (field: keyof ItemInput, value: string | number | null) => {
    setItemForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateBomField = (field: keyof BomItemInput, value: string | number) => {
    setBomForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectedItem = items.find((i) => i.id === selectedId);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">품목/BOM 관리</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreateItem}>
            + 품목 등록
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="search-bar">
        <div className="form-group">
          <label>검색</label>
          <input
            placeholder="도번, 품명, 재질"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" onClick={loadItems}>
          검색
        </button>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-spinner">로딩 중...</div>
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>고객사</th>
                    <th>도번</th>
                    <th>품명</th>
                    <th>재질</th>
                    <th>후처리</th>
                    <th>유형</th>
                    <th>단가</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={selectedId === item.id ? 'selected' : ''}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td>{item.customers?.customer_name ?? '-'}</td>
                      <td>{item.drawing_no ?? '-'}</td>
                      <td>{item.item_name}</td>
                      <td>{item.material ?? '-'}</td>
                      <td>{item.surface_treatment ?? '-'}</td>
                      <td>{item.item_type ?? '-'}</td>
                      <td>{item.unit_price?.toLocaleString()}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditItem(item)}
                        >
                          수정
                        </button>{' '}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteItem(item.id)}
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

      {selectedId && selectedItem && (
        <div className="detail-panel card">
          <div className="card-body">
            <div className="detail-panel-header">
              <h3>
                BOM 상세 — {selectedItem.item_name} ({selectedItem.drawing_no ?? '도번없음'})
              </h3>
              <button className="btn btn-primary btn-sm" onClick={openCreateBom}>
                + BOM 추가
              </button>
            </div>
            {bomItems.length === 0 ? (
              <EmptyState
                message="등록된 BOM이 없습니다."
                subMessage="BOM 항목을 추가해 주세요."
              />
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>NO</th>
                      <th>레벨</th>
                      <th>도번</th>
                      <th>품명</th>
                      <th>재질</th>
                      <th>후처리</th>
                      <th>유형</th>
                      <th>소요량</th>
                      <th>총소요량</th>
                      <th>단가</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomItems.map((bom) => (
                      <tr key={bom.id}>
                        <td>{bom.no}</td>
                        <td>{bom.level ?? '-'}</td>
                        <td>{bom.drawing_no ?? '-'}</td>
                        <td>{bom.item_name}</td>
                        <td>{bom.material ?? '-'}</td>
                        <td>{bom.surface_treatment ?? '-'}</td>
                        <td>{bom.item_type ?? '-'}</td>
                        <td>{bom.quantity}</td>
                        <td>{bom.total_quantity}</td>
                        <td>{bom.unit_price?.toLocaleString()}</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditBom(bom)}
                          >
                            수정
                          </button>{' '}
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteBom(bom.id)}
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
      )}

      <Modal
        title={editingItem ? '품목 수정' : '품목 등록'}
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setItemModalOpen(false)}>
              취소
            </button>
            <button className="btn btn-primary" onClick={handleSaveItem} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        <div className="form-grid cols-3">
          <div className="form-group">
            <label>고객사</label>
            <select
              value={itemForm.customer_id ?? ''}
              onChange={(e) =>
                updateItemField('customer_id', e.target.value || null)
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
            <label>도번</label>
            <input
              value={itemForm.drawing_no ?? ''}
              onChange={(e) => updateItemField('drawing_no', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>
              품명 <span className="required">*</span>
            </label>
            <input
              value={itemForm.item_name}
              onChange={(e) => updateItemField('item_name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>재질</label>
            <input
              value={itemForm.material ?? ''}
              onChange={(e) => updateItemField('material', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>후처리</label>
            <input
              value={itemForm.surface_treatment ?? ''}
              onChange={(e) => updateItemField('surface_treatment', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>레벨</label>
            <input
              value={itemForm.level ?? ''}
              onChange={(e) => updateItemField('level', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>유형</label>
            <select
              value={itemForm.item_type ?? ''}
              onChange={(e) => updateItemField('item_type', e.target.value)}
            >
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>소요량</label>
            <input
              type="number"
              value={itemForm.quantity}
              onChange={(e) => updateItemField('quantity', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>총소요량</label>
            <input
              type="number"
              value={itemForm.total_quantity}
              onChange={(e) =>
                updateItemField('total_quantity', Number(e.target.value))
              }
            />
          </div>
          <div className="form-group">
            <label>단가</label>
            <input
              type="number"
              value={itemForm.unit_price}
              onChange={(e) => updateItemField('unit_price', Number(e.target.value))}
            />
          </div>
          <div className="form-group full-width">
            <label>비고</label>
            <textarea
              value={itemForm.memo ?? ''}
              onChange={(e) => updateItemField('memo', e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={editingBom ? 'BOM 수정' : 'BOM 추가'}
        open={bomModalOpen}
        onClose={() => setBomModalOpen(false)}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setBomModalOpen(false)}>
              취소
            </button>
            <button className="btn btn-primary" onClick={handleSaveBom} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        <div className="form-grid cols-3">
          <div className="form-group">
            <label>NO</label>
            <input
              type="number"
              value={bomForm.no}
              onChange={(e) => updateBomField('no', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>레벨</label>
            <input
              value={bomForm.level ?? ''}
              onChange={(e) => updateBomField('level', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>도번</label>
            <input
              value={bomForm.drawing_no ?? ''}
              onChange={(e) => updateBomField('drawing_no', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>
              품명 <span className="required">*</span>
            </label>
            <input
              value={bomForm.item_name}
              onChange={(e) => updateBomField('item_name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>재질</label>
            <input
              value={bomForm.material ?? ''}
              onChange={(e) => updateBomField('material', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>후처리</label>
            <input
              value={bomForm.surface_treatment ?? ''}
              onChange={(e) => updateBomField('surface_treatment', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>유형</label>
            <select
              value={bomForm.item_type ?? ''}
              onChange={(e) => updateBomField('item_type', e.target.value)}
            >
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>소요량</label>
            <input
              type="number"
              value={bomForm.quantity}
              onChange={(e) => updateBomField('quantity', Number(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>총소요량</label>
            <input
              type="number"
              value={bomForm.total_quantity}
              onChange={(e) =>
                updateBomField('total_quantity', Number(e.target.value))
              }
            />
          </div>
          <div className="form-group">
            <label>단가</label>
            <input
              type="number"
              value={bomForm.unit_price}
              onChange={(e) => updateBomField('unit_price', Number(e.target.value))}
            />
          </div>
          <div className="form-group full-width">
            <label>비고</label>
            <textarea
              value={bomForm.memo ?? ''}
              onChange={(e) => updateBomField('memo', e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
