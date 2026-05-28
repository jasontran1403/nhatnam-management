// src/pages/seller/SellerCustomersPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import {
  Users, Search, X, RefreshCw, Building2, User as UserIcon,
  Phone, Mail, Edit2, AlertCircle, Check, Upload, Download,
  FileSpreadsheet, Plus, Trash2, MapPin, Star, Hash,
  ChevronDown, ChevronRight, Tag,
} from 'lucide-react';

const inputCls = 'w-full rounded-xl border border-[#E8DDD0] px-3 py-2 text-sm text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C] transition-colors bg-[#FAFAF8] placeholder:text-[#C4B9A8]';

// Bảng màu mặc định khi tạo category mới
const DEFAULT_COLORS = [
  '#C9A84C','#3B82F6','#10B981','#F59E0B','#EF4444',
  '#8B5CF6','#EC4899','#06B6D4','#84CC16','#F97316',
];

function useDebounce(val, ms) {
  const [deb, setDeb] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setDeb(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return deb;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toCamelCase(str) {
  if (!str) return str;
  const ABBREVS = new Set([
    'TNHH', 'MTV', 'CP', 'TM', 'DV', 'XD', 'SX', 'VT', 'HH',
    'KD', 'NN', 'KHCN', 'CNTT', 'IT', 'VN', 'DN', 'BV', 'TP', 'HN', 'HCM',
    'Q', 'P', 'PGD', 'GD', 'KT', 'NV', 'VP', 'TW', 'TG',
  ]);
  return str.split(' ').map(word => {
    if (!word) return word;
    const upper = word.toUpperCase();
    if (ABBREVS.has(upper)) return upper;
    if (word === word.toUpperCase() && word.length > 0)
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    return word;
  }).join(' ');
}

// ─── Category Combobox ────────────────────────────────────────────────────────
// Search + dropdown + thêm nhanh
function CategoryCombobox({ value, onChange }) {
  const toast = useToast();
  const [query, setQuery]       = useState('');
  const [options, setOptions]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef(null);
  const debouncedQ = useDebounce(query, 250);

  // Load options khi query thay đổi
  useEffect(() => {
    api.get(`/api/seller/customer-categories/search?q=${encodeURIComponent(debouncedQ)}`)
      .then(r => setOptions(r.data?.data || []))
      .catch(() => {});
  }, [debouncedQ]);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const exactMatch = options.some(o => o.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate  = query.trim().length > 0 && !exactMatch;

  const handleSelect = (cat) => {
    onChange(cat);
    setQuery('');
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      // Chọn màu ngẫu nhiên từ bảng màu
      const color = DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
      const res = await api.post('/api/seller/customer-categories', { name, color });
      const created = res.data?.data;
      if (created) {
        toast(`Đã tạo phân loại "${created.name}"`, 'success');
        onChange(created);
        setQuery('');
        setOpen(false);
      }
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi tạo phân loại', 'error');
    } finally { setCreating(false); }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-text transition-colors
          ${open ? 'border-[#C9A84C]' : 'border-[#E8DDD0]'} bg-[#FAFAF8]`}
        onClick={() => { setOpen(true); }}
      >
        <Tag size={13} className="text-[#C4B9A8] shrink-0" />
        {value && !open ? (
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            {value.color && (
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: value.color }} />
            )}
            <span className="text-sm text-[#1C1C1E] truncate">{value.name}</span>
          </div>
        ) : (
          <input
            autoFocus={open}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={value ? value.name : 'Tìm hoặc tạo phân loại...'}
            className="flex-1 bg-transparent text-sm text-[#1C1C1E] outline-none placeholder:text-[#C4B9A8]"
          />
        )}
        {value && (
          <button onClick={handleClear} className="text-[#C4B9A8] hover:text-red-400 shrink-0">
            <X size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-[#E8DDD0] shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {options.length === 0 && !canCreate && (
            <p className="text-xs text-[#C4B9A8] text-center py-4">Chưa có phân loại nào</p>
          )}
          {options.map(cat => (
            <button key={cat.id} onClick={() => handleSelect(cat)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-[#FDF8ED] transition-colors text-left
                ${value?.id === cat.id ? 'bg-[#FDF8ED]' : ''}`}>
              <span className="w-3 h-3 rounded-full shrink-0"
                style={{ background: cat.color || '#C9A84C' }} />
              <span className="flex-1 truncate">{cat.name}</span>
              {value?.id === cat.id && <Check size={13} className="text-[#C9A84C] shrink-0" />}
            </button>
          ))}
          {canCreate && (
            <button onClick={handleCreate} disabled={creating}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#C9A84C] hover:bg-[#FDF8ED] transition-colors border-t border-[#F0EBE3]">
              {creating
                ? <div className="w-3.5 h-3.5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                : <Plus size={13} />}
              <span>Tạo phân loại "<strong>{query.trim()}</strong>"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Receiver Form ────────────────────────────────────────────────────────────
function ReceiverForm({ form, setForm, onSave, onCancel, saving }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">
          Địa chỉ nhận hàng <span className="text-red-400">*</span>
        </label>
        <input value={form.receiverAddress} onChange={e => setForm(f => ({ ...f, receiverAddress: e.target.value }))}
          className={inputCls} placeholder="123 Đường ABC, Phường XYZ, Quận 1, TP.HCM" autoFocus />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Tên người nhận</label>
        <input value={form.receiverName} onChange={e => setForm(f => ({ ...f, receiverName: e.target.value }))}
          className={inputCls} placeholder="Nguyễn Văn A" />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">SĐT người nhận</label>
        <input value={form.receiverPhone} onChange={e => setForm(f => ({ ...f, receiverPhone: e.target.value }))}
          className={inputCls} placeholder="0901 234 567" />
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg border border-[#E8DDD0] text-xs text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
          Hủy
        </button>
        <button onClick={onSave} disabled={saving}
          className="flex-1 py-1.5 rounded-lg bg-[#C9A84C] text-white text-xs font-semibold hover:bg-[#b8973d] disabled:opacity-50 transition-colors">
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
      </div>
    </div>
  );
}

// ─── Receiver Infos Section ───────────────────────────────────────────────────
function ReceiverInfosSection({ customerId }) {
  const toast = useToast();
  const [receivers, setReceivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ receiverName: '', receiverPhone: '', receiverAddress: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/seller/customers/${customerId}/receiver-infos`);
      setReceivers(res.data?.data || []);
    } catch { toast('Không thể tải địa chỉ nhận hàng', 'error'); }
    finally { setLoading(false); }
  }, [customerId, toast]);

  useEffect(() => { load(); }, [load]);
  const resetForm = () => setForm({ receiverName: '', receiverPhone: '', receiverAddress: '' });

  const handleAdd = async () => {
    if (!form.receiverAddress.trim()) { toast('Vui lòng nhập địa chỉ', 'error'); return; }
    setSaving(true);
    try {
      await api.post(`/api/seller/customers/${customerId}/receiver-infos`, form);
      toast('Đã thêm địa chỉ', 'success'); setAdding(false); resetForm(); load();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi', 'error'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id) => {
    if (!form.receiverAddress.trim()) { toast('Vui lòng nhập địa chỉ', 'error'); return; }
    setSaving(true);
    try {
      await api.put(`/api/seller/customers/${customerId}/receiver-infos/${id}`, form);
      toast('Đã cập nhật', 'success'); setEditingId(null); resetForm(); load();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa địa chỉ này?')) return;
    try {
      await api.delete(`/api/seller/customers/${customerId}/receiver-infos/${id}`);
      toast('Đã xóa', 'success'); load();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi', 'error'); }
  };

  const handleSetDefault = async (id) => {
    try {
      await api.patch(`/api/seller/customers/${customerId}/receiver-infos/${id}/set-default`);
      toast('Đã đặt làm mặc định', 'success'); load();
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi', 'error'); }
  };

  const startEdit = (r) => {
    setEditingId(r.id); setAdding(false);
    setForm({ receiverName: r.receiverName || '', receiverPhone: r.receiverPhone || '', receiverAddress: r.receiverAddress || '' });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-[#8E8878] uppercase tracking-wider">
          📦 Địa chỉ nhận hàng {receivers.length > 0 && `(${receivers.length})`}
        </label>
        {!adding && editingId === null && (
          <button onClick={() => { setAdding(true); setEditingId(null); resetForm(); }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-semibold hover:bg-[#C9A84C]/20 transition-colors">
            <Plus size={11} /> Thêm địa chỉ
          </button>
        )}
      </div>
      {adding && (
        <div className="border border-[#C9A84C]/30 rounded-xl p-3 bg-[#FDF8ED]">
          <p className="text-[11px] font-semibold text-[#C9A84C] mb-2">Thêm địa chỉ mới</p>
          <ReceiverForm form={form} setForm={setForm} onSave={handleAdd}
            onCancel={() => { setAdding(false); resetForm(); }} saving={saving} />
        </div>
      )}
      {loading ? (
        <div className="text-xs text-[#8E8878] text-center py-3">Đang tải...</div>
      ) : receivers.length === 0 && !adding ? (
        <div className="text-xs text-[#C4B9A8] text-center py-3 italic border border-dashed border-[#E8DDD0] rounded-xl">
          Chưa có địa chỉ nhận hàng
        </div>
      ) : (
        <div className="space-y-2">
          {receivers.map(r => (
            <div key={r.id} className={`rounded-xl border p-3 ${r.isDefault ? 'border-[#C9A84C]/40 bg-[#FDF8ED]' : 'border-[#F0EBE3] bg-white'}`}>
              {editingId === r.id ? (
                <div>
                  <p className="text-[11px] font-semibold text-[#5C4E3D] mb-2">Chỉnh sửa địa chỉ</p>
                  <ReceiverForm form={form} setForm={setForm}
                    onSave={() => handleUpdate(r.id)}
                    onCancel={() => { setEditingId(null); resetForm(); }} saving={saving} />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      {r.isDefault && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#C9A84C]"><Star size={9} fill="currentColor" /> Mặc định</span>}
                      {r.receiverName && <span className="text-xs font-semibold text-[#1C1C1E]">{r.receiverName}</span>}
                      {r.receiverPhone && <span className="text-[11px] text-[#8E8878]">{r.receiverPhone}</span>}
                    </div>
                    <p className="text-xs text-[#5C4E3D] flex items-start gap-1">
                      <MapPin size={10} className="mt-0.5 shrink-0 text-[#8E8878]" />
                      <span>{r.receiverAddress}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!r.isDefault && (
                      <button onClick={() => handleSetDefault(r.id)}
                        className="p-1.5 rounded-lg text-[#C4B9A8] hover:text-[#C9A84C] hover:bg-[#FDF8ED] transition-colors">
                        <Star size={12} />
                      </button>
                    )}
                    <button onClick={() => startEdit(r)}
                      className="p-1.5 rounded-lg text-[#8E8878] hover:text-[#C9A84C] hover:bg-[#FDF8ED] transition-colors">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      className="p-1.5 rounded-lg text-[#8E8878] hover:text-red-400 hover:bg-red-50 transition-colors">
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

// ─── Edit Customer Modal ──────────────────────────────────────────────────────
function EditCustomerModal({ open, customer, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [codeChecking, setCodeChecking] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [category, setCategory]   = useState(null); // { id, name, color }
  const codeDebounceRef = useRef(null);

  useEffect(() => {
    if (!open || !customer) return;
    setCodeError('');
    setForm({
      customerCode:   customer.customerCode  || '',
      customerType:   customer.customerType  || 'RETAIL',
      name:           customer.name          || '',
      phone:          customer.phone         || '',
      email:          customer.email         || '',
      companyName:    customer.companyName   || '',
      taxCode:        customer.taxCode       || '',
      companyPhone:   customer.companyPhone  || '',
      companyAddress: customer.companyAddress|| '',
      contactName:    customer.contactName   || '',
      pricingType:    customer.pricingType   || 'RETAIL_PRICE',
    });
    // Khôi phục category từ data hiện tại
    setCategory(customer.categoryId
      ? { id: customer.categoryId, name: customer.categoryName, color: customer.categoryColor }
      : null);
  }, [open, customer]);

  if (!open || !customer) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isCompany = form.customerType === 'COMPANY';

  const handleCodeChange = (val) => {
    set('customerCode', val);
    setCodeError('');
    clearTimeout(codeDebounceRef.current);
    const trimmed = val.trim().toUpperCase();
    if (!trimmed || trimmed === (customer.customerCode || '').toUpperCase()) return;
    setCodeChecking(true);
    codeDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/seller/customers/check-code?code=${trimmed}`);
        if (res.data?.data?.exists) setCodeError(`Mã "${trimmed}" đã tồn tại`);
      } catch (_) {}
      finally { setCodeChecking(false); }
    }, 500);
  };

  const handleSave = async () => {
    if (codeError) { toast(codeError, 'error'); return; }
    if (!form.customerCode?.trim()) { toast('Mã khách hàng không được để trống', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        customerCode:   form.customerCode.trim().toUpperCase(),
        customerType:   form.customerType,
        pricingType:    form.pricingType,
        name:           toCamelCase(form.name) || null,
        phone:          form.phone   || null,
        email:          form.email   || null,
        taxCode:        form.taxCode || null,
        companyName:    isCompany ? (toCamelCase(form.companyName)    || null) : null,
        companyPhone:   isCompany ? (form.companyPhone                || null) : null,
        companyAddress: isCompany ? (toCamelCase(form.companyAddress) || null) : null,
        contactName:    isCompany ? (toCamelCase(form.contactName)    || null) : null,
        categoryId:     category ? category.id : null,
      };
      const res = await api.put(`/api/seller/customers/b2b/${customer.id}`, payload);
      if (res.data?.code !== 900 && res.data?.code !== 200) {
        toast(res.data?.message || 'Lỗi khi cập nhật', 'error'); return;
      }
      toast('Cập nhật thành công', 'success');
      onSaved(res.data?.data);
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi cập nhật', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#F0EBE3] flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-[#1C1C1E] text-base">Sửa thông tin khách hàng</h3>
            <p className="text-xs text-[#8E8878] mt-0.5">#{customer.customerCode}</p>
          </div>
          <button onClick={onClose} className="text-[#8E8878] hover:text-red-400 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Mã khách hàng */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">
              Mã khách hàng <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4B9A8]" />
              <input value={form.customerCode} onChange={e => handleCodeChange(e.target.value)}
                className={`${inputCls} pl-8 uppercase font-mono
                  ${codeError ? 'border-red-400 focus:border-red-400' : ''}
                  ${!codeError && form.customerCode && form.customerCode.trim().toUpperCase() !== (customer.customerCode || '').toUpperCase()
                    ? 'border-emerald-400 focus:border-emerald-400' : ''}`}
                placeholder="VD: KH001" />
              {codeChecking && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />}
              {!codeChecking && codeError && <AlertCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400" />}
              {!codeChecking && !codeError && form.customerCode && form.customerCode.trim().toUpperCase() !== (customer.customerCode || '').toUpperCase() && (
                <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
              )}
            </div>
            {codeError && <p className="text-[10px] text-red-500 mt-1">{codeError}</p>}
            {!codeError && form.customerCode?.trim().toUpperCase() !== (customer.customerCode || '').toUpperCase() && !codeChecking && (
              <p className="text-[10px] text-emerald-600 mt-1">
                Mã sẽ đổi từ <span className="font-mono font-bold">{customer.customerCode}</span> → <span className="font-mono font-bold">{form.customerCode?.trim().toUpperCase()}</span>
              </p>
            )}
          </div>

          {/* Phân loại */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">
              Phân loại khách hàng
            </label>
            <CategoryCombobox value={category} onChange={setCategory} />
            <p className="text-[10px] text-[#C4B9A8] mt-1">Để trống nếu chưa phân loại</p>
          </div>

          {/* Loại khách */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">Loại khách hàng</label>
            <div className="flex rounded-xl border border-[#E8DDD0] overflow-hidden text-xs">
              {[['RETAIL', <UserIcon size={11} />, 'Cá nhân'], ['COMPANY', <Building2 size={11} />, 'Công ty']].map(([val, icon, label], i) => (
                <button key={val} type="button" onClick={() => set('customerType', val)}
                  className={`flex-1 py-2 font-medium transition-colors flex items-center justify-center gap-1.5
                    ${i > 0 ? 'border-l border-[#E8DDD0]' : ''}
                    ${form.customerType === val ? 'bg-[#1A2744] text-white' : 'text-[#8E8878] hover:bg-[#F0EBE3]'}`}>
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields theo loại */}
          {isCompany ? (
            <>
              <div>
                <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Tên công ty <span className="text-red-400">*</span></label>
                <input value={form.companyName} onChange={e => set('companyName', e.target.value)} className={inputCls} placeholder="Công ty TNHH ABC" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Mã số thuế</label>
                  <input value={form.taxCode} onChange={e => set('taxCode', e.target.value)} className={inputCls} placeholder="0123456789" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Người liên hệ</label>
                  <input value={form.contactName} onChange={e => set('contactName', e.target.value)} className={inputCls} placeholder="Nguyễn Văn A" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">SĐT công ty</label>
                  <input value={form.companyPhone} onChange={e => set('companyPhone', e.target.value)} className={inputCls} placeholder="0901..." />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Email</label>
                  <input value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="info@..." />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Địa chỉ</label>
                <input value={form.companyAddress} onChange={e => set('companyAddress', e.target.value)} className={inputCls} placeholder="123 Nguyễn Văn A, Q.1" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Họ tên</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Nguyễn Văn A" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Số điện thoại</label>
                  <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="0901..." />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Email</label>
                  <input value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="email@..." />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Mã số thuế</label>
                <input value={form.taxCode} onChange={e => set('taxCode', e.target.value)} className={inputCls} placeholder="0123456789 (tuỳ chọn)" />
              </div>
            </>
          )}

          {/* Loại giá */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">Loại giá</label>
            <div className="flex rounded-xl border border-[#E8DDD0] overflow-hidden text-xs">
              {[['RETAIL_PRICE', 'Bán lẻ (giá gốc)'], ['WHOLESALE_PRICE', 'Bán sỉ (khung giá)']].map(([val, label], i) => (
                <button key={val} type="button" onClick={() => set('pricingType', val)}
                  className={`flex-1 py-2 font-medium transition-colors
                    ${i > 0 ? 'border-l border-[#E8DDD0]' : ''}
                    ${form.pricingType === val ? 'bg-[#C9A84C] text-white' : 'text-[#8E8878] hover:bg-[#F0EBE3]'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Địa chỉ nhận hàng */}
          <div className="border-t border-[#F0EBE3] pt-3">
            <ReceiverInfosSection customerId={customer.id} />
          </div>

          <p className="text-[10px] text-[#B0A090] bg-[#FDF8ED] rounded-xl px-3 py-2 border border-[#C9A84C]/15">
            💡 Tên nhập IN HOA sẽ tự động chuyển thành chữ thường đúng chuẩn khi lưu.
          </p>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-[#F0EBE3] flex gap-2 shrink-0">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#5C4E3D] font-semibold hover:bg-[#F0EBE3] transition-colors">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving || !!codeError || codeChecking}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#b8973d] transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Customer Row ─────────────────────────────────────────────────────────────
function CustomerRow({ c, onEdit }) {
  const isCompany  = c.customerType === 'COMPANY';
  const isWholesale = c.pricingType === 'WHOLESALE_PRICE';

  return (
    <div className="bg-white rounded-2xl border border-[#F0EBE3] hover:border-[#C9A84C]/40 hover:shadow-sm transition-all px-4 py-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${isCompany ? 'bg-blue-500' : 'bg-[#C9A84C]'}`}>
        {isCompany ? <Building2 size={16} /> : <UserIcon size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-[#1C1C1E] truncate">
            {isCompany
              ? (c.companyName || c.name || '—')
              : (c.name || c.contactName || <span className="text-[#C4B9A8] italic font-normal">Khách vãng lai</span>)}
          </p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${isCompany ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
            {isCompany ? 'Cty' : 'CN'}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${isWholesale ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
            {isWholesale ? 'Giá Sỉ' : 'Giá Lẻ'}
          </span>
          {c.createdByAdmin && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100">Admin</span>}
          {c.discountRate > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">-{c.discountRate}%</span>}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {c.customerCode && <span className="text-[11px] text-[#8E8878]">#{c.customerCode}</span>}
          {c.phone && <span className="flex items-center gap-1 text-[11px] text-[#8E8878]"><Phone size={10} />{c.phone}</span>}
          {c.email && <span className="flex items-center gap-1 text-[11px] text-[#8E8878] truncate max-w-[140px]"><Mail size={10} />{c.email}</span>}
          {isCompany && c.contactName && <span className="text-[11px] text-[#8E8878]">Liên hệ: {c.contactName}</span>}
        </div>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        {c.createdByAdmin
          ? <p className="text-[11px] text-sky-500 font-medium">Admin/Owner</p>
          : c.createdBySellerName ? <p className="text-[11px] text-[#8E8878]">{c.createdBySellerName}</p>
          : null}
        <p className="text-[10px] text-[#C4B9A8]">{formatDate(c.createdAt)}</p>
      </div>
      <button onClick={() => onEdit(c)}
        className="w-8 h-8 rounded-xl border border-[#E8DDD0] flex items-center justify-center text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] hover:bg-[#FDF8ED] transition-colors shrink-0">
        <Edit2 size={13} />
      </button>
    </div>
  );
}

// ─── Category Accordion Section ───────────────────────────────────────────────
function CategorySection({ label, color, customers, defaultOpen, onEdit }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-[#F0EBE3] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-[#FDF8ED] transition-colors"
      >
        {color ? (
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
        ) : (
          <Tag size={13} className="text-[#C4B9A8] shrink-0" />
        )}
        <span className="font-semibold text-sm text-[#1C1C1E] flex-1 text-left">{label}</span>
        <span className="text-[11px] text-[#8E8878] font-medium">{customers.length} khách</span>
        {open
          ? <ChevronDown size={15} className="text-[#8E8878] shrink-0" />
          : <ChevronRight size={15} className="text-[#8E8878] shrink-0" />}
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-[#F0EBE3] p-3 space-y-2 bg-[#FAFAF8]">
          {customers.map(c => (
            <CustomerRow key={c.id} c={c} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SellerCustomersPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isSuperSeller = user?.roles?.includes('SUPER_SELLER') || user?.role === 'SUPER_SELLER';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const PAGE_SIZE = 200;

  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const [editTarget, setEditTarget]   = useState(null);
  const [importing, setImporting]     = useState(false);
  const [exportingTemplate, setExportingTemplate] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (typeFilter) params.set('type', typeFilter);
      params.set('page', p);
      params.set('size', PAGE_SIZE);
      const res = await api.get(`/api/seller/customers/b2b?${params}`);
      const body = res.data?.data || res.data;
      setCustomers(body?.content || []);
      setTotal(body?.totalItems || 0);
      setPage(p);
    } catch { toast('Không thể tải danh sách khách hàng', 'error'); }
    finally { setLoading(false); }
  }, [debouncedSearch, typeFilter, toast]);

  useEffect(() => { load(0); }, [debouncedSearch, typeFilter]);

  // Nhóm khách theo category
  const grouped = (() => {
    const map = new Map(); // key = categoryId (null → "Chưa phân loại")
    for (const c of customers) {
      const key = c.categoryId ?? '__none__';
      if (!map.has(key)) map.set(key, { label: c.categoryName || 'Chưa phân loại', color: c.categoryColor || null, items: [] });
      map.get(key).items.push(c);
    }
    // Sắp xếp: có category trước (theo tên), "Chưa phân loại" cuối
    const entries = [...map.entries()];
    entries.sort(([ka, a], [kb, b]) => {
      if (ka === '__none__') return 1;
      if (kb === '__none__') return -1;
      return a.label.localeCompare(b.label, 'vi');
    });
    return entries;
  })();

  const handleDownloadTemplate = async () => {
    setExportingTemplate(true);
    try {
      const res = await api.get('/api/seller/customers/import-template', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = 'customer-import-template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast('Không thể tải template', 'error'); }
    finally { setExportingTemplate(false); }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/api/seller/customers/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `customers-export-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast('Không thể xuất danh sách', 'error'); }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    setImporting(true);
    try {
      const formData = new FormData(); formData.append('file', file);
      const res = await api.post('/api/seller/customers/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data = res.data?.data;
      toast(data ? `Import thành công: ${data.imported || 0} mới, bỏ qua: ${data.skipped || 0}` : 'Import thành công', 'success');
      load(0);
    } catch (err) { toast(err?.response?.data?.message || 'Lỗi khi import', 'error'); }
    finally { setImporting(false); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />

      {/* Header */}
      <div className="bg-white border-b border-[#F0EBE3] px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FDF8ED] border border-[#C9A84C]/20 flex items-center justify-center">
              <Users size={16} className="text-[#C9A84C]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#1C1C1E]">Khách hàng</h1>
              <p className="text-[11px] text-[#8E8878]">{isSuperSeller ? 'Tất cả' : 'Khách của tôi'} · {total} khách</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleDownloadTemplate} disabled={exportingTemplate} title="Tải template"
              className="w-9 h-9 rounded-xl border border-[#E8DDD0] flex items-center justify-center text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
              <FileSpreadsheet size={15} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} title="Import"
              className="w-9 h-9 rounded-xl border border-[#E8DDD0] flex items-center justify-center text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
              {importing ? <div className="w-3.5 h-3.5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /> : <Upload size={15} />}
            </button>
            <button onClick={handleExport} title="Xuất"
              className="w-9 h-9 rounded-xl border border-[#E8DDD0] flex items-center justify-center text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
              <Download size={15} />
            </button>
            <button onClick={() => load(page)} disabled={loading}
              className="w-9 h-9 rounded-xl border border-[#E8DDD0] flex items-center justify-center text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4B9A8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, SĐT, mã, MST..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E8DDD0] text-sm text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C] transition-colors bg-[#FAFAF8] placeholder:text-[#C4B9A8]" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4B9A8] hover:text-red-400"><X size={13} /></button>}
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="rounded-xl border border-[#E8DDD0] px-3 py-2 text-sm text-[#5C4E3D] focus:outline-none focus:border-[#C9A84C] bg-white">
            <option value="">Tất cả</option>
            <option value="RETAIL">Cá nhân</option>
            <option value="COMPANY">Công ty</option>
          </select>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {!isSuperSeller && (
          <div className="mb-4 px-4 py-3 bg-sky-50 rounded-xl border border-sky-100 flex items-start gap-2">
            <AlertCircle size={14} className="text-sky-500 mt-0.5 shrink-0" />
            <p className="text-xs text-sky-700">Hiển thị: khách cá nhân (tất cả), khách công ty được gán cho bạn, và khách do admin tạo.</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-[#F0EBE3] p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F0EBE3] animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 bg-[#F0EBE3] rounded animate-pulse" />
                  <div className="h-3 w-28 bg-[#F0EBE3] rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F0EBE3] flex items-center justify-center mb-3">
              <Users size={24} className="text-[#C4B9A8]" strokeWidth={1.5} />
            </div>
            <p className="font-semibold text-[#5C4E3D]">Không tìm thấy khách hàng</p>
            {search && <p className="text-sm text-[#8E8878] mt-1">Thử tìm với từ khóa khác</p>}
          </div>
        ) : (
          <>
            {/* Khi đang search → hiển thị flat (không accordion) */}
            {search ? (
              <div className="space-y-2">
                {customers.map(c => <CustomerRow key={c.id} c={c} onEdit={setEditTarget} />)}
              </div>
            ) : (
              /* Accordion phân nhóm theo category */
              <div className="space-y-3">
                {grouped.map(([key, { label, color, items }], idx) => (
                  <CategorySection
                    key={key}
                    label={label}
                    color={color}
                    customers={items}
                    defaultOpen={idx === 0}  // mặc định expand nhóm đầu tiên
                    onEdit={setEditTarget}
                  />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-5">
                <button onClick={() => load(page - 1)} disabled={page === 0 || loading}
                  className="px-3 py-1.5 rounded-lg border border-[#E8DDD0] text-xs text-[#5C4E3D] font-semibold disabled:opacity-40 hover:bg-[#F0EBE3] transition-colors">
                  ← Trước
                </button>
                <span className="text-xs text-[#8E8878]">{page + 1} / {totalPages}</span>
                <button onClick={() => load(page + 1)} disabled={page >= totalPages - 1 || loading}
                  className="px-3 py-1.5 rounded-lg border border-[#E8DDD0] text-xs text-[#5C4E3D] font-semibold disabled:opacity-40 hover:bg-[#F0EBE3] transition-colors">
                  Sau →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <EditCustomerModal
        open={!!editTarget}
        customer={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={(updated) => {
          if (updated) setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
          else load(page);
        }}
      />
    </div>
  );
}