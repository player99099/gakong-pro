import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  updateCustomer,
  type CustomerInput,
} from '../services/customers';
import type { Customer } from '../types';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

const emptyForm: CustomerInput = {
  customer_name: '',
  manager_name: '',
  phone: '',
  company_email: '',
  personal_email: '',
  address: '',
  business_type: '',
  memo: '',
};

export function CustomersPage() {
  const { userEmail } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>(emptyForm);
  const [formError, setFormError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomers(search);
      setCustomers(data);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '고객사 목록을 불러오지 못했습니다.',
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

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      customer_name: c.customer_name,
      manager_name: c.manager_name ?? '',
      phone: c.phone ?? '',
      company_email: c.company_email ?? '',
      personal_email: c.personal_email ?? '',
      address: c.address ?? '',
      business_type: c.business_type ?? '',
      memo: c.memo ?? '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.customer_name.trim()) {
      setFormError('고객사명은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCustomer(editing.id, form, userEmail);
      } else {
        await createCustomer(form, userEmail);
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
    if (!confirm('이 고객사를 삭제하시겠습니까?')) return;
    try {
      await deleteCustomer(id);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '삭제에 실패했습니다.',
      );
    }
  };

  const updateField = (field: keyof CustomerInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">고객사 관리</h1>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            + 고객사 등록
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="search-bar">
        <div className="form-group">
          <label>검색</label>
          <input
            placeholder="고객사명, 담당자, 거래종목"
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
          ) : customers.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>고객사명</th>
                    <th>담당자</th>
                    <th>연락처</th>
                    <th>회사 이메일</th>
                    <th>거래종목</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className={selectedId === c.id ? 'selected' : ''}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <td>{c.customer_name}</td>
                      <td>{c.manager_name ?? '-'}</td>
                      <td>{c.phone ?? '-'}</td>
                      <td>{c.company_email ?? '-'}</td>
                      <td>{c.business_type ?? '-'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(c)}
                        >
                          수정
                        </button>{' '}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(c.id)}
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
        title={editing ? '고객사 수정' : '고객사 등록'}
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
              고객사명 <span className="required">*</span>
            </label>
            <input
              value={form.customer_name}
              onChange={(e) => updateField('customer_name', e.target.value)}
            />
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
            <label>회사 이메일</label>
            <input
              value={form.company_email ?? ''}
              onChange={(e) => updateField('company_email', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>개인 이메일</label>
            <input
              value={form.personal_email ?? ''}
              onChange={(e) => updateField('personal_email', e.target.value)}
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
