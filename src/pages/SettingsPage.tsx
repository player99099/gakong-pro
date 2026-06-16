import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  createDefectType,
  createProcessStep,
  createSetupType,
  createSurfaceTreatment,
  fetchCompanySettings,
  fetchDefectTypes,
  fetchProcessSteps,
  fetchSetupTypes,
  fetchSurfaceTreatments,
  updateCompanySettings,
  updateDefectType,
  updateProcessStep,
  updateSetupType,
  updateSurfaceTreatment,
} from '../services/settings';
import type { CompanySettings, SettingItem } from '../types';
import { Modal } from '../components/ui/Modal';
import { NumericInput } from '../components/ui/NumericInput';
import { EmptyState } from '../components/ui/EmptyState';

type SettingTab = 'process' | 'defect' | 'setup' | 'surface' | 'company';

type SettingTabConfig = {
  label: string;
  fetch: () => Promise<SettingItem[]>;
  create: (name: string, sort: number) => Promise<SettingItem>;
  update: (
    id: string,
    updates: Partial<Pick<SettingItem, 'name' | 'sort_order' | 'is_active'>>,
  ) => Promise<SettingItem>;
};

const SETTING_TABS: Record<
  Exclude<SettingTab, 'company'>,
  SettingTabConfig
> = {
  process: {
    label: '공정단계',
    fetch: fetchProcessSteps,
    create: createProcessStep,
    update: updateProcessStep,
  },
  defect: {
    label: '불량유형',
    fetch: fetchDefectTypes,
    create: createDefectType,
    update: updateDefectType,
  },
  setup: {
    label: '세팅유형',
    fetch: fetchSetupTypes,
    create: createSetupType,
    update: updateSetupType,
  },
  surface: {
    label: '후처리',
    fetch: fetchSurfaceTreatments,
    create: createSurfaceTreatment,
    update: updateSurfaceTreatment,
  },
};

const TAB_ORDER: SettingTab[] = ['process', 'defect', 'setup', 'surface', 'company'];

const emptyCompanyForm = {
  company_name: '',
  business_no: '',
  ceo_name: '',
  address: '',
  phone: '',
  email: '',
  memo: '',
};

export function SettingsPage() {
  const { userEmail } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingTab>('process');
  const [items, setItems] = useState<SettingItem[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemSortOrder, setItemSortOrder] = useState(0);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadListTab = useCallback(async (tab: Exclude<SettingTab, 'company'>) => {
    setLoading(true);
    try {
      const data = await SETTING_TABS[tab].fetch();
      setItems(data);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '설정 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompany = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCompanySettings();
      setCompany(data);
      if (data) {
        setCompanyForm({
          company_name: data.company_name ?? '',
          business_no: data.business_no ?? '',
          ceo_name: data.ceo_name ?? '',
          address: data.address ?? '',
          phone: data.phone ?? '',
          email: data.email ?? '',
          memo: data.memo ?? '',
        });
      }
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '회사 정보를 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedId(null);
    if (activeTab === 'company') {
      loadCompany();
    } else {
      loadListTab(activeTab);
    }
  }, [activeTab, loadCompany, loadListTab]);

  const openCreate = () => {
    setEditingItem(null);
    setItemName('');
    setItemSortOrder(
      items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1,
    );
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (item: SettingItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemSortOrder(item.sort_order);
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemName.trim()) {
      setFormError('명칭을 입력해 주세요.');
      return;
    }
    if (activeTab === 'company') return;

    setSaving(true);
    setFormError('');
    try {
      const config = SETTING_TABS[activeTab];
      if (editingItem) {
        await config.update(editingItem.id, {
          name: itemName.trim(),
          sort_order: itemSortOrder,
        });
        setSuccessMsg(`${config.label} 항목이 수정되었습니다.`);
      } else {
        await config.create(itemName.trim(), itemSortOrder);
        setSuccessMsg(`${config.label} 항목이 추가되었습니다.`);
      }
      setModalOpen(false);
      await loadListTab(activeTab);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: SettingItem) => {
    if (activeTab === 'company') return;
    const config = SETTING_TABS[activeTab];
    const nextActive = !item.is_active;
    const action = nextActive ? '활성화' : '비활성화';
    if (
      !nextActive &&
      !confirm(`"${item.name}" 항목을 비활성화하시겠습니까?`)
    ) {
      return;
    }
    try {
      await config.update(item.id, { is_active: nextActive });
      setSuccessMsg(`${item.name} 항목이 ${action}되었습니다.`);
      await loadListTab(activeTab);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `${action}에 실패했습니다.`,
      );
    }
  };

  const handleInlineSortChange = async (item: SettingItem, sortOrder: number) => {
    if (activeTab === 'company') return;
    const config = SETTING_TABS[activeTab];
    try {
      await config.update(item.id, { sort_order: sortOrder });
      setItems((prev) =>
        prev
          .map((i) => (i.id === item.id ? { ...i, sort_order: sortOrder } : i))
          .sort((a, b) => a.sort_order - b.sort_order),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '정렬순서 변경에 실패했습니다.',
      );
    }
  };

  const handleSaveCompany = async () => {
    if (!company) {
      setFormError('회사 정보 레코드가 없습니다. DB seed를 확인해 주세요.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await updateCompanySettings(company.id, companyForm, userEmail);
      setSuccessMsg('회사 정보가 저장되었습니다.');
      await loadCompany();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateCompanyField = (field: keyof typeof emptyCompanyForm, value: string) => {
    setCompanyForm((prev) => ({ ...prev, [field]: value }));
  };

  const listTabLabel =
    activeTab !== 'company' ? SETTING_TABS[activeTab].label : '';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">설정</h1>
        <div className="page-actions">
          <Link to="/settings/print-templates" className="btn btn-secondary">
            출력 양식 관리
          </Link>
          {activeTab !== 'company' && (
            <button className="btn btn-primary" onClick={openCreate}>
              + {listTabLabel} 추가
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="tabs">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'company' ? '회사정보' : SETTING_TABS[tab].label}
          </button>
        ))}
      </div>

      {activeTab === 'company' ? (
        <div className="card">
          <div className="card-header">회사정보</div>
          <div className="card-body">
            {loading ? (
              <div className="loading-spinner">로딩 중...</div>
            ) : !company ? (
              <EmptyState message="등록된 회사 정보가 없습니다." />
            ) : (
              <>
                {formError && <div className="alert alert-error">{formError}</div>}
                <div className="form-grid cols-2">
                  <div className="form-group">
                    <label>회사명</label>
                    <input
                      value={companyForm.company_name}
                      onChange={(e) =>
                        updateCompanyField('company_name', e.target.value)
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>사업자번호</label>
                    <input
                      value={companyForm.business_no}
                      onChange={(e) =>
                        updateCompanyField('business_no', e.target.value)
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>대표자명</label>
                    <input
                      value={companyForm.ceo_name}
                      onChange={(e) => updateCompanyField('ceo_name', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>전화번호</label>
                    <input
                      value={companyForm.phone}
                      onChange={(e) => updateCompanyField('phone', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>이메일</label>
                    <input
                      type="email"
                      value={companyForm.email}
                      onChange={(e) => updateCompanyField('email', e.target.value)}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>주소</label>
                    <input
                      value={companyForm.address}
                      onChange={(e) => updateCompanyField('address', e.target.value)}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>메모</label>
                    <textarea
                      rows={3}
                      value={companyForm.memo}
                      onChange={(e) => updateCompanyField('memo', e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveCompany}
                    disabled={saving}
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div className="loading-spinner">로딩 중...</div>
            ) : items.length === 0 ? (
              <EmptyState message={`등록된 ${listTabLabel} 항목이 없습니다.`} />
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>명칭</th>
                      <th style={{ width: 120 }}>정렬순서</th>
                      <th style={{ width: 100 }}>사용</th>
                      <th style={{ width: 140 }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className={selectedId === item.id ? 'selected' : ''}
                        onClick={() => setSelectedId(item.id)}
                        style={!item.is_active ? { opacity: 0.55 } : undefined}
                      >
                        <td>{item.name}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <NumericInput
                            style={{ width: 72, height: 32 }}
                            value={Number(item.sort_order)}
                            onChange={(n) => handleInlineSortChange(item, n)}
                          />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={item.is_active}
                            onChange={() => handleToggleActive(item)}
                          />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(item)}
                          >
                            수정
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

      {activeTab !== 'company' && (
        <Modal
          title={editingItem ? `${listTabLabel} 수정` : `${listTabLabel} 추가`}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveItem}
                disabled={saving}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          <div className="form-grid cols-2">
            <div className="form-group">
              <label>
                명칭 <span className="required">*</span>
              </label>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>정렬순서</label>
              <NumericInput
                value={Number(itemSortOrder)}
                onChange={(n) => setItemSortOrder(n)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
