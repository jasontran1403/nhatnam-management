// src/pages/admin/AdminCustomers.jsx
import { useLang } from '../../context/LangContext';
import { useEffect, useState, useCallback, useRef, useMemo, Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  Users, Search, Percent, Lock, Unlock,
  Building2, User as UserIcon, CalendarDays, UserPlus, X, ChevronDown, Download, Upload,
  Edit2, MapPin, Star, Plus, Trash2, ArrowUp, ArrowDown, ChevronsUpDown, FileText, Pencil,
  ChevronRight, Layers, Cake, Store, Ticket, Gift,
} from 'lucide-react';
import { ContractBadge, useContractModals } from '../../components/customer/CustomerContract';
import { adminCustomerApi, reportApi } from '../../api/adminApi';
import { formatPrice } from '../../utils/formatPrice';
import useDebounce from '../../utils/useDebounce.js';
import { Badge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import DatePicker from '../../components/ui/DatePicker';
import AddressSelect from '../../components/common/AddressSelect';
import PickupToggle, { PICKUP_AT_WAREHOUSE } from '../../components/common/PickupToggle';
import { formatDayMonth, anniversaryBadgeClass, countdownLabel } from '../../utils/anniversary';
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
  const [form, setForm] = useState({ receiverName: '', receiverPhone: '', receiverAddress: '', provinceName: '', wardName: '' });
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

  const resetForm = () => setForm({ receiverName: '', receiverPhone: '', receiverAddress: '', provinceName: '', wardName: '' });

  const handleAdd = async () => {
    if (!form.receiverAddress.trim()) { toast(t('delivery', 'shipping_address_req'), 'error'); return; }
    if (form.receiverAddress !== PICKUP_AT_WAREHOUSE && !form.wardName) {
      toast('Vui lòng chọn Phường/Xã/Đặc khu', 'error'); return;
    }
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
    if (form.receiverAddress !== PICKUP_AT_WAREHOUSE && !form.wardName) {
      toast('Vui lòng chọn Phường/Xã/Đặc khu', 'error'); return;
    }
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
      provinceName: r.provinceName || '',
      wardName: r.wardName || '',
    });
  };

  const isPickup = form.receiverAddress === PICKUP_AT_WAREHOUSE;

  const ReceiverForm = ({ onSave, onCancel }) => (
    <div className="space-y-2">
      {/* Toggle đặt trên cùng: nó quyết định có phải nhập địa chỉ hay không. */}
      <PickupToggle
        checked={isPickup}
        onChange={on => setForm(f => ({
          ...f,
          receiverAddress: on ? PICKUP_AT_WAREHOUSE : '',
          provinceName: '', wardName: '',
        }))}
      />

      <input
        value={isPickup ? '' : form.receiverAddress}
        onChange={e => setForm(f => ({ ...f, receiverAddress: e.target.value }))}
        disabled={isPickup}
        className={`${inputCls} disabled:bg-surface-2 disabled:text-faint disabled:cursor-not-allowed`}
        placeholder="Số nhà, tên đường *"
      />

      {!isPickup && (
        <AddressSelect
          compact
          province={form.provinceName}
          ward={form.wardName}
          onChange={(prov, w) => setForm(f => ({ ...f, provinceName: prov, wardName: w }))}
        />
      )}
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
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
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
  // true khi user đã tự sửa ô "Tên trên hợp đồng" → ngừng tự điền theo tên khách
  const [contractTouched, setContractTouched] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', customerType: 'RETAIL',
    pricingType: 'RETAIL_PRICE', discountRate: 0, debtDays: 0, requirePrepayment: false,
    contractName: '',
    companyName: '', taxCode: '', companyPhone: '', companyAddress: '', contactName: '',
    birthday: null, storeOpeningDate: null,
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
        requirePrepayment: !!customer.requirePrepayment,
        contractName: customer.contractName || '',
        companyName: customer.companyName || '',
        taxCode: customer.taxCode || '',
        companyPhone: customer.companyPhone || '',
        companyAddress: customer.companyAddress || '',
        contactName: customer.contactName || '',
        birthday: customer.birthday ?? null,
        storeOpeningDate: customer.storeOpeningDate ?? null,
      });
      // Đang sửa khách đã có tên hợp đồng riêng → không tự ghi đè
      setContractTouched(!!customer.contractName);
    } else {
      setForm({
        name: '', phone: '', email: '', customerType: 'RETAIL',
        pricingType: 'RETAIL_PRICE', discountRate: 0, debtDays: 0, requirePrepayment: false,
        contractName: '',
        companyName: '', taxCode: '', companyPhone: '', companyAddress: '', contactName: '',
        birthday: null, storeOpeningDate: null,
      });
      setContractTouched(false);
    }
  }, [open, customer]);

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    // TẠO MỚI: "Tên trên hợp đồng" tự bám theo tên khách / tên công ty,
    // cho tới khi user tự sửa ô đó (contractTouched).
    if (!isEdit && !contractTouched
        && (k === 'name' || k === 'companyName' || k === 'customerType')) {
      const isCo = (k === 'customerType' ? v : f.customerType) === 'COMPANY';
      next.contractName = (isCo ? next.companyName : next.name) || '';
    }
    return next;
  });
  const isCompany = form.customerType === 'COMPANY';
  // Tên mặc định nếu ô hợp đồng để trống (dùng làm placeholder)
  const contractPlaceholder = (isCompany ? form.companyName : form.name)?.trim() || 'Tên công ty / tên khách hàng';

  const handleSave = async () => {
    if (!form.name.trim() && !form.companyName.trim()) {
      alert('Vui lòng nhập tên khách hàng hoặc tên công ty'); return;
    }
    // Khách lẻ BẮT BUỘC có sinh nhật — kể cả khi chỉ đổi loại từ Công ty sang Cá nhân.
    // Khách công ty thì ngày khai trương là tuỳ chọn.
    if (!isCompany && !form.birthday) {
      alert('Vui lòng nhập ngày sinh nhật cho khách lẻ'); return;
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
        // Tên trên hợp đồng: gửi '' (không phải null) để BE hiểu là XOÁ → quay về tên mặc định
        contractName: form.contractName ?? '',
        // Gửi null khi đổi loại để BE xoá dữ liệu không còn phù hợp.
        birthday: isCompany ? null : (form.birthday ?? null),
        storeOpeningDate: isCompany ? (form.storeOpeningDate ?? null) : null,
      };
      // "Yêu cầu thanh toán trước" có endpoint riêng (chỉ OWNER/ADMIN) → gọi tách.
      if (isEdit) {
        await adminCustomerApi.update(customer.id, payload);
        if (!!customer.requirePrepayment !== !!form.requirePrepayment) {
          await adminCustomerApi.updateRequirePrepayment(customer.id, !!form.requirePrepayment);
        }
      } else {
        const created = await adminCustomerApi.create(payload);
        const newId = created?.id ?? created?.data?.id;
        if (newId && form.requirePrepayment) {
          await adminCustomerApi.updateRequirePrepayment(newId, true);
        }
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

        {/* Ngày kỷ niệm — đổi theo loại khách */}
        {isCompany ? (
          <Field label="Ngày khai trương cửa hàng mới"
            hint="Không bắt buộc — dùng để nhắc tặng quà/voucher khai trương">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <DatePicker
                  value={form.storeOpeningDate}
                  onChange={v => set('storeOpeningDate', v)}
                  placeholder="Chọn ngày khai trương"
                />
              </div>
              {form.storeOpeningDate && (
                <button type="button" onClick={() => set('storeOpeningDate', null)}
                  className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  title="Xoá ngày khai trương">
                  <X size={15} />
                </button>
              )}
            </div>
          </Field>
        ) : (
          <Field label="Ngày sinh nhật" required
            hint="Bắt buộc với khách lẻ — dùng để nhắc và tặng voucher sinh nhật">
            <DatePicker
              value={form.birthday}
              onChange={v => set('birthday', v)}
              placeholder="Chọn ngày sinh nhật"
              maxDate={new Date()}
            />
          </Field>
        )}

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

        {/* ── TÊN TRÊN HỢP ĐỒNG ── */}
        <Field label="Tên trên hợp đồng">
          <input
            value={form.contractName}
            onChange={e => { setContractTouched(true); set('contractName', e.target.value); }}
            className={inputCls}
            placeholder={contractPlaceholder}
          />
        </Field>
        <p className="text-xs text-muted -mt-1">
          Để trống nếu dùng {isCompany ? 'tên công ty' : 'tên khách hàng'}.
          {contractPlaceholder && <> Mặc định: <b className="text-ink">{contractPlaceholder}</b></>}
        </p>

        {/* ── YÊU CẦU THANH TOÁN TRƯỚC KHI GIAO HÀNG ── */}
        <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-line
          bg-surface cursor-pointer hover:border-gold transition">
          <input
            type="checkbox"
            checked={!!form.requirePrepayment}
            onChange={e => set('requirePrepayment', e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-gold flex-shrink-0"
          />
          <span className="text-sm">
            <b className="text-ink">Yêu cầu thanh toán trước khi giao hàng</b>
            <span className="block text-xs text-muted mt-0.5 leading-relaxed">
              Bật: kho <b>không</b> chuyển được đơn của khách này sang "Đang giao" cho tới khi thu đủ tiền.
              Kế toán vẫn tạo được phiếu thu khi đơn đang chuẩn bị (chỉ ghi nhận đã thu, không hoàn thành đơn).
              <br />Chỉ áp dụng cho <b>đơn tạo mới</b> — đơn đang chạy dở giữ nguyên.
            </span>
          </span>
        </label>

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

// ── Import Customers Modal ────────────────────────────────────────────────────
function ImportCustomersModal({ open, onClose, onDone }) {
  const toast = useToast();
  const [step, setStep] = useState('upload');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { if (!open) { setStep('upload'); setResult(null); setUploadError(null); } }, [open]);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true); setUploadError(null);
    try {
      const res = await adminCustomerApi.importAll(file);
      const body = res?.data || {};
      if (!body.success || (body.data === null && body.message && body.code !== 200)) {
        setUploadError(body.message || 'Lỗi import khách hàng');
        return;
      }
      const d = body.data || {};
      setResult({ updated: d.updated ?? 0, skipped: d.skipped ?? 0, errors: d.errors || [] });
      setStep('result');
      if ((d.updated ?? 0) > 0) onDone();
    } catch (e) {
      setUploadError(e?.response?.data?.message || 'Lỗi import khách hàng');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Import khách hàng"
      subtitle={step === 'upload' ? 'Dùng file Export từ hệ thống — file chỉ import được 1 lần' : 'Kết quả import'}
      size="sm">
      {step === 'upload' ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center">
            {uploading
              ? <div className="w-7 h-7 border-[3px] border-gold border-t-transparent rounded-full animate-spin" />
              : <Upload size={24} className="text-gold" />}
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-semibold text-ink">{uploading ? 'Đang xử lý...' : 'Chọn file Excel để import'}</p>
            <p className="text-xs text-muted">Backend dựa vào cột <strong>ID</strong> để cập nhật.</p>
            <p className="text-xs text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-1.5">
              ⚠ Mỗi file chỉ import được <strong>1 lần</strong>. Export lại nếu muốn import tiếp.
            </p>
            {uploadError && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-3 py-2.5 text-left">
                <span className="text-red-500 shrink-0 mt-0.5">✕</span>
                <p className="text-xs text-red-600 dark:text-red-300 font-medium">{uploadError}</p>
              </div>
            )}
          </div>
          {!uploading && (
            <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold cursor-pointer hover:bg-gold-deep transition-colors">
              <Upload size={14} /> Chọn file .xlsx
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{result?.updated ?? 0}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">Cập nhật thành công</p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-red-500">{result?.skipped ?? 0}</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">Bỏ qua / lỗi</p>
            </div>
          </div>
          {result?.errors?.length > 0 && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/18 rounded-xl p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-red-600 dark:text-red-300 mb-1.5">Chi tiết lỗi:</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-500 py-0.5 border-b border-red-100 dark:border-red-500/18 last:border-0">{err}</p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <SecondaryButton onClick={onClose} className="flex-1">Đóng</SecondaryButton>
            <label className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-gold text-white text-sm font-semibold cursor-pointer hover:bg-gold-deep">
              <Upload size={13} /> Import file mới
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { if (e.target.files[0]) { setStep('upload'); handleFile(e.target.files[0]); } }} />
            </label>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
/**
 * Đường dẫn gốc của khu vực đang đứng (`/owner` hoặc `/admin`).
 *
 * <p>Component này được mount ở cả hai khu vực nên không thể hardcode. Suy từ URL hiện
 * tại thay vì từ role: một tài khoản có nhiều role vẫn chỉ đang đứng ở đúng một khu vực,
 * và link phải trỏ về khu vực đó để nút quay lại không nhảy sang menu khác.
 */
function useBasePath() {
  const { pathname } = useLocation();
  return pathname.startsWith('/owner') ? '/owner' : '/admin';
}

/** Nút mở hai trang con: Quản lý voucher và Phiếu tặng quà. */
function SubPageLinks({ base }) {
  const navigate = useNavigate();
  const cls = 'flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line ' +
    'text-xs text-ink-2 hover:border-gold hover:text-gold transition-colors';
  return (
    <>
      <button onClick={() => navigate(`${base}/vouchers`)} className={cls}>
        <Ticket size={13} /> Voucher
      </button>
      <button onClick={() => navigate(`${base}/gift-orders`)} className={cls}>
        <Gift size={13} /> Phiếu tặng quà
      </button>
    </>
  );
}

export default function AdminCustomers() {
  const basePath = useBasePath();
  const { t } = useLang();
  const toast = useToast();
  const [filters, setFilters] = useState({ q: '', type: '', isActive: '', sellerId: '' });
  const debouncedQ = useDebounce(filters.q, 600);
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  /**
   * Dữ liệu gom theo danh mục, KHÔNG phân trang.
   * [{ categoryId, categoryName, color, sortOrder, total, customers[] }]
   */
  const [groups, setGroups] = useState([]);
  /**
   * Tập categoryId đang MỞ. Chỉ danh mục ĐẦU TIÊN được mở khi vào trang — mở hết sẽ
   * đổ ra hàng nghìn dòng cùng lúc và mất luôn ý nghĩa của việc gom nhóm.
   * Dùng key dạng chuỗi vì nhóm "Chưa phân loại" có categoryId = null.
   */
  const [expanded, setExpanded] = useState(() => new Set());
  /** Đã tự mở nhóm đầu tiên lần nào chưa — chỉ làm MỘT LẦN, để việc người dùng chủ động
   *  gập nhóm đó lại rồi lọc/tìm kiếm không bị hệ thống bung ra lại. */
  const [autoExpanded, setAutoExpanded] = useState(false);
  const [loading, setLoading] = useMinLoading();
  // Sort theo công nợ chưa thanh toán: null (mặc định) → 'desc' (cao→thấp) → 'asc' (thấp→cao)
  const [debtSort, setDebtSort] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [historyCustomerId, setHistoryCustomerId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exportingDebt, setExportingDebt] = useState(false);


  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountTarget, setDiscountTarget] = useState(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [activeConfirm, setActiveConfirm] = useState(null);

  const [debtDaysOpen, setDebtDaysOpen] = useState(false);
  // Sửa nhanh "Tên trên hợp đồng" ngay trên bảng
  const [contractOpen, setContractOpen] = useState(false);
  const [contractTarget, setContractTarget] = useState(null);
  const [contractValue, setContractValue] = useState('');
  const [debtDaysTarget, setDebtDaysTarget] = useState(null);
  const [debtDaysValue, setDebtDaysValue] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);

  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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
      // Lấy tên file từ header nếu có, fallback về tên mặc định
      const disposition = res.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : `danh-sach-khach-hang.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || 'Lỗi khi xuất dữ liệu');
    } finally {
      setExporting(false);
    }
  }, [debouncedQ, filters]);

  // Nguồn dữ liệu cho modal chọn khách hàng (search + phân trang)
  const fetchCustomersForReport = useCallback(async ({ q, page: p = 0, size = 20 }) => {
    const res = await adminCustomerApi.list({ q: q || undefined, page: p, size, sort: 'id,desc' });
    const content = res?.content || [];
    const totalElements = res?.totalElements ?? res?.totalItems ?? content.length;
    const totalPages = res?.totalPages ?? Math.ceil(totalElements / size);
    return { content, totalPages, totalElements };
  }, []);

  // Export báo cáo công nợ (Aged Receivables) — PDF.
  // customerIds = mảng ID → chỉ xuất đúng những khách chọn ở modal;
  // null → xuất theo bộ lọc đang hiển thị (hành vi cũ).
  const handleExportAgedReceivables = useCallback(async (customerIds = null) => {
    setExportingDebt(true);
    try {
      const activeFilters = (customerIds && customerIds.length)
        ? { customerIds }
        : {
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
      const params = {};
      if (debouncedQ) params.q = debouncedQ;
      if (filters.type) params.type = filters.type;
      if (filters.isActive !== '') params.isActive = filters.isActive;
      if (filters.sellerId !== '') params.sellerId = filters.sellerId;
      const res = await adminCustomerApi.listGrouped(params);
      setGroups(Array.isArray(res) ? res : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [debouncedQ, filters.type, filters.isActive, filters.sellerId, setLoading]);

  /** Key ổn định cho một nhóm — nhóm "Chưa phân loại" có categoryId = null. */
  const groupKey = (g) => (g.categoryId == null ? '__none__' : String(g.categoryId));

  /**
   * Danh sách phẳng — dùng cho chọn tất cả, đếm tổng, và sort theo công nợ.
   * Chỉ tính trên các nhóm ĐANG MỞ khi thao tác chọn, xem `visibleCustomers` bên dưới.
   */
  const allCustomers = useMemo(
    () => groups.flatMap(g => g.customers || []),
    [groups],
  );

  /**
   * Khách đang HIỂN THỊ trên màn hình (thuộc nhóm đang mở).
   *
   * <p>Nút "chọn tất cả" chỉ được phép chọn những dòng người dùng đang NHÌN THẤY —
   * nếu chọn cả khách trong nhóm đang gập thì một cú bấm "Khoá bán" có thể khoá
   * hàng trăm khách mà người bấm không hề biết.
   */
  const visibleCustomers = useMemo(
    () => groups.filter(g => expanded.has(groupKey(g))).flatMap(g => g.customers || []),
    [groups, expanded],
  );

  /** Sắp xếp khách trong MỘT nhóm theo công nợ (nếu đang bật sort). */
  const sortCustomers = useCallback((list) => {
    if (!debtSort) return list;
    const dir = debtSort === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => ((a.unpaidDebt || 0) - (b.unpaidDebt || 0)) * dir);
  }, [debtSort]);

  const toggleGroup = (g) => {
    const key = groupKey(g);
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const expandAll = () => setExpanded(new Set(groups.map(groupKey)));
  const collapseAll = () => setExpanded(new Set());

  // Mở sẵn nhóm ĐẦU TIÊN. Backend đặt nhóm ảo "Sắp tới sinh nhật / khai trương" lên đầu
  // khi có khách, nên nhóm đó được mở mặc định; không có ai sắp tới dịp thì nhóm đầu là
  // danh mục đầu tiên trong DB như cũ.
  useEffect(() => {
    if (autoExpanded || groups.length === 0) return;
    setExpanded(new Set([groupKey(groups[0])]));
    setAutoExpanded(true);
  }, [groups, autoExpanded]);

  // Modal xem / tải hợp đồng — tải lại danh sách sau khi thay để badge "có hợp
  // đồng" cập nhật ngay, không phải F5.
  const contract = useContractModals(() => load());

  // Bấm header "Công nợ (chưa TT)": desc → asc → tắt sort
  const cycleDebtSort = useCallback(() => {
    setDebtSort(prev => prev === 'desc' ? 'asc' : prev === 'asc' ? null : 'desc');
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelectedIds(new Set()); }, [filters]);

  if (historyCustomerId) {
    return (
      <CustomerOrderHistory
        customerId={historyCustomerId}
        apiPrefix="/api/admin"
        onBack={() => setHistoryCustomerId(null)}
      />
    );
  }

  const allChecked = visibleCustomers.length > 0 && visibleCustomers.every(c => selectedIds.has(c.id));
  const anyChecked = selectedIds.size > 0;
  const toggleOne = (id) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };
  const toggleAll = () => {
    allChecked
      ? setSelectedIds(new Set())
      : setSelectedIds(new Set(visibleCustomers.map(c => c.id)));
  };

  const openDiscountSingle = (c) => { setDiscountTarget(c); setDiscountValue(c.discountRate || 0); setDiscountOpen(true); };
  const openDiscountBulk = () => { if (!anyChecked) return; setDiscountTarget(null); setDiscountValue(0); setDiscountOpen(true); };
  const openDebtDays = (c, e) => { e.stopPropagation(); setDebtDaysTarget(c); setDebtDaysValue(c.debtDays || 0); setDebtDaysOpen(true); };
  const openContractName = (c, e) => {
    e.stopPropagation();
    setContractTarget(c);
    setContractValue(c.contractName || '');   // rỗng = đang dùng tên mặc định
    setContractOpen(true);
  };
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

  const saveContractName = async () => {
    setSaving(true);
    try {
      // Gửi '' để xoá → BE quay về tên mặc định (tên công ty / tên khách)
      await adminCustomerApi.updateContractName(contractTarget.id, contractValue.trim());
      setContractOpen(false); load();
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
        <PageHeader icon={Users} title="Khách hàng"
          subtitle={`${formatNumber(allCustomers.length)} khách · ${groups.length} danh mục`} />
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Hai trang con mở từ đây thay vì từ menu — chúng chỉ có ý nghĩa trong ngữ
              cảnh chăm sóc khách hàng, để ở menu chính sẽ làm menu dài ra vô ích. */}
          <SubPageLinks base={basePath} />
          <PrimaryButton onClick={() => { setEditCustomer(null); setCreateOpen(true); }}
            className="flex items-center gap-1.5 text-xs px-3 py-2">
            <UserPlus size={13} /> Tạo khách hàng
          </PrimaryButton>
          <button onClick={() => setDebtModalOpen(true)} disabled={exportingDebt}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-all disabled:opacity-60">
            {exportingDebt
              ? <span className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              : <FileText size={13} />}
            {exportingDebt ? 'Đang xuất...' : 'Báo cáo công nợ'}
          </button>
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-all">
            <Upload size={13} /> Import
          </button>
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
            <input type="text" placeholder="Tìm tên, SĐT, email, công ty, tên hợp đồng, mã KH..."
              value={filters.q}
              onChange={e => { setFilters({ ...filters, q: e.target.value }); }}
              className={`${inputCls} pl-9 pr-9`} />
            {filters.q && (
              <button onClick={() => { setFilters({ ...filters, q: '' }); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">✕</button>
            )}
          </div>
          <select value={filters.type}
            onChange={e => { setFilters({ ...filters, type: e.target.value }); }}
            className={`${inputCls} sm:w-40`}>
            <option value="">Tất cả loại</option>
            <option value="COMPANY">Công ty</option>
            <option value="RETAIL">Cá nhân</option>
          </select>
          <select value={filters.isActive}
            onChange={e => { setFilters({ ...filters, isActive: e.target.value }); }}
            className={`${inputCls} sm:w-40`}>
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã khóa bán</option>
          </select>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted font-medium shrink-0">Lọc theo NV Kinh Doanh:</span>
          <button
            onClick={() => { setFilters(f => ({ ...f, sellerId: '' })); }}
            className={`px-3 h-[38px] rounded-xl text-xs font-medium transition-colors border
            ${filters.sellerId === ''
                ? 'bg-gold text-white border-gold'
                : 'border-line text-ink-2 hover:bg-surface-2'}`}>
            Tất cả
          </button>
          <SellerFilterDropdown
            value={filters.sellerId}
            onChange={(v) => { setFilters(f => ({ ...f, sellerId: v })); }}
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

      {/* Điều khiển gập/mở nhóm */}
      {!loading && groups.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted">
            {expanded.size}/{groups.length} danh mục đang mở
          </span>
          <button onClick={expandAll}
            className="px-2.5 py-1 rounded-lg border border-line text-[11px] text-ink-2 hover:border-gold transition-colors">
            Mở tất cả
          </button>
          <button onClick={collapseAll}
            className="px-2.5 py-1 rounded-lg border border-line text-[11px] text-ink-2 hover:border-gold transition-colors">
            Gập tất cả
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton cols={5} rows={8} />
        ) : allCustomers.length === 0 ? <EmptyState icon={Users} title="Không có khách hàng" /> : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-canvas text-muted">
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded accent-gold" /></th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Khách hàng</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Tên trên hợp đồng</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">NV Kinh doanh</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Chiết khấu</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Công nợ</th>
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
                  {groups.map(g => {
                    const key = groupKey(g);
                    const open = expanded.has(key);
                    return (
                  <Fragment key={key}>
                  <CategoryHeaderRow group={g} open={open} onToggle={() => toggleGroup(g)} colSpan={9} />
                  {open && sortCustomers(g.customers || []).map(c => {
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
                              <AnniversaryTag customer={c} />
                            </div>
                          </div>
                        </td>
                        {/* Đã có ảnh hợp đồng → badge xanh + nút Xem hiện khi rê chuột.
                            Chưa có → text như cũ. Bấm vào ô vẫn mở sửa TÊN hợp đồng. */}
                        <td className="px-4 py-3 group/ct cursor-pointer" onClick={e => openContractName(c, e)}
                          title="Bấm để sửa tên trên hợp đồng">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ContractBadge
                              name={c.contractNameResolved || c.contractNameDefault || '—'}
                              hasContract={!!c.hasContract}
                              onView={() => contract.view(c)}
                            />
                            <Pencil size={12} className="text-gold opacity-0 group-hover/ct:opacity-100 transition shrink-0" />
                          </div>
                          {!c.contractName && (
                            <p className="text-[10px] text-faint">mặc định</p>
                          )}
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
                            {isCompany && (
                              <button onClick={e => openAssign(c, e)}
                                className="p-2 rounded-lg text-muted hover:bg-sky-50 dark:bg-sky-500/10 hover:text-sky-600 dark:text-sky-300 transition-colors"
                                title="Gán NV Kinh doanh">
                                <UserPlus size={15} />
                              </button>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); setEditCustomer(c); setCreateOpen(true); }}
                              className="p-2 rounded-lg text-muted hover:bg-gold-tint hover:text-gold transition-colors"
                              title="Sửa thông tin">
                              <Edit2 size={15} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); contract.upload(c); }}
                              className={`p-2 rounded-lg transition-colors ${c.hasContract
                                ? 'text-blue-600 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                                : 'text-muted hover:bg-canvas hover:text-ink'}`}
                              title={c.hasContract ? 'Cập nhật hợp đồng' : 'Tải hợp đồng lên'}>
                              <FileText size={15} />
                            </button>
                            <button onClick={() => openDiscountSingle(c)}
                              className="p-2 rounded-lg text-muted hover:bg-gold/10 hover:text-gold transition-colors"
                              title="Chiết khấu">
                              <Percent size={15} />
                            </button>
                            <button onClick={e => openDebtDays(c, e)}
                              className="p-2 rounded-lg text-muted hover:bg-orange-50 dark:bg-orange-500/10 hover:text-orange-500 transition-colors"
                              title="Số ngày công nợ">
                              <CalendarDays size={15} />
                            </button>
                            <button onClick={() => setActiveConfirm({ mode: 'single', lock: c.isActive, customer: c })}
                              className={`p-2 rounded-lg transition-colors ${c.isActive ? 'text-muted hover:bg-red-50 dark:bg-red-500/10 hover:text-red-600 dark:text-red-300' : 'text-muted hover:bg-emerald-50 dark:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-300'}`}>
                              {c.isActive ? <Lock size={15} /> : <Unlock size={15} />}
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setDeleteTarget(c);
                                setDeletePassword('');
                                setDeleteError('');
                              }}
                              className="p-2 rounded-lg text-muted hover:bg-red-50 dark:bg-red-500/10 hover:text-red-600 dark:text-red-300 transition-colors"
                              title="Xóa khách hàng">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-hairline">
              {groups.map(g => {
                const key = groupKey(g);
                const open = expanded.has(key);
                return (
              <Fragment key={key}>
              <CategoryHeaderCard group={g} open={open} onToggle={() => toggleGroup(g)} />
              {open && sortCustomers(g.customers || []).map(c => {
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
                        <AnniversaryTag customer={c} />
                        {/* Tên trên hợp đồng — bấm để sửa nhanh */}
                        <button onClick={e => openContractName(c, e)}
                          className="mt-0.5 flex items-center gap-1 text-[10px] text-left">
                          <FileText size={10} className="text-gold shrink-0" />
                          <span className={`truncate ${c.contractName ? 'text-ink font-medium' : 'text-faint italic'}`}>
                            {c.contractNameResolved || c.contractNameDefault || '—'}
                          </span>
                          <Pencil size={9} className="text-gold shrink-0" />
                        </button>
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
              </Fragment>
                );
              })}
            </div>
          </>
        )}
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

      <Modal open={contractOpen} onClose={() => !saving && setContractOpen(false)}
        title="Tên trên hợp đồng" size="sm"
        footer={<div className="flex justify-end gap-2">
          <SecondaryButton onClick={() => setContractOpen(false)} disabled={saving}>Hủy</SecondaryButton>
          <PrimaryButton onClick={saveContractName} loading={saving}>Lưu</PrimaryButton>
        </div>}>
        {contractTarget && (
          <>
            <p className="text-sm text-ink mb-3">
              Khách: <span className="font-semibold">
                {contractTarget.customerType === 'COMPANY'
                  ? contractTarget.companyName : contractTarget.name}
              </span>
            </p>
            <Field label="Tên trên hợp đồng">
              <input
                value={contractValue}
                onChange={e => setContractValue(e.target.value)}
                className={inputCls}
                placeholder={contractTarget.contractNameDefault || 'Tên công ty / tên khách hàng'}
              />
            </Field>
            <p className="text-xs text-muted mt-1.5">
              Để trống để dùng tên mặc định:{' '}
              <b className="text-ink">{contractTarget.contractNameDefault || '—'}</b>
            </p>
          </>
        )}
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

      <ImportCustomersModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={load}
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
// ── Header nhóm danh mục ─────────────────────────────────────────────────────

/**
 * Hàng tiêu đề của một danh mục trong bảng desktop.
 *
 * <p>Dùng `colSpan` thay vì render các ô rỗng để tiêu đề chạy hết chiều ngang bảng —
 * cách này giữ nguyên độ rộng cột đã tính cho các hàng dữ liệu, nếu tách ô thì trình
 * duyệt sẽ tính lại layout và các cột nhảy mỗi lần gập/mở nhóm.
 */
function CategoryHeaderRow({ group: g, open, onToggle, colSpan }) {
  return (
    <tr
      onClick={onToggle}
      className={`border-t border-hairline cursor-pointer select-none sticky top-0 z-[1]
        ${g.virtual
          ? 'bg-rose-50 dark:bg-rose-500/12 hover:bg-rose-100 dark:hover:bg-rose-500/18'
          : 'bg-canvas/80 hover:bg-canvas'}`}>
      <td colSpan={colSpan} className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <ChevronRight
            size={16}
            className={`text-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
          {g.virtual
            ? <Cake size={14} className="text-rose-500 shrink-0" />
            : <span
                className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/10"
                style={{ background: g.color || 'var(--c-gold)' }}
              />}
          <span className="font-bold text-ink text-sm">{g.categoryName}</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold
            ${g.virtual
              ? 'bg-rose-500 text-white'
              : 'bg-gold/10 text-gold'}`}>
            {g.total}
          </span>
          {g.virtual && (
            <span className="text-[10px] text-rose-600/80 dark:text-rose-300/70 italic">
              trong tháng này — đã tách khỏi danh mục gốc
            </span>
          )}
          {!g.virtual && g.total === 0 && (
            <span className="text-[10px] text-faint italic">chưa có khách nào</span>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Bản mobile của header nhóm. */
function CategoryHeaderCard({ group: g, open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2.5 px-4 py-3 transition-colors text-left
        ${g.virtual
          ? 'bg-rose-50 dark:bg-rose-500/12'
          : 'bg-canvas/80 hover:bg-canvas'}`}>
      <ChevronRight
        size={16}
        className={`text-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      />
      {g.virtual
        ? <Cake size={14} className="text-rose-500 shrink-0" />
        : <span
            className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/10"
            style={{ background: g.color || 'var(--c-gold)' }}
          />}
      <span className="font-bold text-ink text-sm flex-1 truncate">{g.categoryName}</span>
      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold
        ${g.virtual ? 'bg-rose-500 text-white' : 'bg-gold/10 text-gold'}`}>
        {g.total}
      </span>
    </button>
  );
}

/**
 * Badge ngày kỷ niệm dùng chung cho bảng khách hàng: sinh nhật (khách lẻ) hoặc
 * ngày khai trương cửa hàng mới (khách công ty).
 *
 * <p>Chỉ hiện khi dịp đó thuộc tháng hiện tại và CHƯA QUA — cờ `anniversaryUpcoming`
 * do server tính. Đã qua ngày thì không hiện gì, đúng yêu cầu "đã qua thì hiển thị
 * bình thường".
 */
export function AnniversaryTag({ customer: c }) {
  const isCompany = c.customerType === 'COMPANY';
  const value = isCompany ? c.storeOpeningDate : c.birthday;
  if (!value) return null;

  const tone = isCompany ? 'emerald' : 'rose';
  const Icon = isCompany ? Store : Cake;
  const label = c.anniversaryUpcoming ? countdownLabel(c.daysUntilAnniversary) : null;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <span className={`inline-flex items-center gap-1 text-[10px]
        ${c.anniversaryUpcoming
          ? (isCompany ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300')
          : 'text-faint'}`}>
        <Icon size={9} /> {formatDayMonth(value)}
      </span>
      {label && (
        <span className={anniversaryBadgeClass(c.daysUntilAnniversary, tone)}>{label}</span>
      )}
    </span>
  );
}
