// src/pages/accountant/SupplierManagementPage.jsx
// Quản lý nhà cung cấp + danh mục khoản chi — ACCOUNTANT / SUPER_ACCOUNTANT
// Dùng CÙNG bảng MaterialVendor với OWNER (qua /api/factory/material-vendors)
// để kế toán nhìn thấy đúng 116 NCC mà owner đã tạo.
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  Plus, Search, Edit2, Trash2, Building2, Phone, MapPin, User,
  Tag, ChevronLeft, Check, X, ReceiptText, Hash,
} from 'lucide-react';
import api from '../../api/axios';
import { expenseApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import Modal from '../../components/ui/Modal';
import { VENDOR_TYPE_LABELS } from './ExpenseCreateModal';

// ── Tab: Nhà cung cấp (MaterialVendor — cùng bảng với Owner) ───────────────
function SuppliersTab() {
  const { t } = useLang();
  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', vendorType: 'OTHER', contactPerson: '', contactPhone: '', address: '', taxCode: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/factory/material-vendors', { params: { q } });
      setVendors(res.data?.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const filtered = vendors;

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', vendorType: 'OTHER', contactPerson: '', contactPhone: '', address: '', taxCode: '' });
    setModalOpen(true);
  };
  const openEdit = (v) => {
    setEditItem(v);
    setForm({
      name: v.name || '', vendorType: v.vendorType || 'OTHER',
      contactPerson: v.contactPerson || '', contactPhone: v.contactPhone || '',
      address: v.address || '', taxCode: v.taxCode || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Tên nhà cung cấp là bắt buộc', 'error'); return; }
    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/api/factory/material-vendors/${editItem.id}`, form);
      } else {
        await api.post('/api/factory/material-vendors', form);
      }
      toast('Thành công', 'success');
      setModalOpen(false);
      load();
    } catch (e) {
      toast(e?.response?.data?.message || 'Có lỗi xảy ra', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Ẩn nhà cung cấp này? Phiếu chi cũ sẽ không bị ảnh hưởng.')) return;
    try {
      await api.delete(`/api/factory/material-vendors/${id}`);
      toast('Đã ẩn nhà cung cấp', 'success');
      load();
    } catch { toast('Có lỗi xảy ra', 'error'); }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">{filtered.length} nhà cung cấp</p>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-gold text-white rounded-xl font-semibold text-sm hover:bg-gold-strong transition">
          <Plus size={15} /> Thêm mới
        </button>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Tìm nhà cung cấp..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
      </div>

      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p>Chưa có dữ liệu</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-canvas border-b border-hairline">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-ink">Tên</th>
                <th className="text-left px-4 py-3 font-semibold text-ink hidden md:table-cell">Loại</th>
                <th className="text-left px-4 py-3 font-semibold text-ink hidden md:table-cell">Liên hệ</th>
                <th className="text-left px-4 py-3 font-semibold text-ink hidden lg:table-cell">Địa chỉ</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-canvas/50 transition">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{v.name}</p>
                    {v.contactPerson && <p className="text-xs text-muted">{v.contactPerson}</p>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-ink-2">
                    {VENDOR_TYPE_LABELS[v.vendorType] || v.vendorType || '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-2">
                    {v.contactPhone && <div className="flex items-center gap-1 text-xs"><Phone size={11} /> {v.contactPhone}</div>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-ink-2 text-xs">{v.address}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:bg-blue-500/10 text-blue-500 transition">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:bg-red-500/10 text-red-500 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editItem ? 'Chỉnh sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}>
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-1">Tên nhà cung cấp *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="VD: Công ty TNHH ABC"
              className="w-full px-3 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-1">Loại</label>
            <select value={form.vendorType} onChange={e => setForm(p => ({ ...p, vendorType: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none bg-surface">
              {Object.entries(VENDOR_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {[
            { key: 'contactPerson', label: 'Người liên hệ', icon: User, placeholder: 'Tên người liên hệ' },
            { key: 'contactPhone', label: 'Số điện thoại', icon: Phone, placeholder: '0xxx xxx xxx' },
            { key: 'address', label: 'Địa chỉ', icon: MapPin, placeholder: 'Địa chỉ nhà cung cấp' },
            { key: 'taxCode', label: 'Mã số thuế', icon: Hash, placeholder: 'Mã số thuế' },
          ].map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-ink mb-1">{label}</label>
              <div className="relative">
                <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setModalOpen(false)}
            className="flex-1 py-2.5 rounded-xl border border-hairline-2 text-ink-2 hover:bg-canvas font-medium transition">Huỷ</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gold text-white font-semibold hover:bg-gold-strong transition disabled:opacity-50">
            {saving ? 'Đang lưu...' : (editItem ? 'Cập nhật' : 'Tạo mới')}
          </button>
        </div>
      </Modal>
    </>
  );
}

// ── Tab: Danh mục khoản chi ─────────────────────────────────────────────────
function CategoriesTab() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expenseApi.expenseCategories();
      setCategories(res.data?.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { toast('Tên danh mục là bắt buộc', 'error'); return; }
    setCreating(true);
    try {
      await expenseApi.createExpenseCategory(name);
      toast('Đã tạo danh mục', 'success');
      setNewName('');
      load();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi tạo danh mục', 'error'); }
    finally { setCreating(false); }
  };

  const startEdit = (cat) => { setEditingId(cat.id); setEditName(cat.name); };
  const cancelEdit = () => { setEditingId(null); setEditName(''); };

  const handleUpdate = async () => {
    const name = editName.trim();
    if (!name) { toast('Tên không được để trống', 'error'); return; }
    setSavingEdit(true);
    try {
      await expenseApi.updateExpenseCategory(editingId, name);
      toast('Đã cập nhật', 'success');
      setEditingId(null);
      load();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi cập nhật', 'error'); }
    finally { setSavingEdit(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Ẩn danh mục này? Phiếu chi cũ sẽ không bị ảnh hưởng.')) return;
    try {
      await expenseApi.deleteExpenseCategory(id);
      toast('Đã ẩn danh mục', 'success');
      load();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi xoá', 'error'); }
  };

  return (
    <>
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl px-4 py-3 mb-4 text-xs text-amber-800 dark:text-amber-300">
        Khi cập nhật tên danh mục, các phiếu chi đã tạo sẽ <b>không bị ảnh hưởng</b> vì thông tin đã được lưu cố định trên phiếu.
      </div>
      <div className="flex gap-2 mb-5">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="Nhập tên danh mục mới..." onKeyDown={e => e.key === 'Enter' && handleCreate()}
          className="flex-1 px-4 py-2.5 rounded-xl border border-hairline-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
        <button onClick={handleCreate} disabled={creating || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gold text-white rounded-xl text-sm font-semibold hover:bg-gold-strong transition disabled:opacity-50">
          <Plus size={15} /> {creating ? 'Đang tạo...' : 'Tạo mới'}
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 text-muted"><Tag size={40} className="mx-auto mb-3 opacity-30" /><p>Chưa có danh mục khoản chi nào</p></div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="bg-surface rounded-xl border border-hairline px-4 py-3 flex items-center gap-3 hover:border-gold/30 transition">
              <Tag size={14} className="text-gold flex-shrink-0" />
              {editingId === cat.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') cancelEdit(); }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gold text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
                  <button onClick={handleUpdate} disabled={savingEdit} className="p-1.5 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-300 hover:bg-green-100 transition disabled:opacity-50"><Check size={14} /></button>
                  <button onClick={cancelEdit} className="p-1.5 rounded-lg hover:bg-canvas text-muted transition"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-ink">{cat.name}</span>
                  <button onClick={() => startEdit(cat)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:bg-blue-500/10 text-blue-500 transition"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:bg-red-500/10 text-red-500 transition"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function SupplierManagementPage() {
  const { t } = useLang();
  const [tab, setTab] = useState('suppliers');

  let backTo = null;
  try { const loc = window.history.state?.usr?.from; if (loc) backTo = loc; } catch { /* ignore */ }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {backTo && (
        <button onClick={() => window.history.back()} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink font-medium">
          <ChevronLeft size={16} /> Quay lại phiếu chi
        </button>
      )}
      <div className="flex items-center gap-3">
        <Building2 size={24} className="text-gold" />
        <div>
          <h1 className="text-2xl font-bold text-ink">{t('supplier','management_title')}</h1>
          <p className="text-sm text-muted">{t('supplier','management_subtitle')}</p>
        </div>
      </div>
      <div className="flex gap-2 border-b border-hairline pb-0">
        <button onClick={() => setTab('suppliers')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px ${tab === 'suppliers' ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-ink'}`}>
          <Building2 size={15} /> Nhà cung cấp
        </button>
        <button onClick={() => setTab('categories')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px ${tab === 'categories' ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-ink'}`}>
          <ReceiptText size={15} /> Danh mục khoản chi
        </button>
      </div>
      {tab === 'suppliers' ? <SuppliersTab /> : <CategoriesTab />}
    </div>
  );
}
