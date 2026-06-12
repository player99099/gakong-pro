import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { VENDOR_TYPES } from '../lib/constants';
import {
  createVendor,
  deleteVendor,
  fetchVendors,
  updateVendor,
  type VendorInput,
} from '../services/vendors';
import type { Vendor } from '../types';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

const emptyForm: VendorInput = {
  vendor_name: '',
  vendor_type: '소재',
  manager_name: '',
  phone: '',
  email: '',
  address: '',
  business_type: '',
  memo: '',
};

export function VendorsPage() {
  const { userEmail } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorInput>(emptyForm);
  const [formError, setFormError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchVendors(search);
      setVendors(data);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '매입업체 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({
      vendor_name: v.vendor_name,
      vendor_type: v.vendor_type ?? '소재',
      manager_name: v.manager_name ?? '',
      phone: v.phone ?? '',
      email: v.email ?? '',
      address: v.address ?? '',
      business_type: v.business_type ?? '',
      memo: v.memo ?? '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.vendor_name.trim()) {
      setFormError('업체명은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateVendor(editing.id, form, userEmail);
      } else {
        await createVendor(form, userEmail);
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
    if (!confirm('이 매입업체를 삭제하시겠습니까?')) return;
    try {
      await deleteVendor(id);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '삭제에 실패했습니다.',
      );
    }
  };

  const updateField = (field: keyof VendorInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">매입업체 관리</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            + 매입업체 등록
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="search-bar">
        <div className="form-group">
          <label>검색</label>
          <input
            placeholder="업체명, 담당자, 구분"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          ) : vendors.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>업체명</th>
                    <th>구분</th>
                    <th>담당자</th>
                    <th>연락처</th>
                    <th>이메일</th>
                    <th>거래종목</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr
                      key={v.id}
                      className={selectedId === v.id ? 'selected' : ''}
                      onClick={() => setSelectedId(v.id)}
                    >
                      <td>{v.vendor_name}</td>
                      <td>{v.vendor_type ?? '-'}</td>
                      <td>{v.manager_name ?? '-'}</td>
                      <td>{v.phone ?? '-'}</td>
                      <td>{v.email ?? '-'}</td>
                      <td>{v.business_type ?? '-'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(v)}
                        >
                          수정
                        </button>{' '}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(v.id)}
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
        title={editing ? '매입업체 수정' : '매입업체 등록'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setModalOpen(false)}
            >
              취소
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-error">{formError}</div>}
        <div className="form-grid">
          <div className="form-group">
            <label>
              업체명 <span className="required">*</span>
            </label>
            <input
              value={form.vendor_name}
              onChange={(e) => updateField('vendor_name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>구분</label>
            <select
              value={form.vendor_type ?? ''}
              onChange={(e) => updateField('vendor_type', e.target.value)}
            >
              {VENDOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>담당자</label>
            <input
              value={form.manager_name ?? ''}
              onChange={(e) => updateField('manager_name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>연락처</label>
            <input
              value={form.phone ?? ''}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>이메일</label>
            <input
              value={form.email ?? ''}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>거래종목</label>
            <input
              value={form.business_type ?? ''}
              onChange={(e) => updateField('business_type', e.target.value)}
            />
          </div>
          <div className="form-group full-width">
            <label>주소</label>
            <input
              value={form.address ?? ''}
              onChange={(e) => updateField('address', e.target.value)}
            />
          </div>
          <div className="form-group full-width">
            <label>비고</label>
            <textarea
              value={form.memo ?? ''}
              onChange={(e) => updateField('memo', e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
