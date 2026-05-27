// src/pages/seller/SellerCustomersPage.jsx
// Quản lý khách hàng cho SELLER và SUPER_SELLER
// SELLER: thấy khách lẻ (mọi người) + khách COMPANY được assign cho mình + khách admin tạo
// SUPER_SELLER: thấy tất cả
import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import {
  Users, Search, X, RefreshCw, Building2, User as UserIcon,
  Phone, Mail, MapPin, Edit2, ChevronDown, ChevronUp,
  Filter, Plus, Check, AlertCircle,
} from 'lucide-react';

const inputCls = 'w-full rounded-xl border border-[#E8DDD0] px-3 py-2 text-sm text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C] transition-colors bg-[#FAFAF8] placeholder:text-[#C4B9A8]';

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

// ─── Edit Customer Modal ──────────────────────────────────────────────────────
function EditCustomerModal({ open, customer, onClose, onSaved }) {
  const toast = useToast();
  const isCompany = customer?.customerType === 'COMPANY';
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      companyName: customer.companyName || '',
      taxCode: customer.taxCode || '',
      companyPhone: customer.companyPhone || '',
      companyAddress: customer.companyAddress || '',
      contactName: customer.contactName || '',
      discountRate: customer.discountRate ?? 0,
    });
  }, [open, customer]);

  if (!open || !customer) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name || null,
        phone: form.phone || null,
        email: form.email || null,
        discountRate: Number(form.discountRate) || 0,
        ...(isCompany ? {
          companyName: form.companyName,
          taxCode: form.taxCode,
          companyPhone: form.companyPhone,
          companyAddress: form.companyAddress,
          contactName: form.contactName,
        } : {}),
      };
      await api.put(`/api/seller/customers/b2b/${customer.id}`, payload);
      toast('Cập nhật thành công', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi cập nhật', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#F0EBE3] flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-[#1C1C1E] text-base">Sửa thông tin khách hàng</h3>
            <p className="text-xs text-[#8E8878] mt-0.5">{isCompany ? 'Khách doanh nghiệp' : 'Khách lẻ / cá nhân'}</p>
          </div>
          <button onClick={onClose} className="text-[#8E8878] hover:text-red-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isCompany ? (<>
            <div>
              <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Tên công ty</label>
              <input value={form.companyName} onChange={e => set('companyName', e.target.value)} className={inputCls} placeholder="Công ty TNHH..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Mã số thuế</label>
                <input value={form.taxCode} onChange={e => set('taxCode', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Người liên hệ</label>
                <input value={form.contactName} onChange={e => set('contactName', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">SĐT công ty</label>
                <input value={form.companyPhone} onChange={e => set('companyPhone', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Email</label>
                <input value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Địa chỉ</label>
              <input value={form.companyAddress} onChange={e => set('companyAddress', e.target.value)} className={inputCls} />
            </div>
          </>) : (<>
            <div>
              <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Họ tên</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Số điện thoại</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Email</label>
                <input value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
              </div>
            </div>
          </>)}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1">Chiết khấu (%)</label>
            <input type="number" min={0} max={100} value={form.discountRate} onChange={e => set('discountRate', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-[#F0EBE3] flex gap-2 shrink-0">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#5C4E3D] font-semibold hover:bg-[#F0EBE3] transition-colors">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#b8973d] transition-colors flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Customer row ─────────────────────────────────────────────────────────────
function CustomerRow({ c, onEdit }) {
  const isCompany = c.customerType === 'COMPANY';
  const isWholesale = c.pricingType === 'WHOLESALE_PRICE';

  return (
    <div className="bg-white rounded-2xl border border-[#F0EBE3] hover:border-[#C9A84C]/40 hover:shadow-sm transition-all px-4 py-3 flex items-center gap-3">
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${isCompany ? 'bg-blue-500' : 'bg-[#C9A84C]'}`}>
        {isCompany ? <Building2 size={16} /> : <UserIcon size={16} />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-[#1C1C1E] truncate">
            {isCompany ? (c.companyName || c.name) : (c.name || c.contactName || '—')}
          </p>
          {/* Badges */}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${isCompany ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
            {isCompany ? 'DN' : 'Lẻ'}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${isWholesale ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
            {isWholesale ? 'Sỉ' : 'Lẻ giá'}
          </span>
          {c.createdByAdmin && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100">Admin</span>
          )}
          {c.discountRate > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">-{c.discountRate}%</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {c.customerCode && <span className="text-[11px] text-[#8E8878]">#{c.customerCode}</span>}
          {c.phone && (
            <span className="flex items-center gap-1 text-[11px] text-[#8E8878]">
              <Phone size={10} />{c.phone}
            </span>
          )}
          {c.email && (
            <span className="flex items-center gap-1 text-[11px] text-[#8E8878] truncate max-w-[140px]">
              <Mail size={10} />{c.email}
            </span>
          )}
          {isCompany && c.contactName && (
            <span className="text-[11px] text-[#8E8878]">Liên hệ: {c.contactName}</span>
          )}
        </div>
      </div>

      {/* Created by */}
      <div className="text-right shrink-0 hidden sm:block">
        {c.createdBySellerName && !c.createdByAdmin && (
          <p className="text-[11px] text-[#8E8878]">{c.createdBySellerName}</p>
        )}
        <p className="text-[10px] text-[#C4B9A8]">{formatDate(c.createdAt)}</p>
      </div>

      {/* Edit */}
      <button onClick={() => onEdit(c)}
        className="w-8 h-8 rounded-xl border border-[#E8DDD0] flex items-center justify-center text-[#8E8878] hover:border-[#C9A84C] hover:text-[#C9A84C] hover:bg-[#FDF8ED] transition-colors shrink-0">
        <Edit2 size={13} />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SellerCustomersPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isSuperSeller = user?.roles?.includes('SUPER_SELLER') || user?.role === 'SUPER_SELLER';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // '' | 'RETAIL' | 'COMPANY'
  const debouncedSearch = useDebounce(search, 400);

  const [editTarget, setEditTarget] = useState(null);

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
    } catch {
      toast('Không thể tải danh sách khách hàng', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, toast]);

  useEffect(() => { load(0); }, [debouncedSearch, typeFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="bg-white border-b border-[#F0EBE3] px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FDF8ED] border border-[#C9A84C]/20 flex items-center justify-center">
              <Users size={16} className="text-[#C9A84C]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#1C1C1E]">Khách hàng</h1>
              <p className="text-[11px] text-[#8E8878]">
                {isSuperSeller ? 'Tất cả khách hàng' : 'Khách của tôi'} · {total} khách
              </p>
            </div>
          </div>
          <button onClick={() => load(page)} disabled={loading}
            className="w-9 h-9 rounded-xl border border-[#E8DDD0] flex items-center justify-center text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C4B9A8]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên, SĐT, mã, MST..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E8DDD0] text-sm text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C] transition-colors bg-[#FAFAF8] placeholder:text-[#C4B9A8]" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C4B9A8] hover:text-red-400">
                <X size={13} />
              </button>
            )}
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="rounded-xl border border-[#E8DDD0] px-3 py-2 text-sm text-[#5C4E3D] focus:outline-none focus:border-[#C9A84C] bg-white">
            <option value="">Tất cả</option>
            <option value="RETAIL">Khách lẻ</option>
            <option value="COMPANY">Doanh nghiệp</option>
          </select>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Info note */}
        {!isSuperSeller && (
          <div className="mb-4 px-4 py-3 bg-sky-50 rounded-xl border border-sky-100 flex items-start gap-2">
            <AlertCircle size={14} className="text-sky-500 mt-0.5 shrink-0" />
            <p className="text-xs text-sky-700">
              Hiển thị: khách lẻ (tất cả), khách doanh nghiệp được gán cho bạn, và khách do admin tạo.
            </p>
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
            <div className="space-y-2">
              {customers.map(c => (
                <CustomerRow key={c.id} c={c} onEdit={setEditTarget} />
              ))}
            </div>

            {/* Pagination */}
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
        onSaved={() => load(page)}
      />
    </div>
  );
}