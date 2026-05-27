// src/pages/admin/AdminCustomers.jsx
// FIX #9:
// - Khách lẻ: không hiển thị nút gán NV, cột NV KD bỏ trống
// - Khách công ty: hiển thị nút gán, nếu chưa có NV → "Chưa có"
// - Lọc theo NV KD: input search thay vì render hết buttons
import { useEffect, useState, useCallback, useRef } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  Users, Search, Percent, Lock, Unlock,
  Building2, User as UserIcon, CalendarDays, UserPlus, X, ChevronDown, Download, Upload,
} from 'lucide-react';
import { adminCustomerApi } from '../../api/adminApi';
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

function getDebtUrgency(customer) {
  const ms = customer.nearestDeadlineMillis;
  if (!ms) return null;
  const days = Math.ceil((ms - Date.now()) / 86400000);
  if (days < 0 || days <= 3) return 'critical';
  if (days <= 6)              return 'warning';
  return null;
}

// ── Assign Seller Modal ──────────────────────────────────────────────────────
function AssignSellerModal({ open, customer, onClose, onSaved }) {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 350);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useMinLoading();
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setSellers([]);
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
    try {
      await adminCustomerApi.assignSeller(customer.id, sellerId);
      onSaved();
    } catch(e) {
      alert(e?.response?.data?.message || 'Lỗi khi gán seller');
    } finally { setSaving(false); }
  };

  const unassign = async () => {
    setSaving(true);
    try {
      await adminCustomerApi.assignSeller(customer.id, null);
      onSaved();
    } catch(e) {
      alert(e?.response?.data?.message || 'Lỗi khi bỏ gán');
    } finally { setSaving(false); }
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

// ── FIX #9: Seller Filter Dropdown ───────────────────────────────────────────
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

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (seller) => {
    onChange(String(seller.id));
    setSelectedName(seller.fullName);
    setOpen(false);
    setQ('');
  };

  const clear = () => {
    onChange('');
    setSelectedName('');
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors min-w-[180px]
          ${value && value !== '0' ? 'border-[#C9A84C] bg-[#C9A84C]/5 text-[#C9A84C]' : 'border-[#E8DDD0] text-[#8E8878]'}`}
      >
        <Search size={13} />
        <span className="flex-1 text-left truncate text-sm">
          {value === '0' ? 'Chưa gán' : (selectedName || 'Lọc theo NV KD...')}
        </span>
        {value ? (
          <button onClick={(e) => { e.stopPropagation(); clear(); }}
            className="text-[#8E8878] hover:text-red-400 shrink-0">
            <X size={13} />
          </button>
        ) : (
          <ChevronDown size={13} className="shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-white rounded-xl border border-black/10 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#F0EBE3]">
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Tìm nhân viên..."
              className="w-full text-sm px-3 py-1.5 rounded-lg border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            <button
              onClick={() => { onChange('0'); setSelectedName('Chưa gán'); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-[#FAF7F2] text-[#5C4E3D]">
              Chưa gán NV
            </button>
            {loading ? (
              <p className="text-xs text-center text-[#8E8878] py-3">Đang tìm...</p>
            ) : sellers.map(s => (
              <button key={s.id}
                onClick={() => select(s)}
                className={`w-full px-3 py-2 text-left hover:bg-[#FAF7F2] transition-colors
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

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminCustomers() {
  const [filters,     setFilters]    = useState({ q: '', type: '', isActive: '', sellerId: '' });
  const debouncedQ  = useDebounce(filters.q, 600);
  const [page,        setPage]       = useState(0);
  const [data,        setData]       = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useMinLoading();
  const [selectedIds, setSelectedIds]= useState(new Set());
  const [historyCustomerId, setHistoryCustomerId] = useState(null);

  const [discountOpen,   setDiscountOpen]   = useState(false);
  const [discountTarget, setDiscountTarget] = useState(null);
  const [discountValue,  setDiscountValue]  = useState(0);
  const [saving,         setSaving]         = useState(false);
  const [activeConfirm,  setActiveConfirm]  = useState(null);

  const [debtDaysOpen,   setDebtDaysOpen]   = useState(false);
  const [debtDaysTarget, setDebtDaysTarget] = useState(null);
  const [debtDaysValue,  setDebtDaysValue]  = useState(0);

  // Tạo / sửa khách hàng (admin)
  const [createOpen,    setCreateOpen]   = useState(false);
  const [editCustomer,  setEditCustomer] = useState(null);

  const [assignOpen,   setAssignOpen]   = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: 20, sort: 'id,desc' };
      if (debouncedQ)             params.q        = debouncedQ;
      if (filters.type)           params.type     = filters.type;
      if (filters.isActive !== '') params.isActive = filters.isActive;
      if (filters.sellerId !== '') params.sellerId = filters.sellerId;
      const res = await adminCustomerApi.list(params);
      setData(res);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, debouncedQ, filters.type, filters.isActive, filters.sellerId]);

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
  const toggleOne  = (id) => { const n = new Set(selectedIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedIds(n); };
  const toggleAll  = () => { allChecked ? setSelectedIds(new Set()) : setSelectedIds(new Set(data.content.map(c => c.id))); };

  const openDiscountSingle = (c) => { setDiscountTarget(c); setDiscountValue(c.discountRate || 0); setDiscountOpen(true); };
  const openDiscountBulk   = () => { if (!anyChecked) return; setDiscountTarget(null); setDiscountValue(0); setDiscountOpen(true); };

  const openDebtDays = (c, e) => { e.stopPropagation(); setDebtDaysTarget(c); setDebtDaysValue(c.debtDays || 0); setDebtDaysOpen(true); };

  // FIX #9: Chỉ mở assign modal cho khách COMPANY
  const openAssign = (c, e) => {
    e.stopPropagation();
    if (c.customerType !== 'COMPANY') return; // Khách lẻ không gán
    setAssignTarget(c);
    setAssignOpen(true);
  };

  const saveDiscount = async () => {
    setSaving(true);
    try {
      if (discountTarget) await adminCustomerApi.updateDiscount(discountTarget.id, Number(discountValue));
      else { await adminCustomerApi.bulkDiscount([...selectedIds], Number(discountValue)); setSelectedIds(new Set()); }
      setDiscountOpen(false); load();
    } catch(e) { alert(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  const saveDebtDays = async () => {
    const days = Number(debtDaysValue);
    if (isNaN(days) || days < 0 || days > 365) { alert('Số ngày phải từ 0 đến 365'); return; }
    setSaving(true);
    try {
      await adminCustomerApi.updateDebtDays(debtDaysTarget.id, days);
      setDebtDaysOpen(false); load();
    } catch(e) { alert(e?.response?.data?.message || e.message); }
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
    } catch(e) { alert(e?.response?.data?.message || e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader icon={Users} title="Khách hàng" subtitle={`Tổng ${formatNumber(data.totalElements)} khách`} />
        {/* Buttons: Tạo khách hàng + Import/Export */}
        <div className="flex items-center gap-2">
          <PrimaryButton onClick={() => { setEditCustomer(null); setCreateOpen(true); }}
            className="flex items-center gap-1.5 text-xs px-3 py-2">
            <UserPlus size={13} /> Tạo khách hàng
          </PrimaryButton>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] text-xs text-[#5C5C5C] hover:border-[#C9A84C] cursor-pointer transition-all">
            <Upload size={13} /> Import
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => {
              if (e.target.files[0]) alert('Chức năng Import sẽ được xử lý ở backend');
            }} />
          </label>
          <button onClick={() => alert('Chức năng Export sẽ được xử lý ở backend')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] text-xs text-[#5C5C5C] hover:border-[#C9A84C] transition-all">
            <Download size={13} /> Export
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
            <option value="COMPANY">Doanh nghiệp</option>
            <option value="RETAIL">Khách lẻ</option>
          </select>
          <select value={filters.isActive}
            onChange={e => { setFilters({ ...filters, isActive: e.target.value }); setPage(0); }}
            className={`${inputCls} sm:w-40`}>
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã khóa bán</option>
          </select>
        </div>

        {/* FIX #9: Seller filter — dùng input search thay vì render hết buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-[#8E8878] font-medium shrink-0">Lọc theo NV KD:</span>
          <button
            onClick={() => { setFilters(f => ({ ...f, sellerId: '' })); setPage(0); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border
              ${filters.sellerId === ''
                ? 'bg-[#C9A84C] text-white border-[#C9A84C]'
                : 'border-[#E8DDD0] text-[#5C4E3D] hover:bg-[#F0EBE3]'}`}>
            Tất cả
          </button>
          {/* FIX #9: Dropdown search thay vì render từng button */}
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
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Liên hệ</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Loại</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">NV Kinh doanh</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Chiết khấu</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Công nợ</th>
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
                        <td className="px-4 py-3"><p className="text-[#1C1C1E]">{c.phone}</p></td>
                        <td className="px-4 py-3">
                          <Badge className={isCompany ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}>
                            {isCompany ? 'Doanh nghiệp' : 'Khách lẻ'}
                          </Badge>
                          {c.pricingType === 'WHOLESALE_PRICE'
                            ? <Badge className="bg-purple-50 text-purple-700 ring-purple-200 mt-0.5">Sỉ</Badge>
                            : <Badge className="bg-green-50 text-green-700 ring-green-200 mt-0.5">Lẻ</Badge>
                          }
                          {c.createdByAdmin && (
                            <Badge className="bg-sky-50 text-sky-700 ring-sky-200 mt-0.5">Admin</Badge>
                          )}
                        </td>
                        {/* FIX #9: Cột NV KD — khách lẻ bỏ trống, công ty hiển thị hoặc "Chưa có" */}
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
                            // FIX #9: Khách lẻ → bỏ trống NV KD
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
                        <td className="px-4 py-3 text-center">
                          {c.isActive
                            ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Hoạt động</Badge>
                            : <Badge className="bg-red-50 text-red-700 ring-red-200">Đã khóa</Badge>
                          }
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {/* FIX #9: Chỉ hiện nút gán NV cho khách COMPANY */}
                            {isCompany && (
                              <button onClick={e => openAssign(c, e)}
                                className="p-2 rounded-lg text-[#8E8878] hover:bg-sky-50 hover:text-sky-600 transition-colors"
                                title="Gán NV Kinh doanh">
                                <UserPlus size={15} />
                              </button>
                            )}
                            <button onClick={() => openDiscountSingle(c)}
                              className="p-2 rounded-lg text-[#8E8878] hover:bg-[#C9A84C]/10 hover:text-[#C9A84C] transition-colors"
                              title="Chiết khấu">
                              <Percent size={15} />
                            </button>
                            <button onClick={e => openDebtDays(c, e)}
                              className="p-2 rounded-lg text-[#8E8878] hover:bg-orange-50 hover:text-orange-500 transition-colors"
                              title="Số ngày công nợ">
                              <CalendarDays size={15} />
                            </button>
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
                        {/* FIX #9: Chỉ hiển thị NV KD cho khách công ty */}
                        {isCompany && (
                          c.sellerName
                            ? <p className="text-[10px] text-sky-600 mt-0.5">👤 {c.sellerName}</p>
                            : <p className="text-[10px] text-[#C4B9A8] italic mt-0.5">Chưa có NV</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                      {/* FIX #9: Chỉ nút gán cho công ty */}
                      {isCompany && (
                        <button onClick={e => openAssign(c, e)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-sky-50 text-sky-600">Gán NV</button>
                      )}
                      <button onClick={() => openDiscountSingle(c)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#FAF7F2] text-[#1C1C1E]">Chiết khấu</button>
                      <button onClick={e => openDebtDays(c, e)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-orange-50 text-orange-600">Công nợ</button>
                      <button onClick={() => setActiveConfirm({ mode: 'single', lock: c.isActive, customer: c })}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium ${c.isActive ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {c.isActive ? 'Khóa' : 'Mở'}
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

      {/* Assign Seller modal — FIX #9: chỉ dùng cho COMPANY */}
      <AssignSellerModal
        open={assignOpen}
        customer={assignTarget}
        onClose={() => setAssignOpen(false)}
        onSaved={() => { setAssignOpen(false); load(); }} />

      {/* Discount modal */}
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

      {/* Debt days modal */}
      <Modal open={debtDaysOpen} onClose={() => !saving && setDebtDaysOpen(false)}
        title="Số ngày công nợ" size="sm"
        footer={<div className="flex justify-end gap-2"><SecondaryButton onClick={() => setDebtDaysOpen(false)} disabled={saving}>Hủy</SecondaryButton><PrimaryButton onClick={saveDebtDays} loading={saving}>Áp dụng</PrimaryButton></div>}>
        {debtDaysTarget && <p className="text-sm text-[#1C1C1E] mb-3">Khách: <span className="font-semibold">{debtDaysTarget.customerType === 'COMPANY' ? debtDaysTarget.companyName : debtDaysTarget.name}</span></p>}
        <Field label="Số ngày được phép công nợ" required>
          <input type="number" min={0} max={365} value={debtDaysValue} onChange={e => setDebtDaysValue(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
        <p className="text-xs text-[#8E8878] mt-1.5">Từ 1–365 ngày. Đặt 0 để tắt công nợ.</p>
      </Modal>

      {/* Lock/Unlock confirm */}
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

      {/* Modal tạo / sửa khách hàng */}
      <CreateEditCustomerModal
        open={createOpen}
        customer={editCustomer}
        onClose={() => { setCreateOpen(false); setEditCustomer(null); }}
        onSaved={() => { setCreateOpen(false); setEditCustomer(null); load(); }}
      />
    </div>
  );
}

// ─── Create / Edit Customer Modal ────────────────────────────────────────────
function CreateEditCustomerModal({ open, customer, onClose, onSaved }) {
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
        name: form.name || null,
        phone: form.phone || null,
        email: form.email || null,        // nullable
        customerType: form.customerType,
        pricingType: form.pricingType,
        discountRate: Number(form.discountRate) || 0,
        debtDays: Number(form.debtDays) || 0,
        companyName: isCompany ? form.companyName : null,
        taxCode: isCompany ? form.taxCode : null,
        companyPhone: isCompany ? form.companyPhone : null,
        companyAddress: isCompany ? form.companyAddress : null,
        contactName: isCompany ? form.contactName : null,
      };
      if (isEdit) {
        await adminCustomerApi.update(customer.id, payload);
      } else {
        await adminCustomerApi.create(payload);
      }
      onSaved();
    } catch (e) {
      alert(e?.response?.data?.message || e.message || 'Lỗi lưu khách hàng');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={isEdit ? 'Sửa thông tin khách hàng' : 'Tạo khách hàng mới'}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose} disabled={saving}>Hủy</SecondaryButton>
          <PrimaryButton onClick={handleSave} loading={saving}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo khách hàng'}
          </PrimaryButton>
        </div>
      }>
      <div className="space-y-4">

        {/* Loại khách */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Loại khách hàng">
            <select value={form.customerType} onChange={e => set('customerType', e.target.value)} className={inputCls}>
              <option value="RETAIL">Cá nhân / Lẻ</option>
              <option value="COMPANY">Doanh nghiệp</option>
            </select>
          </Field>
          <Field label="Loại giá áp dụng">
            <select value={form.pricingType} onChange={e => set('pricingType', e.target.value)} className={inputCls}>
              <option value="RETAIL_PRICE">Bán lẻ (giá gốc)</option>
              <option value="WHOLESALE_PRICE">Bán sỉ (khung giá)</option>
            </select>
          </Field>
        </div>

        {/* Thông tin cơ bản */}
        {isCompany ? (
          <>
            <Field label="Tên công ty" required>
              <input value={form.companyName} onChange={e => set('companyName', e.target.value)} className={inputCls} placeholder="Công ty TNHH..." />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mã số thuế">
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

        <p className="text-xs text-[#8E8878] bg-[#FDF8ED] rounded-xl px-3 py-2 border border-[#C9A84C]/20">
          💡 Khách do admin/owner tạo: ai cũng có thể tạo đơn, KPI tính chung cho toàn phòng SALE.
        </p>
      </div>
    </Modal>
  );
}
