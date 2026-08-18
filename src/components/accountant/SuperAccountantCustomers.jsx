// src/pages/admin/SuperAccountantCustomers.jsx
import { useLang } from '../../context/LangContext';
import { useContractModals } from '../../components/customer/CustomerContract';
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
import DebtReportCustomerModal from '../../components/accountant/DebtReportCustomerModal';
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
          className="flex-1 py-1.5 rounded-lg border border-line text-xs text-muted hover:bg-canvas transition-colors">
          Hủy
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-1.5 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-[var(--c-gold-strong)] disabled:opacity-50 transition-colors">
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-ink-2">
          Địa chỉ nhận hàng {receiverInfos.length > 0 && `(${receiverInfos.length})`}
        </label>
        {!adding && editingId === null && (
          <button
            onClick={() => { setAdding(true); setEditingId(null); resetForm(); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gold/10 text-gold text-[10px] font-semibold hover:bg-gold/20 transition-colors">
            <Plus size={11} /> Thêm địa chỉ
          </button>
        )}
      </div>

      {adding && (
        <div className="border border-gold/30 rounded-xl p-3 bg-gold-tint space-y-2">
          <p className="text-[11px] font-semibold text-gold">Thêm địa chỉ mới</p>
          <ReceiverForm
            onSave={handleAdd}
            onCancel={() => { setAdding(false); resetForm(); }}
          />
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted text-center py-2">Đang tải...</div>
      ) : receiverInfos.length === 0 && !adding ? (
        <div className="text-xs text-faint text-center py-2 italic border border-dashed border-line rounded-xl">
          Chưa có địa chỉ nhận hàng
        </div>
      ) : (
        <div className="space-y-2">
          {receiverInfos.map(r => (
            <div
              key={r.id}
              className={`rounded-xl border p-2.5 transition-colors
                ${r.isDefault ? 'border-gold/40 bg-gold-tint' : 'border-line-soft bg-surface'}`}>

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
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-gold">
                          <Star size={9} fill="currentColor" /> Mặc định
                        </span>
                      )}
                      {r.receiverName && (
                        <span className="text-xs font-semibold text-ink">{r.receiverName}</span>
                      )}
                      {r.receiverPhone && (
                        <span className="text-[11px] text-muted">{r.receiverPhone}</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-2 flex items-start gap-1">
                      <MapPin size={10} className="mt-0.5 shrink-0 text-muted" />
                      <span>{r.receiverAddress}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!r.isDefault && (
                      <button onClick={() => handleSetDefault(r.id)}
                        title="Đặt làm mặc định"
                        className="p-1 rounded text-faint hover:text-gold transition-colors">
                        <Star size={12} />
                      </button>
                    )}
                    <button onClick={() => startEdit(r)}
                      className="p-1 rounded text-muted hover:text-gold transition-colors">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      className="p-1 rounded text-muted hover:text-red-400 transition-colors">
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
        <p className="text-sm text-ink-2">
          Khách hàng: <span className="font-semibold">{displayName}</span>
        </p>

        {customer?.sellerId && (
          <div className="flex items-center justify-between bg-gold/10 border border-gold/30 rounded-xl px-3 py-2">
            <div>
              <p className="text-xs text-muted">Đang gán</p>
              <p className="text-sm font-semibold text-ink">{customer.sellerName}</p>
              <p className="text-xs text-muted">@{customer.sellerUsername}</p>
            </div>
            <button onClick={unassign} disabled={saving}
              className="p-1.5 text-red-400 hover:text-red-600 dark:text-red-300 hover:bg-red-50 dark:bg-red-500/10 rounded-lg transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Tìm tên nhân viên..."
            className={`${inputCls} pl-8 text-sm`} />
        </div>

        <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
          {loading ? (
            <p className="text-xs text-muted text-center py-4">Đang tìm...</p>
          ) : sellers.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">Không tìm thấy</p>
          ) : sellers.map(s => (
            <button key={s.id}
              onClick={() => assign(s.id)}
              disabled={saving || s.id === customer?.sellerId}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors
                ${s.id === customer?.sellerId
                  ? 'bg-gold/10 border border-gold/30 cursor-default'
                  : 'hover:bg-canvas border border-transparent'}`}>
              <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                <UserIcon size={13} className="text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{s.fullName}</p>
                <p className="text-xs text-muted">@{s.username} · {s.role === 'SUPER_SELLER' ? 'Trưởng phòng KD' : 'NV Kinh doanh'}</p>
              </div>
              {s.id === customer?.sellerId && (
                <span className="text-[10px] text-gold font-semibold shrink-0">Đang gán</span>
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
          ${value && value !== '0' ? 'border-gold bg-gold/5 text-gold' : 'border-line text-muted'}`}>
        <Search size={13} />
        <span className="flex-1 text-left truncate text-sm">
          {value === '0' ? 'Chưa gán' : (selectedName || 'Lọc theo NV KD...')}
        </span>
        {value ? (
          <button onClick={(e) => { e.stopPropagation(); clear(); }} className="text-muted hover:text-red-400 shrink-0">
            <X size={13} />
          </button>
        ) : (
          <ChevronDown size={13} className="shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-80 sm:w-96 bg-surface rounded-xl border border-hairline-2 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-line-soft">
            <input
              autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Tìm nhân viên..."
              className="w-full text-sm px-3 py-1.5 rounded-lg border border-line focus:outline-none focus:border-gold"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              onClick={() => { onChange('0'); setSelectedName('Chưa gán'); setOpen(false); }}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-canvas text-ink-2">
              Chưa gán NV
            </button>
            {loading ? (
              <p className="text-xs text-center text-muted py-4">Đang tìm...</p>
            ) : sellers.map(s => (
              <button key={s.id} onClick={() => select(s)}
                className={`w-full px-3 py-2.5 text-left hover:bg-canvas transition-colors
                        ${value === String(s.id) ? 'bg-gold/10 text-gold' : 'text-ink'}`}>
                <p className="text-sm font-medium truncate">{s.fullName}</p>
                <p className="text-xs text-muted">@{s.username}</p>
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
          <div className="border-t border-line-soft pt-4">
            <ReceiverInfosSection customerId={customer.id} apiPrefix="/api/seller" />
          </div>
        )}

        <p className="text-xs text-muted bg-gold-tint rounded-xl px-3 py-2 border border-gold/20">
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
  // isActive: '' = tất cả, 'true' = đang hoạt động, 'false' = đang khóa.
  // Mặc định '' để thấy CẢ khách đã khóa (kế toán cần tra cứu & thu hồi công nợ);
  // người dùng có thể lọc lại bằng dropdown trạng thái.
  const [filters, setFilters] = useState({ q: '', type: '', isActive: '', sellerId: '' });
  const debouncedQ = useDebounce(filters.q, 600);
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useMinLoading();
  const [exporting, setExporting] = useState(false);
  const [exportingDebt, setExportingDebt] = useState(false);
  const [debtModalOpen, setDebtModalOpen] = useState(false);
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
      // Lọc theo trạng thái khóa bán/hoạt động (dropdown). '' = tất cả.
      if (filters.isActive === 'true') params.isActive = true;
      else if (filters.isActive === 'false') params.isActive = false;
      if (filters.sellerId !== '') params.sellerId = filters.sellerId;
      if (debtSort) params.debtSort = debtSort;
      const res = await adminCustomerApi.list(params);
      setData(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, debouncedQ, filters.type, filters.isActive, filters.sellerId, debtSort]);

  // Xem / tải hợp đồng — tải lại danh sách sau khi thay để cờ hasContract mới.
  const contract = useContractModals(() => load());

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
      // Export khớp đúng bảng đang hiển thị → gửi cùng bộ lọc trạng thái.
      if (filters.isActive === 'true') params.isActive = true;
      else if (filters.isActive === 'false') params.isActive = false;
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

  // Nguồn dữ liệu cho modal chọn khách hàng (search + phân trang)
  const fetchCustomersForReport = useCallback(async ({ q, page: p = 0, size = 20 }) => {
    const res = await adminCustomerApi.list({
      q: q || undefined, page: p, size, sort: 'id,desc',
      // KHÔNG lọc isActive ở đây.
      //
      // Khách bị khoá vẫn có thể đang nợ tiền — thậm chí đó thường là lý do họ
      // bị khoá. Lọc bỏ khách khoá khiến chính những khoản nợ cần đòi nhất lại
      // không tìm thấy trong modal chọn khách của báo cáo công nợ.
    });
    const content = res?.content || [];
    const totalElements = res?.totalElements ?? res?.totalItems ?? content.length;
    const totalPages = res?.totalPages ?? Math.ceil(totalElements / size);
    return { content, totalPages, totalElements };
  }, []);

  // Export báo cáo công nợ (Aged Receivables) — PDF, theo đúng bộ lọc đang hiển thị
  const handleExportAgedReceivables = useCallback(async (customerIds = null) => {
    setExportingDebt(true);
    try {
      const activeFilters = (customerIds && customerIds.length)
        ? { customerIds }                       // chọn tay ở modal → chỉ xuất đúng các KH này
        : {
          // "Xuất tất cả" đi theo đúng bộ lọc đang hiển thị trên trang. Không ép
          // isActive: true — cùng lý do với modal chọn khách ở trên; nếu người
          // dùng muốn giới hạn thì đã có sẵn bộ lọc Trạng thái.
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
      setDebtModalOpen(false);
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
          <button onClick={() => setDebtModalOpen(true)} disabled={exportingDebt}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-all disabled:opacity-60">
            {exportingDebt
              ? <span className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              : <FileText size={13} />}
            {exportingDebt ? 'Đang xuất...' : 'Báo cáo công nợ'}
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold cursor-pointer transition-all">
            <Upload size={13} /> Import
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => {
              if (e.target.files[0]) alert('Chức năng Import sẽ được xử lý ở backend');
            }} />
          </label>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-all disabled:opacity-60">
            {exporting
              ? <span className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              : <Download size={13} />}
            {exporting ? 'Đang xuất...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface rounded-2xl border border-hairline p-3 sm:p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input type="text" placeholder="Tìm tên, SĐT, email, công ty, mã KH..."
              value={filters.q}
              onChange={e => { setFilters({ ...filters, q: e.target.value }); setPage(0); }}
              className={`${inputCls} pl-9 pr-9`} />
            {filters.q && (
              <button onClick={() => { setFilters({ ...filters, q: '' }); setPage(0); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">✕</button>
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
            className={`${inputCls} sm:w-44`}>
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đang khóa</option>
          </select>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted font-medium shrink-0">Lọc theo NV Kinh Doanh:</span>
          <button
            onClick={() => { setFilters(f => ({ ...f, sellerId: '' })); setPage(0); }}
            className={`px-3 h-[38px] rounded-xl text-xs font-medium transition-colors border
            ${filters.sellerId === ''
                ? 'bg-gold text-white border-gold'
                : 'border-line text-ink-2 hover:bg-surface-2'}`}>
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
        <div className="bg-gold/10 border border-gold/30 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <p className="text-sm text-ink flex-1">Đã chọn <span className="font-bold text-gold">{selectedIds.size}</span> khách hàng</p>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={openDiscountBulk}><Percent size={14} /> Set chiết khấu</SecondaryButton>
            <SecondaryButton onClick={() => setActiveConfirm({ mode: 'bulk', lock: true })}><Lock size={14} /> Khóa bán</SecondaryButton>
            <SecondaryButton onClick={() => setActiveConfirm({ mode: 'bulk', lock: false })}><Unlock size={14} /> Mở bán</SecondaryButton>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton cols={5} rows={8} />
        ) : data.content.length === 0 ? <EmptyState icon={Users} title="Không có khách hàng" /> : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-canvas text-muted">
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded accent-gold" /></th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Khách hàng</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">NV Kinh doanh</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">% Chiết khấu</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Số ngày Công nợ</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">
                      <button onClick={cycleDebtSort}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gold transition-colors"
                        title="Sắp xếp theo công nợ chưa thanh toán">
                        Công nợ (chưa TT)
                        {debtSort === 'desc' ? <ArrowDown size={13} className="text-gold" />
                          : debtSort === 'asc' ? <ArrowUp size={13} className="text-gold" />
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
                        className={`border-t border-hairline hover:bg-canvas/50 transition-colors cursor-pointer
                          ${selectedIds.has(c.id) ? 'bg-gold/5' : ''}
                          ${urgency === 'critical' ? 'bg-red-50/30 dark:bg-red-500/4' : urgency === 'warning' ? 'bg-amber-50/30 dark:bg-amber-500/4' : ''}`}>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)} className="rounded accent-gold" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 relative
                              ${isCompany ? 'bg-blue-500' : 'bg-gold'}`}>
                              {isCompany ? <Building2 size={15} /> : <UserIcon size={15} />}
                              {urgency && (
                                <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white
                                  ${urgency === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-ink truncate">
                                {isCompany ? (c.companyName || c.name) : (c.name || '—')}
                              </p>
                              {c.customerCode && <p className="text-xs text-muted">#{c.customerCode}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isCompany ? (
                            c.sellerName ? (
                              <div>
                                <p className="text-sm font-medium text-ink">{c.sellerName}</p>
                                <p className="text-xs text-muted">@{c.sellerUsername}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-faint italic">Chưa có</span>
                            )
                          ) : (
                            <span className="text-xs text-line">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-gold">{c.discountRate || 0}%</span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => openDebtDays(c, e)}>
                          <span className={`text-xs font-semibold cursor-pointer hover:underline ${c.debtDays > 0 ? 'text-orange-600 dark:text-orange-300' : 'text-faint'}`}>
                            {c.debtDays > 0 ? `${c.debtDays} ngày` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-semibold ${c.unpaidDebt > 0 ? 'text-red-600 dark:text-red-300' : 'text-faint'}`}>
                            {c.unpaidDebt > 0 ? formatPrice(c.unpaidDebt) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.isActive
                            ? <Badge className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/28">Hoạt động</Badge>
                            : <Badge className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/28">Đã khóa</Badge>
                          }
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {/* Hợp đồng — điều kiện để khách được mua công nợ. */}
                            <button onClick={() => c.hasContract ? contract.view(c) : contract.upload(c)}
                              className={`p-2 rounded-lg transition-colors ${c.hasContract
                                ? 'text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                                : 'text-muted hover:bg-canvas hover:text-ink'}`}
                              title={c.hasContract ? 'Xem hợp đồng' : 'Tải hợp đồng lên'}>
                              <FileText size={15} />
                            </button>
                            <button onClick={() => setActiveConfirm({ mode: 'single', lock: c.isActive, customer: c })}
                              className={`p-2 rounded-lg transition-colors ${c.isActive ? 'text-muted hover:bg-red-50 dark:bg-red-500/10 hover:text-red-600 dark:text-red-300' : 'text-muted hover:bg-emerald-50 dark:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-300'}`}>
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
            <div className="lg:hidden divide-y divide-hairline">
              {data.content.map(c => {
                const urgency = getDebtUrgency(c);
                const isCompany = c.customerType === 'COMPANY';
                return (
                  <div key={c.id}
                    onClick={() => setHistoryCustomerId(c.id)}
                    className={`p-4 cursor-pointer transition-colors
                      ${selectedIds.has(c.id) ? 'bg-gold/5' : ''}
                      ${urgency === 'critical' ? 'border-l-4 border-red-400' : urgency === 'warning' ? 'border-l-4 border-amber-400' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleOne(c.id)}
                        onClick={e => e.stopPropagation()} className="mt-1 rounded accent-gold" />
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 ${isCompany ? 'bg-blue-500' : 'bg-gold'}`}>
                        {isCompany ? <Building2 size={15} /> : <UserIcon size={15} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink truncate">
                          {isCompany ? (c.companyName || c.name) : (c.name || '—')}
                        </p>
                        <p className="text-xs text-muted">{c.phone} · CK {c.discountRate || 0}%</p>
                        {c.debtDays > 0 && <p className="text-[10px] text-orange-500">📋 Công nợ {c.debtDays} ngày</p>}
                        {c.unpaidDebt > 0 && <p className="text-[10px] font-semibold text-red-600 dark:text-red-300">💰 Chưa TT: {formatPrice(c.unpaidDebt)}</p>}
                        {isCompany && (
                          c.sellerName
                            ? <p className="text-[10px] text-sky-600 dark:text-sky-300 mt-0.5">👤 {c.sellerName}</p>
                            : <p className="text-[10px] text-faint italic mt-0.5">Chưa có NV</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                      {isCompany && (
                        <button onClick={e => openAssign(c, e)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300">Gán NV</button>
                      )}
                      <button onClick={e => { e.stopPropagation(); setEditCustomer(c); setCreateOpen(true); }}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-gold-tint text-gold">Sửa</button>
                      <button onClick={() => openDiscountSingle(c)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-canvas text-ink">CK</button>
                      <button onClick={e => openDebtDays(c, e)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300">CN</button>
                      <button onClick={() => setActiveConfirm({ mode: 'single', lock: c.isActive, customer: c })}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${c.isActive ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'}`}>
                        {c.isActive ? 'Khóa' : 'Mở'}
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setDeleteTarget(c);
                          setDeletePassword('');
                          setDeleteError('');
                        }}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300">
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
          ? <p className="text-sm text-ink mb-3">Khách: <span className="font-semibold">{discountTarget.customerType === 'COMPANY' ? discountTarget.companyName : discountTarget.name}</span></p>
          : <p className="text-sm text-ink mb-3">Áp dụng cho <span className="font-bold text-gold">{selectedIds.size}</span> khách hàng đã chọn</p>
        }
        <Field label="Tỷ lệ chiết khấu (%)" required>
          <input type="number" min={0} max={100} value={discountValue} onChange={e => setDiscountValue(e.target.value)} className={inputCls} />
        </Field>
      </Modal>

      <Modal open={debtDaysOpen} onClose={() => !saving && setDebtDaysOpen(false)}
        title="Số ngày công nợ" size="sm"
        footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={() => setDebtDaysOpen(false)} disabled={saving}>Hủy</SecondaryButton><PrimaryButton onClick={saveDebtDays} loading={saving}>Áp dụng</PrimaryButton></div>}>
        {debtDaysTarget && <p className="text-sm text-ink mb-3">Khách: <span className="font-semibold">{debtDaysTarget.customerType === 'COMPANY' ? debtDaysTarget.companyName : debtDaysTarget.name}</span></p>}
        <Field label="Số ngày được phép công nợ" required>
          <input type="number" min={0} max={365} value={debtDaysValue} onChange={e => setDebtDaysValue(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
        <p className="text-xs text-muted mt-1.5">Từ 1–365 ngày. Đặt 0 để tắt công nợ.</p>
      </Modal>

      <Modal open={!!activeConfirm} onClose={() => !saving && setActiveConfirm(null)}
        title={activeConfirm?.lock ? 'Khóa bán khách hàng' : 'Mở bán khách hàng'} size="sm"
        footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={() => setActiveConfirm(null)} disabled={saving}>Hủy</SecondaryButton>{activeConfirm?.lock ? <DangerButton onClick={confirmActive} loading={saving}>Xác nhận khóa</DangerButton> : <PrimaryButton onClick={confirmActive} loading={saving}>Xác nhận mở</PrimaryButton>}</div>}>
        <p className="text-sm text-ink">
          {activeConfirm?.mode === 'bulk'
            ? <>Bạn có chắc muốn {activeConfirm.lock ? 'khóa bán' : 'mở bán'} cho <span className="font-bold text-gold">{selectedIds.size}</span> khách hàng?</>
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
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-xl px-4 py-3">
            <p className="text-xs text-red-400 font-medium mb-0.5">Sẽ xóa khách hàng</p>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
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

          <p className="text-sm text-ink-2">
            Khách hàng sẽ <span className="font-semibold">không hiển thị</span> trên
            hệ thống sau khi xóa. Hành động này <span className="font-semibold text-red-600 dark:text-red-300">không thể hoàn tác</span>.
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

      {/* Modal chọn khách hàng trước khi xuất báo cáo công nợ */}
      <DebtReportCustomerModal
        open={debtModalOpen}
        onClose={() => setDebtModalOpen(false)}
        fetchCustomers={fetchCustomersForReport}
        onConfirm={(ids) => handleExportAgedReceivables(ids)}
        onExportAll={() => handleExportAgedReceivables(null)}
        exporting={exportingDebt}
      />

      {contract.render()}
    </div>
  );
}