// src/pages/admin/SuperAccountantCustomers.jsx
import { useLang } from '../../context/LangContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  Users, Search, Percent, Lock, Unlock,
  Building2, User as UserIcon, CalendarDays, UserPlus, X, ChevronDown, Download, Upload,
  ArrowUp, ArrowDown, ChevronsUpDown,
  Edit2, MapPin, Star, Plus, Trash2, FileText,
} from 'lucide-react';
import { adminCustomerApi, reportApi } from '../../api/adminApi';
import { formatPrice } from '../../utils/formatPrice';
import useDebounce from '../../utils/useDebounce.js';
import { Badge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import CustomerOrderHistory from '../../components/admin/CustomerOrderHistory';
import {
  PageHeader, LoadingSpinner, EmptyState,
  PrimaryButton, SecondaryButton, DangerButton,
  Field, inputCls, formatNumber,
} from '../../components/ui';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';

function getDebtUrgency(customer) {
  const ms = customer.nearestDeadlineMillis;
  if (!ms) return null;
  const days = Math.ceil((ms - Date.now()) / 86400000);
  if (days < 0 || days <= 3) return 'critical';
  if (days <= 6) return 'warning';
  return null;
}

// ─── Receiver Infos Section (dùng chung cho cả admin và seller) ──────────────
function ReceiverInfosSection({ customerId, apiPrefix = '/api/seller' }) {
  const toast = useToast();
  const [receiverInfos, setReceiverInfos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ receiverName: '', receiverPhone: '', receiverAddress: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await api.get(`${apiPrefix}/customers/${customerId}/receiver-infos`);
      setReceiverInfos(res.data?.data.receiverInfos || []);
    } catch { toast(t('common', 'error_retry'), 'error'); }
    finally { setLoading(false); }
  }, [customerId, apiPrefix]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => setForm({ receiverName: '', receiverPhone: '', receiverAddress: '' });

  const handleAdd = async () => {
    if (!form.receiverAddress.trim()) { toast(t('delivery', 'shipping_address_req'), 'error'); return; }
    setSaving(true);
    try {
      await api.post(`${apiPrefix}/customers/${customerId}/receiver-infos`, form);
      toast(t('common', 'success'), 'success');
      setAdding(false); resetForm(); load();
    } catch (e) { toast(e?.response?.data?.message || t('common', 'error'), 'error'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id) => {
    if (!form.receiverAddress.trim()) { toast(t('delivery', 'shipping_address_req'), 'error'); return; }
    setSaving(true);
    try {
      await api.put(`${apiPrefix}/customers/${customerId}/receiver-infos/${id}`, form);
      toast(t('common', 'success'), 'success');
      setEditingId(null); resetForm(); load();
    } catch (e) { toast(e?.response?.data?.message || t('common', 'error'), 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('misc', 'confirm_delete'))) return;
    try {
      await api.delete(`${apiPrefix}/customers/${customerId}/receiver-infos/${id}`);
      toast(t('common', 'success'), 'success'); load();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi xóa', 'error'); }
  };

  const handleSetDefault = async (id) => {
    try {
      await api.patch(`${apiPrefix}/customers/${customerId}/receiver-infos/${id}/set-default`);
      toast('Đã đặt làm mặc định', 'success'); load();
    } catch (e) { toast(e?.response?.data?.message || t('common', 'error'), 'error'); }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setAdding(false);
    setForm({
      receiverName: r.receiverName || '',
      receiverPhone: r.receiverPhone || '',
      receiverAddress: r.receiverAddress || '',
    });
  };

  const ReceiverForm = ({ onSave, onCancel }) => (
    <div className="space-y-2">
      <input
        value={form.receiverAddress}
        onChange={e => setForm(f => ({ ...f, receiverAddress: e.target.value }))}
        className={inputCls}
        placeholder="Địa chỉ nhận hàng *"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.receiverName}
          onChange={e => setForm(f => ({ ...f, receiverName: e.target.value }))}
          className={inputCls}
          placeholder="Tên người nhận"
        />
        <input
          value={form.receiverPhone}
          onChange={e => setForm(f => ({ ...f, receiverPhone: e.target.value }))}
          className={inputCls}
          placeholder="SĐT người nhận"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg border border-[#E8DDD0] text-xs text-[#8E8878] hover:bg-[#FAF7F2] transition-colors">
          Hủy
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-1.5 rounded-lg bg-[#C9A84C] text-white text-xs font-semibold hover:bg-[#b8973d] disabled:opacity-50 transition-colors">
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[#5C5C5C]">
          Địa chỉ nhận hàng {receiverInfos.length > 0 && `(${receiverInfos.length})`}
        </label>
        {!adding && editingId === null && (
          <button
            onClick={() => { setAdding(true); setEditingId(null); resetForm(); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-semibold hover:bg-[#C9A84C]/20 transition-colors">
            <Plus size={11} /> Thêm địa chỉ
          </button>
        )}
      </div>

      {adding && (
        <div className="border border-[#C9A84C]/30 rounded-xl p-3 bg-[#FDF8ED] space-y-2">
          <p className="text-[11px] font-semibold text-[#C9A84C]">Thêm địa chỉ mới</p>
          <ReceiverForm
            onSave={handleAdd}
            onCancel={() => { setAdding(false); resetForm(); }}
          />
        </div>
      )}

      {loading ? (
        <div className="text-xs text-[#8E8878] text-center py-2">Đang tải...</div>
      ) : receiverInfos.length === 0 && !adding ? (
        <div className="text-xs text-[#C4B9A8] text-center py-2 italic border border-dashed border-[#E8DDD0] rounded-xl">
          Chưa có địa chỉ nhận hàng
        </div>
      ) : (
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {receiverInfos.map(r => (
            <div
              key={r.id}
              className={`rounded-xl border p-2.5 transition-colors
                ${r.isDefault ? 'border-[#C9A84C]/40 bg-[#FDF8ED]' : 'border-[#F0EBE3] bg-white'}`}>

              {editingId === r.id ? (
                <div className="space-y-2">
                  <ReceiverForm
                    onSave={() => handleUpdate(r.id)}
                    onCancel={() => { setEditingId(null); resetForm(); }}
                  />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      {r.isDefault && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#C9A84C]">
                          <Star size={9} fill="currentColor" /> Mặc định
                        </span>
                      )}
                      {r.receiverName && (
                        <span className="text-xs font-semibold text-[#1C1C1E]">{r.receiverName}</span>
                      )}
                      {r.receiverPhone && (
                        <span className="text-[11px] text-[#8E8878]">{r.receiverPhone}</span>
                      )}
                    </div>
                    <p className="text-xs text-[#5C4E3D] flex items-start gap-1">
                      <MapPin size={10} className="mt-0.5 shrink-0 text-[#8E8878]" />
                      <span>{r.receiverAddress}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!r.isDefault && (
                      <button onClick={() => handleSetDefault(r.id)}
                        title="Đặt làm mặc định"
                        className="p-1 rounded text-[#C4B9A8] hover:text-[#C9A84C] transition-colors">
                        <Star size={12} />
                      </button>
                    )}
                    <button onClick={() => startEdit(r)}
                      className="p-1 rounded text-[#8E8878] hover:text-[#C9A84C] transition-colors">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      className="p-1 rounded text-[#8E8878] hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Assign Seller Modal ──────────────────────────────────────────────────────
function AssignSellerModal({ open, customer, onClose, onSaved }) {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 350);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ(''); setSellers([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    adminCustomerApi.searchSellers(dq)
      .then(res => setSellers(res || []))
      .catch(() => setSellers([]))
      .finally(() => setLoading(false));
  }, [dq, open]);

  const assign = async (sellerId) => {
    setSaving(true);
    try { await adminCustomerApi.assignSeller(customer.id, sellerId); onSaved(); }
    catch (e) { alert(e?.response?.data?.message || 'Lỗi khi gán seller'); }
    finally { setSaving(false); }
  };

  const unassign = async () => {
    setSaving(true);
    try { await adminCustomerApi.assignSeller(customer.id, null); onSaved(); }
    catch (e) { alert(e?.response?.data?.message || 'Lỗi khi bỏ gán'); }
    finally { setSaving(false); }
  };

  const displayName = customer
    ? (customer.customerType === 'COMPANY' ? customer.companyName : customer.name) || '—'
    : '—';

  return (
    <Modal open={open} onClose={onClose} title="Gán nhân viên kinh doanh" size="sm">
      <div className="space-y-3">
        <p className="text-sm text-[#5C4E3D]">
          Khách hàng: <span className="font-semibold">{displayName}</span>
        </p>

        {customer?.sellerId && (
          <div className="flex items-center justify-between bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-xl px-3 py-2">
            <div>
              <p className="text-xs text-[#8E8878]">Đang gán</p>
              <p className="text-sm font-semibold text-[#1C1C1E]">{customer.sellerName}</p>
              <p className="text-xs text-[#8E8878]">@{customer.sellerUsername}</p>
            </div>
            <button onClick={unassign} disabled={saving}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Tìm tên nhân viên..."
            className={`${inputCls} pl-8 text-sm`} />
        </div>

        <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
          {loading ? (
            <p className="text-xs text-[#8E8878] text-center py-4">Đang tìm...</p>
          ) : sellers.length === 0 ? (
            <p className="text-xs text-[#8E8878] text-center py-4">Không tìm thấy</p>
          ) : sellers.map(s => (
            <button key={s.id}
              onClick={() => assign(s.id)}
              disabled={saving || s.id === customer?.sellerId}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors
                ${s.id === customer?.sellerId
                  ? 'bg-[#C9A84C]/10 border border-[#C9A84C]/30 cursor-default'
                  : 'hover:bg-[#FAF7F2] border border-transparent'}`}>
              <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center shrink-0">
                <UserIcon size={13} className="text-[#C9A84C]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1C1C1E] truncate">{s.fullName}</p>
                <p className="text-xs text-[#8E8878]">@{s.username} · {s.role === 'SUPER_SELLER' ? 'Trưởng phòng KD' : 'NV Kinh doanh'}</p>
              </div>
              {s.id === customer?.sellerId && (
                <span className="text-[10px] text-[#C9A84C] font-semibold shrink-0">Đang gán</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ── Seller Filter Dropdown ────────────────────────────────────────────────────
function SellerFilterDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [selectedName, setSelectedName] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    adminCustomerApi.searchSellers(dq)
      .then(res => setSellers(res || []))
      .catch(() => setSellers([]))
      .finally(() => setLoading(false));
  }, [dq, open]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (seller) => {
    onChange(String(seller.id)); setSelectedName(seller.fullName); setOpen(false); setQ('');
  };
  const clear = () => { onChange(''); setSelectedName(''); setOpen(false); };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors min-w-[180px]
          ${value && value !== '0' ? 'border-[#C9A84C] bg-[#C9A84C]/5 text-[#C9A84C]' : 'border-[#E8DDD0] text-[#8E8878]'}`}>
        <Search size={13} />
        <span className="flex-1 text-left truncate text-sm">
          {value === '0' ? 'Chưa gán' : (selectedName || 'Lọc theo NV KD...')}
        </span>
        {value ? (
          <button onClick={(e) => { e.stopPropagation(); clear(); }} className="text-[#8E8878] hover:text-red-400 shrink-0">
            <X size={13} />
          </button>
        ) : (
          <ChevronDown size={13} className="shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-80 sm:w-96 bg-white rounded-xl border border-black/10 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#F0EBE3]">
            <input
              autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Tìm nhân viên..."
              className="w-full text-sm px-3 py-1.5 rounded-lg border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              onClick={() => { onChange('0'); setSelectedName('Chưa gán'); setOpen(false); }}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-[#FAF7F2] text-[#5C4E3D]">
              Chưa gán NV
            </button>
            {loading ? (
              <p className="text-xs text-center text-[#8E8878] py-4">Đang tìm...</p>
            ) : sellers.map(s => (
              <button key={s.id} onClick={() => select(s)}
                className={`w-full px-3 py-2.5 text-left hover:bg-[#FAF7F2] transition-colors
                        ${value === String(s.id) ? 'bg-[#C9A84C]/10 text-[#C9A84C]' : 'text-[#1C1C1E]'}`}>
                <p className="text-sm font-medium truncate">{s.fullName}</p>
                <p className="text-xs text-[#8E8878]">@{s.username}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create / Edit Customer Modal ──────────────────────────────────────────────
function CreateEditCustomerModal({ open, customer, onClose, onSaved }) {
  const { t } = useLang();
  const isEdit = !!customer;
  const [form, setForm] = useState({
    name: '', phone: '', email: '', customerType: 'RETAIL',
    pricingType: 'RETAIL_PRICE', discountRate: 0, debtDays: 0,
    companyName: '', taxCode: '', companyPhone: '', companyAddress: '', contactName: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setForm({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        customerType: customer.customerType || 'RETAIL',
        pricingType: customer.pricingType || 'RETAIL_PRICE',
        discountRate: customer.discountRate || 0,
        debtDays: customer.debtDays || 0,
        companyName: customer.companyName || '',
        taxCode: customer.taxCode || '',
        companyPhone: customer.companyPhone || '',
        companyAddress: customer.companyAddress || '',
        contactName: customer.contactName || '',
      });
    } else {
      setForm({
        name: '', phone: '', email: '', customerType: 'RETAIL',
        pricingType: 'RETAIL_PRICE', discountRate: 0, debtDays: 0,
        companyName: '', taxCode: '', companyPhone: '', companyAddress: '', contactName: '',
      });
    }
  }, [open, customer]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isCompany = form.customerType === 'COMPANY';

  const handleSave = async () => {
    if (!form.name.trim() && !form.companyName.trim()) {
      alert('Vui lòng nhập tên khách hàng hoặc tên công ty'); return;
    }
    setSaving(true);
    try {
      const payload = {
        customerType: form.customerType,
        pricingType: form.pricingType,
        discountRate: Number(form.discountRate) || 0,
        debtDays: Number(form.debtDays) || 0,
        // RETAIL
        name: form.name || null,
        phone: form.phone || null,
        email: form.email || null,
        taxCode: isCompany ? (form.taxCode || null) : null,
        // COMPANY — send null when switching to RETAIL to clear
        companyName: isCompany ? (form.companyName || null) : null,
        companyPhone: isCompany ? (form.companyPhone || null) : null,
        companyAddress: isCompany ? (form.companyAddress || null) : null,
        contactName: isCompany ? (form.contactName || null) : null,
      };
      if (isEdit) {
        await adminCustomerApi.update(customer.id, payload);
      } else {
        await adminCustomerApi.create(payload);
      }
      onSaved();
    } catch (e) {
      alert(e?.response?.data?.message || e.message || 'Lỗi lưu khách hàng');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={isEdit ? 'Sửa thông tin khách hàng' : 'Tạo khách hàng mới'}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={saving}>Hủy</SecondaryButton>
          <PrimaryButton onClick={handleSave} loading={saving}>
            {isEdit ? 'Lưu thay đổi' : t('customer', 'create_customer')}
          </PrimaryButton>
        </div>
      }>
      <div className="space-y-4">

        {/* Loại khách */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Loại khách hàng">
            <select value={form.customerType} onChange={e => set('customerType', e.target.value)} className={inputCls}>
              <option value="RETAIL">Cá nhân</option>
              <option value="COMPANY">Công ty</option>
            </select>
          </Field>
          <Field label="Loại giá áp dụng">
            <select value={form.pricingType} onChange={e => set('pricingType', e.target.value)} className={inputCls}>
              <option value="RETAIL_PRICE">Bán lẻ (giá gốc)</option>
              <option value="WHOLESALE_PRICE">Bán sỉ (khung giá)</option>
            </select>
          </Field>
        </div>

        {isCompany ? (
          <>
            <Field label="Tên công ty" required>
              <input value={form.companyName} onChange={e => set('companyName', e.target.value)} className={inputCls} placeholder="Công ty TNHH..." />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mã số thuế (tuỳ chọn)">
                <input value={form.taxCode} onChange={e => set('taxCode', e.target.value)} className={inputCls} placeholder="0123456789" />
              </Field>
              <Field label="Người liên hệ">
                <input value={form.contactName} onChange={e => set('contactName', e.target.value)} className={inputCls} placeholder="Nguyễn Văn A" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="SĐT công ty">
                <input value={form.companyPhone} onChange={e => set('companyPhone', e.target.value)} className={inputCls} placeholder="0901..." />
              </Field>
              <Field label="Email (tuỳ chọn)">
                <input value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="info@..." />
              </Field>
            </div>
            <Field label="Địa chỉ công ty">
              <input value={form.companyAddress} onChange={e => set('companyAddress', e.target.value)} className={inputCls} placeholder="123 đường..." />
            </Field>
          </>
        ) : (
          <>
            <Field label="Họ tên" required>
              <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Nguyễn Văn A" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Số điện thoại">
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="0901..." />
              </Field>
              <Field label="Email (tuỳ chọn)">
                <input value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="email@..." />
              </Field>
            </div>
            <Field label="Mã số thuế (tuỳ chọn)">
              <input value={form.taxCode} onChange={e => set('taxCode', e.target.value)} className={inputCls} placeholder="0123456789" />
            </Field>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Chiết khấu (%)">
            <input type="number" min={0} max={100} value={form.discountRate} onChange={e => set('discountRate', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Công nợ (ngày)">
            <input type="number" min={0} max={365} value={form.debtDays} onChange={e => set('debtDays', e.target.value)} className={inputCls} />
          </Field>
        </div>

        {/* Địa chỉ nhận hàng — chỉ hiện khi edit */}
        {isEdit && customer?.id && (
          <div className="border-t border-[#F0EBE3] pt-4">
            <ReceiverInfosSection customerId={customer.id} apiPrefix="/api/seller" />
          </div>
        )}

        <p className="text-xs text-[#8E8878] bg-[#FDF8ED] rounded-xl px-3 py-2 border border-[#C9A84C]/20">
          💡 Khách do admin/owner tạo: ai cũng có thể tạo đơn, KPI tính chung cho toàn phòng SALE.
        </p>
      </div>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SuperAccountantCustomers() {
  const { t } = useLang();
  const toast = useToast();
  const [filters, setFilters] = useState({ q: '', type: '', isActive: '', sellerId: '' });
  const debouncedQ = useDebounce(filters.q, 600);
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useMinLoading();
  const [exporting, setExporting] = useState(false);
  const [exportingDebt, setExportingDebt] = useState(false);
  // Sort công nợ chưa thanh toán: null → 'desc' (cao→thấp) → 'asc' (thấp→cao)
  const [debtSort, setDebtSort] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [historyCustomerId, setHistoryCustomerId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);


  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountTarget, setDiscountTarget] = useState(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [activeConfirm, setActiveConfirm] = useState(null);

  const [debtDaysOpen, setDebtDaysOpen] = useState(false);
  const [debtDaysTarget, setDebtDaysTarget] = useState(null);
  const [debtDaysValue, setDebtDaysValue] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);

  const handleDelete = async () => {
    if (!deletePassword.trim()) { setDeleteError('Vui lòng nhập mật khẩu'); return; }
    setDeleting(true); setDeleteError('');
    try {
      await adminCustomerApi.softDelete(deleteTarget.id, deletePassword);
      setDeleteTarget(null);
      setDeletePassword('');
      load();
    } catch (e) {
      setDeleteError(e?.response?.data?.message || e?.message || 'Mật khẩu không đúng hoặc có lỗi xảy ra');
    } finally { setDeleting(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: 20, sort: 'id,desc' };
      if (debouncedQ) params.q = debouncedQ;
      if (filters.type) params.type = filters.type;
      if (filters.isActive !== '') params.isActive = filters.isActive;
      if (filters.sellerId !== '') params.sellerId = filters.sellerId;
      if (debtSort) params.debtSort = debtSort;
      const res = await adminCustomerApi.list(params);
      setData(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, debouncedQ, filters.type, filters.isActive, filters.sellerId, debtSort]);

  // Bấm header "Công nợ (chưa TT)": desc → asc → tắt
  const cycleDebtSort = useCallback(() => {
    setPage(0);
    setDebtSort(prev => prev === 'desc' ? 'asc' : prev === 'asc' ? null : 'desc');
  }, []);

  // Export — dùng cùng endpoint với OWNER nên ra file y hệt.
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = {};
      if (debouncedQ) params.q = debouncedQ;
      if (filters.type) params.type = filters.type;
      if (filters.isActive !== '') params.isActive = filters.isActive;
      if (filters.sellerId !== '') params.sellerId = filters.sellerId;
      const res = await adminCustomerApi.exportAll(params);
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers?.['content-disposition'] || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : 'danh-sach-khach-hang.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast(e?.response?.data?.message || 'Lỗi khi export', 'error');
    } finally {
      setExporting(false);
    }
  }, [debouncedQ, filters.type, filters.isActive, filters.sellerId, toast]);

  // Export báo cáo công nợ (Aged Receivables) — PDF, theo đúng bộ lọc đang hiển thị
  const handleExportAgedReceivables = useCallback(async () => {
    setExportingDebt(true);
    try {
      const activeFilters = {
        q: debouncedQ || undefined,
        type: filters.type || undefined,
        isActive: filters.isActive !== '' ? filters.isActive : undefined,
        sellerId: filters.sellerId !== '' ? filters.sellerId : undefined,
      };
      const res = await reportApi.exportAgedReceivables(undefined, activeFilters); // asOf = hôm nay
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers?.['content-disposition'] || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : 'bao-cao-cong-no.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      toast(e?.response?.data?.message || 'Lỗi khi xuất báo cáo công nợ', 'error');
    } finally {
      setExportingDebt(false);
    }
  }, [toast, debouncedQ, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelectedIds(new Set()); }, [page, filters]);

  if (historyCustomerId) {
    return (
      <CustomerOrderHistory
        customerId={historyCustomerId}
        apiPrefix="/api/admin"
        onBack={() => setHistoryCustomerId(null)}
      />
    );
  }

  const allChecked = data.content.length > 0 && data.content.every(c => selectedIds.has(c.id));
  const anyChecked = selectedIds.size > 0;
  const toggleOne = (id) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };
  const toggleAll = () => { allChecked ? setSelectedIds(new Set()) : setSelectedIds(new Set(data.content.map(c => c.id))); };

  const openDiscountSingle = (c) => { setDiscountTarget(c); setDiscountValue(c.discountRate || 0); setDiscountOpen(true); };
  const openDiscountBulk = () => { if (!anyChecked) return; setDiscountTarget(null); setDiscountValue(0); setDiscountOpen(true); };
  const openDebtDays = (c, e) => { e.stopPropagation(); setDebtDaysTarget(c); setDebtDaysValue(c.debtDays || 0); setDebtDaysOpen(true); };
  const openAssign = (c, e) => {
    e.stopPropagation();
    if (c.customerType !== 'COMPANY') return;
    setAssignTarget(c); setAssignOpen(true);
  };

  const saveDiscount = async () => {
    setSaving(true);
    try {
      if (discountTarget) await adminCustomerApi.updateDiscount(discountTarget.id, Number(discountValue));
      else { await adminCustomerApi.bulkDiscount([...selectedIds], Number(discountValue)); setSelectedIds(new Set()); }
      setDiscountOpen(false); load();
    } catch (e) { alert(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const saveDebtDays = async () => {
    const days = Number(debtDaysValue);
    if (isNaN(days) || days < 0 || days > 365) { alert('Số ngày phải từ 0 đến 365'); return; }
    setSaving(true);
    try {
      await adminCustomerApi.updateDebtDays(debtDaysTarget.id, days);
      setDebtDaysOpen(false); load();
    } catch (e) { alert(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const confirmActive = async () => {
    if (!activeConfirm) return;
    setSaving(true);
    try {
      const isActive = !activeConfirm.lock;
      if (activeConfirm.mode === 'single') await adminCustomerApi.setActive(activeConfirm.customer.id, isActive);
      else { await adminCustomerApi.bulkSetActive([...selectedIds], isActive); setSelectedIds(new Set()); }
      setActiveConfirm(null); load();
    } catch (e) { alert(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader icon={Users} title="Khách hàng" subtitle={`Tổng ${formatNumber(data.totalElements)} khách`} />
        <div className="flex items-center gap-2">
          <button onClick={handleExportAgedReceivables} disabled={exportingDebt}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] text-xs text-[#5C5C5C] hover:border-[#C9A84C] transition-all disabled:opacity-60">
            {exportingDebt
              ? <span className="w-3 h-3 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
              : <FileText size={13} />}
            {exportingDebt ? 'Đang xuất...' : 'Báo cáo công nợ'}
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] text-xs text-[#5C5C5C] hover:border-[#C9A84C] cursor-pointer transition-all">
            <Upload size={13} /> Import
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => {
              if (e.target.files[0]) alert('Chức năng Import sẽ được xử lý ở backend');
            }} />
          </label>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] text-xs text-[#5C5C5C] hover:border-[#C9A84C] transition-all disabled:opacity-60">
            {exporting
              ? <span className="w-3 h-3 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
              : <Download size={13} />}
            {exporting ? 'Đang xuất...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-black/5 p-3 sm:p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" size={16} />
            <input type="text" placeholder="Tìm tên, SĐT, email, công ty, mã KH..."
              value={filters.q}
              onChange={e => { setFilters({ ...filters, q: e.target.value }); setPage(0); }}
              className={`${inputCls} pl-9 pr-9`} />
            {filters.q && (
              <button onClick={() => { setFilters({ ...filters, q: '' }); setPage(0); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]">✕</button>
            )}
          </div>
          <select value={filters.type}
            onChange={e => { setFilters({ ...filters, type: e.target.value }); setPage(0); }}
            className={`${inputCls} sm:w-40`}>
            <option value="">Tất cả loại</option>
            <option value="COMPANY">Công ty</option>
            <option value="RETAIL">Cá nhân</option>
          </select>
          <select value={filters.isActive}
            onChange={e => { setFilters({ ...filters, isActive: e.target.value }); setPage(0); }}
            className={`${inputCls} sm:w-40`}>
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã khóa bán</option>
          </select>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-[#8E8878] font-medium shrink-0">Lọc theo NV Kinh Doanh:</span>
          <button
            onClick={() => { setFilters(f => ({ ...f, sellerId: '' })); setPage(0); }}
            className={`px-3 h-[38px] rounded-xl text-xs font-medium transition-colors border
            ${filters.sellerId === ''
                ? 'bg-[#C9A84C] text-white border-[#C9A84C]'
                : 'border-[#E8DDD0] text-[#5C4E3D] hover:bg-[#F0EBE3]'}`}>
            Tất cả
          </button>
          <SellerFilterDropdown
            value={filters.sellerId}
            onChange={(v) => { setFilters(f => ({ ...f, sellerId: v })); setPage(0); }}
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {anyChecked && (
        <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <p className="text-sm text-[#1C1C1E] flex-1">Đã chọn <span className="font-bold text-[#C9A84C]">{selectedIds.size}</span> khách hàng</p>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={openDiscountBulk}><Percent size={14} /> Set chiết khấu</SecondaryButton>
            <SecondaryButton onClick={() => setActiveConfirm({ mode: 'bulk', lock: true })}><Lock size={14} /> Khóa bán</SecondaryButton>
            <SecondaryButton onClick={() => setActiveConfirm({ mode: 'bulk', lock: false })}><Unlock size={14} /> Mở bán</SecondaryButton>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton cols={5} rows={8} />
        ) : data.content.length === 0 ? <EmptyState icon={Users} title="Không có khách hàng" /> : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF7F2] text-[#8E8878]">
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded accent-[#C9A84C]" /></th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Khách hàng</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Loại</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">NV Kinh doanh</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Chiết khấu</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Công nợ</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">
                      <button onClick={cycleDebtSort}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[#C9A84C] transition-colors"
                        title="Sắp xếp theo công nợ chưa thanh toán">
                        Công nợ (chưa TT)
                        {debtSort === 'desc' ? <ArrowDown size={13} className="text-[#C9A84C]" />
                          : debtSort === 'asc' ? <ArrowUp size={13} className="text-[#C9A84C]" />
                            : <ChevronsUpDown size={13} className="opacity-50" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Trạng thái</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.content.map(c => {
                    const urgency = getDebtUrgency(c);
                    const isCompany = c.customerType === 'COMPANY';
                    return (
                      <tr key={c.id}
                        onClick={() => setHistoryCustomerId(c.id)}
                        className={`border-t border-black/5 hover:bg-[#FAF7F2]/50 transition-colors cursor-pointer
                          ${selectedIds.has(c.id) ? 'bg-[#C9A84C]/5' : ''}
                          ${urgency === 'critical' ? 'bg-red-50/30' : urgency === 'warning' ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)} className="rounded accent-[#C9A84C]" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 relative
                              ${isCompany ? 'bg-blue-500' : 'bg-[#C9A84C]'}`}>
                              {isCompany ? <Building2 size={15} /> : <UserIcon size={15} />}
                              {urgency && (
                                <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white
                                  ${urgency === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-[#1C1C1E] truncate">
                                {isCompany ? (c.companyName || c.name) : (c.name || '—')}
                              </p>
                              {c.customerCode && <p className="text-xs text-[#8E8878]">#{c.customerCode}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={isCompany ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}>
                            {isCompany ? 'Công ty' : t('customer', 'individual')}
                          </Badge>
                          {c.pricingType === 'WHOLESALE_PRICE'
                            ? <Badge className="bg-purple-50 text-purple-700 ring-purple-200 mt-0.5">Sỉ</Badge>
                            : <Badge className="bg-green-50 text-green-700 ring-green-200 mt-0.5">Lẻ</Badge>
                          }
                          {c.createdByAdmin && (
                            <Badge className="bg-sky-50 text-sky-700 ring-sky-200 mt-0.5">Admin</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isCompany ? (
                            c.sellerName ? (
                              <div>
                                <p className="text-sm font-medium text-[#1C1C1E]">{c.sellerName}</p>
                                <p className="text-xs text-[#8E8878]">@{c.sellerUsername}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-[#C4B9A8] italic">Chưa có</span>
                            )
                          ) : (
                            <span className="text-xs text-[#E8DDD0]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-[#C9A84C]">{c.discountRate || 0}%</span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => openDebtDays(c, e)}>
                          <span className={`text-xs font-semibold cursor-pointer hover:underline ${c.debtDays > 0 ? 'text-orange-600' : 'text-[#C4B9A8]'}`}>
                            {c.debtDays > 0 ? `${c.debtDays} ngày` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-semibold ${c.unpaidDebt > 0 ? 'text-red-600' : 'text-[#C4B9A8]'}`}>
                            {c.unpaidDebt > 0 ? formatPrice(c.unpaidDebt) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.isActive
                            ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Hoạt động</Badge>
                            : <Badge className="bg-red-50 text-red-700 ring-red-200">Đã khóa</Badge>
                          }
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setActiveConfirm({ mode: 'single', lock: c.isActive, customer: c })}
                              className={`p-2 rounded-lg transition-colors ${c.isActive ? 'text-[#8E8878] hover:bg-red-50 hover:text-red-600' : 'text-[#8E8878] hover:bg-emerald-50 hover:text-emerald-600'}`}>
                              {c.isActive ? <Lock size={15} /> : <Unlock size={15} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-black/5">
              {data.content.map(c => {
                const urgency = getDebtUrgency(c);
                const isCompany = c.customerType === 'COMPANY';
                return (
                  <div key={c.id}
                    onClick={() => setHistoryCustomerId(c.id)}
                    className={`p-4 cursor-pointer transition-colors
                      ${selectedIds.has(c.id) ? 'bg-[#C9A84C]/5' : ''}
                      ${urgency === 'critical' ? 'border-l-4 border-red-400' : urgency === 'warning' ? 'border-l-4 border-amber-400' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)}
                        onClick={e => e.stopPropagation()} className="mt-1 rounded accent-[#C9A84C]" />
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 ${isCompany ? 'bg-blue-500' : 'bg-[#C9A84C]'}`}>
                        {isCompany ? <Building2 size={15} /> : <UserIcon size={15} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#1C1C1E] truncate">
                          {isCompany ? (c.companyName || c.name) : (c.name || '—')}
                        </p>
                        <p className="text-xs text-[#8E8878]">{c.phone} · CK {c.discountRate || 0}%</p>
                        {c.debtDays > 0 && <p className="text-[10px] text-orange-500">📋 Công nợ {c.debtDays} ngày</p>}
                        {c.unpaidDebt > 0 && <p className="text-[10px] font-semibold text-red-600">💰 Chưa TT: {formatPrice(c.unpaidDebt)}</p>}
                        {isCompany && (
                          c.sellerName
                            ? <p className="text-[10px] text-sky-600 mt-0.5">👤 {c.sellerName}</p>
                            : <p className="text-[10px] text-[#C4B9A8] italic mt-0.5">Chưa có NV</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                      {isCompany && (
                        <button onClick={e => openAssign(c, e)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-sky-50 text-sky-600">Gán NV</button>
                      )}
                      <button onClick={e => { e.stopPropagation(); setEditCustomer(c); setCreateOpen(true); }}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#FDF8ED] text-[#C9A84C]">Sửa</button>
                      <button onClick={() => openDiscountSingle(c)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#FAF7F2] text-[#1C1C1E]">CK</button>
                      <button onClick={e => openDebtDays(c, e)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-orange-50 text-orange-600">CN</button>
                      <button onClick={() => setActiveConfirm({ mode: 'single', lock: c.isActive, customer: c })}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${c.isActive ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {c.isActive ? 'Khóa' : 'Mở'}
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setDeleteTarget(c);
                          setDeletePassword('');
                          setDeleteError('');
                        }}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-red-50 text-red-600">
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {!loading && data.content.length > 0 && <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />}
      </div>

      {/* Modals */}
      <AssignSellerModal
        open={assignOpen}
        customer={assignTarget}
        onClose={() => setAssignOpen(false)}
        onSaved={() => { setAssignOpen(false); load(); }} />

      <Modal open={discountOpen} onClose={() => !saving && setDiscountOpen(false)}
        title={discountTarget ? 'Đặt chiết khấu' : 'Đặt chiết khấu hàng loạt'} size="sm"
        footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={() => setDiscountOpen(false)} disabled={saving}>Hủy</SecondaryButton><PrimaryButton onClick={saveDiscount} loading={saving}>Áp dụng</PrimaryButton></div>}>
        {discountTarget
          ? <p className="text-sm text-[#1C1C1E] mb-3">Khách: <span className="font-semibold">{discountTarget.customerType === 'COMPANY' ? discountTarget.companyName : discountTarget.name}</span></p>
          : <p className="text-sm text-[#1C1C1E] mb-3">Áp dụng cho <span className="font-bold text-[#C9A84C]">{selectedIds.size}</span> khách hàng đã chọn</p>
        }
        <Field label="Tỷ lệ chiết khấu (%)" required>
          <input type="number" min={0} max={100} value={discountValue} onChange={e => setDiscountValue(e.target.value)} className={inputCls} />
        </Field>
      </Modal>

      <Modal open={debtDaysOpen} onClose={() => !saving && setDebtDaysOpen(false)}
        title="Số ngày công nợ" size="sm"
        footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={() => setDebtDaysOpen(false)} disabled={saving}>Hủy</SecondaryButton><PrimaryButton onClick={saveDebtDays} loading={saving}>Áp dụng</PrimaryButton></div>}>
        {debtDaysTarget && <p className="text-sm text-[#1C1C1E] mb-3">Khách: <span className="font-semibold">{debtDaysTarget.customerType === 'COMPANY' ? debtDaysTarget.companyName : debtDaysTarget.name}</span></p>}
        <Field label="Số ngày được phép công nợ" required>
          <input type="number" min={0} max={365} value={debtDaysValue} onChange={e => setDebtDaysValue(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
        <p className="text-xs text-[#8E8878] mt-1.5">Từ 1–365 ngày. Đặt 0 để tắt công nợ.</p>
      </Modal>

      <Modal open={!!activeConfirm} onClose={() => !saving && setActiveConfirm(null)}
        title={activeConfirm?.lock ? 'Khóa bán khách hàng' : 'Mở bán khách hàng'} size="sm"
        footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={() => setActiveConfirm(null)} disabled={saving}>Hủy</SecondaryButton>{activeConfirm?.lock ? <DangerButton onClick={confirmActive} loading={saving}>Xác nhận khóa</DangerButton> : <PrimaryButton onClick={confirmActive} loading={saving}>Xác nhận mở</PrimaryButton>}</div>}>
        <p className="text-sm text-[#1C1C1E]">
          {activeConfirm?.mode === 'bulk'
            ? <>Bạn có chắc muốn {activeConfirm.lock ? 'khóa bán' : 'mở bán'} cho <span className="font-bold text-[#C9A84C]">{selectedIds.size}</span> khách hàng?</>
            : <>Bạn có chắc muốn {activeConfirm?.lock ? 'khóa bán' : 'mở bán'} khách <span className="font-semibold">{activeConfirm?.customer?.customerType === 'COMPANY' ? activeConfirm?.customer?.companyName : activeConfirm?.customer?.name}</span>?</>
          }
        </p>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => { if (!deleting) { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); } }}
        title="Xóa khách hàng"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton
              onClick={() => { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); }}
              disabled={deleting}>
              Hủy
            </SecondaryButton>
            <DangerButton onClick={handleDelete} loading={deleting}>
              Xác nhận xóa
            </DangerButton>
          </div>
        }>
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-xs text-red-400 font-medium mb-0.5">Sẽ xóa khách hàng</p>
            <p className="text-sm font-semibold text-red-700">
              {deleteTarget?.customerType === 'COMPANY'
                ? deleteTarget?.companyName
                : deleteTarget?.name}
              {deleteTarget?.customerCode && (
                <span className="font-normal text-red-400 ml-1.5">
                  #{deleteTarget.customerCode}
                </span>
              )}
            </p>
          </div>

          <p className="text-sm text-[#5C4E3D]">
            Khách hàng sẽ <span className="font-semibold">không hiển thị</span> trên
            hệ thống sau khi xóa. Hành động này <span className="font-semibold text-red-600">không thể hoàn tác</span>.
          </p>

          <Field label="Nhập mật khẩu đăng nhập của bạn để xác nhận" required>
            <input
              type="password"
              value={deletePassword}
              onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
              onKeyDown={e => e.key === 'Enter' && !deleting && handleDelete()}
              className={`${inputCls} ${deleteError ? 'border-red-400' : ''}`}
              placeholder="••••••••"
              autoFocus
            />
            {deleteError && (
              <p className="text-xs text-red-500 mt-1">{deleteError}</p>
            )}
          </Field>
        </div>
      </Modal>

      <CreateEditCustomerModal
        open={createOpen}
        customer={editCustomer}
        onClose={() => { setCreateOpen(false); setEditCustomer(null); }}
        onSaved={() => { setCreateOpen(false); setEditCustomer(null); load(); }}
      />
    </div>
  );
}