// src/pages/shared/SupplierManagementShared.jsx
//
// Trang "Quản lý nhà cung cấp" (Owner/Admin — chỉ xem).
//  1) Danh sách NCC: group theo danh mục (vendorType), collapse/expand,
//     filter theo danh mục. Badge số ngày công nợ lâu nhất.
//  2) Click NCC → trang chi tiết: thông tin NCC + lịch sử đặt hàng.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2, ChevronLeft, ChevronDown, ChevronRight, Search, Phone, User, MapPin, Hash,
  Wallet, Clock, ArrowUpDown, TrendingUp, TrendingDown, Minus, Package,
  Receipt, X, BarChart3, Calendar, Layers, Plus, Pencil, Trash2, Tag, Check,
  Download, Upload,
} from 'lucide-react';
import {
  PageHeader, EmptyState, formatCurrency, formatDate,
} from '../../components/ui';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Field, inputCls, PrimaryButton, SecondaryButton } from '../../components/ui';
import { ownerSupplierApi } from '../../api/materialRequestApi.js';
import { useToast } from '../../components/common/Toast.jsx';
import { VENDOR_TYPE_LABELS } from '../accountant/ExpenseCreateModal.jsx';

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════
const money = (v) => formatCurrency(v);
const qtyFmt = (v) =>
  v == null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(Number(v));

function debtBadgeColor(days) {
  if (days == null) return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  if (days >= 30) return 'bg-red-50 text-red-600 border-red-200';
  if (days >= 14) return 'bg-orange-50 text-orange-600 border-orange-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

const SETTLE_CFG = {
  NONE: { label: 'Chưa thanh toán', cls: 'bg-red-50 text-red-600 border-red-200' },
  PARTIAL: { label: 'Đã trả 1 phần', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  SETTLED: { label: 'Đã trả hết', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const PAY_CFG = {
  PAID: { label: 'Đã thanh toán', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DEBT: { label: 'Công nợ', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  UNSET: { label: 'Chưa xử lý', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

// ══════════════════════════════════════════════════════════════════════════
// 1) DANH SÁCH NCC — group theo danh mục, collapse/expand, filter
// ══════════════════════════════════════════════════════════════════════════
function SupplierListPage({ basePath, dashboardPath, analysisPath, canManageCatalog = false }) {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('debt');
  const [expandedId, setExpandedId] = useState(null);

  // Filter theo danh mục
  const [typeFilter, setTypeFilter] = useState(''); // '' = tất cả
  // Collapse state per category
  const [collapsed, setCollapsed] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ownerSupplierApi.list({ search: search.trim() || undefined, sortBy });
      setSuppliers(data || []);
    } finally { setLoading(false); }
  }, [search, sortBy]);

  const listToast = useToast();
  const handleDeleteSupplier = useCallback(async (v) => {
    if (!window.confirm(`Xóa nhà cung cấp "${v.vendorName}"?\n\nNCC sẽ bị ẩn khỏi danh sách. Lịch sử phiếu/công nợ vẫn được giữ. Bạn có thể tạo lại NCC trùng tên sau này.`)) return;
    try {
      await ownerSupplierApi.deleteVendor(v.vendorId);
      listToast('Đã xóa nhà cung cấp', 'success');
      load();
    } catch (e) {
      listToast(e?.response?.data?.message || 'Không xóa được nhà cung cấp', 'error');
    }
  }, [listToast, load]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // ── Export / Import Excel ─────────────────────────────────────────────────
  const importInputRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await ownerSupplierApi.exportSuppliers(search.trim() || undefined);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      a.download = `danh-sach-nha-cung-cap-${dd}${mm}${now.getFullYear()}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      listToast('Đã xuất file nhà cung cấp', 'success');
    } catch (e) {
      listToast(e?.response?.data?.message || 'Lỗi xuất file', 'error');
    } finally { setExporting(false); }
  }, [search, listToast]);

  const handleImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset để chọn lại cùng file được
    if (!file) return;
    setImporting(true);
    try {
      const res = await ownerSupplierApi.importSuppliers(file);
      // res = ApiResponse { success, message, data:{updated,skipped,errors} }
      const data = res?.data || {};
      if (!res?.success) {
        listToast(res?.message || 'Import thất bại', 'error');
      } else {
        listToast(res?.message || `Cập nhật ${data.updated || 0} NCC`, data.skipped ? 'warning' : 'success');
        if (data.errors?.length) console.warn('Import lỗi:', data.errors);
      }
      load();
    } catch (err) {
      listToast(err?.response?.data?.message || 'Lỗi import file', 'error');
    } finally { setImporting(false); }
  }, [listToast, load]);

  // Lọc theo danh mục
  const filtered = useMemo(() => {
    if (!typeFilter) return suppliers;
    return suppliers.filter(v => v.vendorType === typeFilter);
  }, [suppliers, typeFilter]);

  // Group theo vendorType
  const grouped = useMemo(() => {
    const map = new Map();
    for (const v of filtered) {
      const type = v.vendorType || 'OTHER';
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(v);
    }
    return map;
  }, [filtered]);

  // Danh sách các loại có trong data (để render filter pills)
  const availableTypes = useMemo(() => {
    const types = new Set();
    for (const v of suppliers) types.add(v.vendorType || 'OTHER');
    return [...types];
  }, [suppliers]);

  // Khi search, auto-expand tất cả
  const effectiveCollapsed = useMemo(() => {
    if (search.trim()) {
      const result = {};
      for (const type of grouped.keys()) result[type] = false;
      return result;
    }
    return collapsed;
  }, [search, collapsed, grouped]);

  const toggleCat = (type) => setCollapsed(c => ({ ...c, [type]: !c[type] }));

  const totalDebt = suppliers.reduce((s, v) => s + Number(v.totalDebt || 0), 0);
  const withDebt = suppliers.filter(v => Number(v.totalDebt || 0) > 0).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {dashboardPath && (
        <button onClick={() => navigate(dashboardPath)}
          className="flex items-center gap-1.5 text-sm text-[#8E8878] hover:text-[#1C1C1E] font-medium">
          <ChevronLeft size={16} /> Quay lại sản xuất
        </button>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader icon={Building2} title="Quản lý nhà cung cấp"
          subtitle={`${suppliers.length} nhà cung cấp · ${withDebt} đang có công nợ`} />

        <div className="flex items-center gap-2 flex-wrap self-start">
          {canManageCatalog && (
            <>
              <input ref={importInputRef} type="file" accept=".xlsx" hidden onChange={handleImport} />
              <button onClick={handleExport} disabled={exporting}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-white text-[#1A2B1A] border border-[#E8DDD0] hover:border-[#1A2B1A] transition-colors disabled:opacity-50">
                {exporting
                  ? <span className="w-4 h-4 border-2 border-[#1A2B1A]/30 border-t-[#1A2B1A] rounded-full animate-spin" />
                  : <Download size={15} />}
                Export
              </button>
              <button onClick={() => importInputRef.current?.click()} disabled={importing}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-white text-[#1A2B1A] border border-[#E8DDD0] hover:border-[#1A2B1A] transition-colors disabled:opacity-50">
                {importing
                  ? <span className="w-4 h-4 border-2 border-[#1A2B1A]/30 border-t-[#1A2B1A] rounded-full animate-spin" />
                  : <Upload size={15} />}
                Import
              </button>
            </>
          )}

          {/* Phân tích danh mục chi — nguyên liệu đã mua + khoản chi/dịch vụ đã dùng */}
          {analysisPath && (
            <button onClick={() => navigate(analysisPath)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1A2B1A] text-white hover:bg-[#243824] transition-colors flex-shrink-0">
              <BarChart3 size={15} /> Phân tích danh mục chi
            </button>
          )}
        </div>
      </div>

      {/* Tổng công nợ */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-50/40 rounded-2xl p-4 flex items-center justify-between border border-amber-100">
        <div>
          <p className="text-xs text-[#8E8878] font-medium">Tổng công nợ hiện tại</p>
          <p className="text-2xl font-bold text-amber-700 mt-0.5">{money(totalDebt)}</p>
        </div>
        <Wallet size={28} className="text-amber-600/40" />
      </div>

      {/* DANH MỤC KHOẢN CHI — POOL DÙNG CHUNG cho mọi NCC.
          Trước đây nằm trong trang chi tiết từng NCC (mỗi NCC một danh mục riêng),
          giờ chuyển lên đây vì nhãn dùng chung: tạo 1 lần, mọi NCC đều chọn được. */}
      <ExpenseCategorySection canManage={canManageCatalog} />

      {/* Tìm kiếm + sắp xếp */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm nhà cung cấp theo tên..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-white"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ArrowUpDown size={13} className="text-[#8E8878]" />
          {[
            { val: 'debt', label: 'Nợ lâu nhất', icon: Clock },
            { val: 'amount', label: 'Nợ nhiều nhất', icon: TrendingUp },
            { val: 'name', label: 'Tên A-Z', icon: Building2 },
          ].map(s => (
            <button key={s.val} onClick={() => setSortBy(s.val)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${sortBy === s.val ? 'bg-[#1A2B1A] text-white border-[#1A2B1A]' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#1A2B1A]'}`}>
              <s.icon size={12} />{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter theo danh mục */}
      {availableTypes.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag size={13} className="text-[#8E8878]" />
          <button onClick={() => setTypeFilter('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${!typeFilter ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#C9A84C]'}`}>
            Tất cả ({suppliers.length})
          </button>
          {availableTypes.map(type => {
            const count = suppliers.filter(v => (v.vendorType || 'OTHER') === type).length;
            return (
              <button key={type} onClick={() => setTypeFilter(f => f === type ? '' : type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${typeFilter === type ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white text-[#8E8878] border-[#E8DDD0] hover:border-[#C9A84C]'}`}>
                {VENDOR_TYPE_LABELS[type] || type} ({count})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Không có nhà cung cấp"
          description={search || typeFilter ? 'Không tìm thấy NCC phù hợp bộ lọc.' : 'Chưa có nhà cung cấp nào.'} />
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([type, vendors]) => {
            const isCollapsed = effectiveCollapsed[type];
            const catDebt = vendors.reduce((s, v) => s + Number(v.totalDebt || 0), 0);
            return (
              <div key={type} className="rounded-2xl border border-black/5 bg-white overflow-hidden">
                {/* Header danh mục — click để collapse/expand */}
                <button onClick={() => toggleCat(type)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-[#FAF7F2] hover:bg-[#F0EBE3] transition-colors text-left">
                  {isCollapsed
                    ? <ChevronRight size={14} className="text-[#8E8878]" />
                    : <ChevronDown size={14} className="text-[#8E8878]" />}
                  <Tag size={14} className="text-[#C9A84C]" />
                  <span className="text-sm font-bold text-[#1C1C1E]">
                    {VENDOR_TYPE_LABELS[type] || type}
                  </span>
                  <span className="text-[11px] text-[#8E8878]">({vendors.length} NCC)</span>
                  {catDebt > 0 && (
                    <span className="ml-auto text-xs font-semibold text-amber-700">
                      Nợ: {money(catDebt)}
                    </span>
                  )}
                </button>

                {/* Danh sách NCC trong danh mục */}
                {!isCollapsed && (
                  <div className="divide-y divide-black/5">
                    {vendors.map(v => (
                      <SupplierCard key={v.vendorId} v={v}
                        expanded={expandedId === v.vendorId}
                        canManage={canManageCatalog}
                        onDelete={handleDeleteSupplier}
                        onToggleExpand={() => setExpandedId(id => id === v.vendorId ? null : v.vendorId)}
                        onOpen={() => navigate(`${basePath}/${v.vendorId}`)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SupplierCard({ v, expanded, onToggleExpand, onOpen, canManage, onDelete }) {
  const hasDebt = Number(v.totalDebt || 0) > 0;
  const days = v.oldestDebtDays;

  return (
    <div className="hover:bg-[#FAF7F2]/40 transition-colors">
      <div className="p-4 flex items-start justify-between gap-3">
        <button onClick={onOpen} className="flex items-start gap-3 min-w-0 text-left flex-1">
          <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/15 text-[#C9A84C] flex items-center justify-center flex-shrink-0">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#1C1C1E] truncate">{v.vendorName}</p>
            <p className="text-xs text-[#8E8878] mt-0.5 truncate">
              {v.contactPerson && <>{v.contactPerson}</>}
              {v.contactPhone && <> · {v.contactPhone}</>}
            </p>
            <p className="text-xs text-[#8E8878] mt-1">{v.orderCount} lần đặt hàng</p>
          </div>
        </button>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {hasDebt
            ? <p className="text-lg font-bold text-amber-700 whitespace-nowrap">{money(v.totalDebt)}</p>
            : <span className="text-xs font-medium text-emerald-600">Không nợ</span>}

          {hasDebt && (
            <button onClick={onToggleExpand}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${debtBadgeColor(days)} hover:brightness-95`}>
              <Clock size={11} />
              {days != null ? `Nợ ${days} ngày` : 'Có công nợ'}
              <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}

          {canManage && onDelete && (
            <button onClick={() => onDelete(v)} title="Xóa nhà cung cấp"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8E8878] hover:text-red-600 transition-colors">
              <Trash2 size={12} /> Xóa
            </button>
          )}
        </div>
      </div>

      {expanded && <DebtLotsPanel vendorId={v.vendorId} />}
    </div>
  );
}

// Panel các lô công nợ còn lại
function DebtLotsPanel({ vendorId }) {
  const [lots, setLots] = useState(null);

  useEffect(() => {
    let alive = true;
    ownerSupplierApi.getDebtLots(vendorId).then(d => { if (alive) setLots(d || []); });
    return () => { alive = false; };
  }, [vendorId]);

  return (
    <div className="px-4 pb-4 -mt-1 border-t border-black/5 pt-3 bg-[#FAF7F2]/50">
      <p className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Layers size={12} /> Các lô công nợ còn lại
      </p>
      {lots == null ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 bg-white rounded-xl animate-pulse" />)}</div>
      ) : lots.length === 0 ? (
        <p className="text-xs text-[#8E8878] py-2">Không còn lô công nợ.</p>
      ) : (
        <div className="space-y-2">
          {lots.map(l => {
            const partial = Number(l.paidAmount || 0) > 0;
            const cfg = SETTLE_CFG[l.settlementStatus] || SETTLE_CFG.NONE;
            return (
              <div key={l.requestVendorId} className="bg-white rounded-xl border border-black/5 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold text-[#C9A84C]">{l.requestCode}</span>
                  <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
                    {cfg.label} · {l.debtDays} ngày
                  </span>
                </div>
                {partial ? (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-[#8E8878]">Tổng</p>
                      <p className="font-semibold text-[#1C1C1E]">{money(l.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[#8E8878]">Đã trả</p>
                      <p className="font-semibold text-emerald-600">{money(l.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-[#8E8878]">Còn lại</p>
                      <p className="font-bold text-amber-700">{money(l.remaining)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#8E8878]">Tổng cần thanh toán</span>
                    <span className="font-bold text-amber-700">{money(l.totalAmount)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// 2) CHI TIẾT NCC — thông tin + lịch sử đặt hàng
// ══════════════════════════════════════════════════════════════════════════
function SupplierDetailPage({ basePath, canManageCatalog }) {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showEdit, setShowEdit] = useState(false);

  const isService = !!info && info.vendorType !== 'MATERIAL';

  const loadInfo = useCallback(() => {
    ownerSupplierApi.getInfo(vendorId).then(d => setInfo(d));
  }, [vendorId]);

  useEffect(() => { loadInfo(); }, [loadInfo]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ownerSupplierApi.getOrders(vendorId, search.trim() || undefined);
      setOrders(data || []);
    } finally { setLoading(false); }
  }, [vendorId, search]);

  useEffect(() => {
    const t = setTimeout(loadOrders, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadOrders, search]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button onClick={() => navigate(basePath)}
        className="flex items-center gap-1.5 text-sm text-[#8E8878] hover:text-[#1C1C1E] font-medium">
        <ChevronLeft size={16} /> Quay lại danh sách nhà cung cấp
      </button>

      {info && (
        <div className="relative">
          <SupplierInfoHeader info={info} isService={isService} />
          {canManageCatalog && (
            <button onClick={() => setShowEdit(true)}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-[#F5F0EB] text-[#8E8878] hover:text-[#C9A84C] transition-colors"
              title="Chỉnh sửa thông tin NCC">
              <Pencil size={16} />
            </button>
          )}
        </div>
      )}

      {showEdit && info && (
        <EditVendorModal
          vendorId={vendorId}
          info={info}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); loadInfo(); }}
        />
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-bold text-[#1C1C1E] flex items-center gap-2">
          <Receipt size={18} className="text-[#C9A84C]" /> {isService ? 'Lịch sử sử dụng' : 'Lịch sử đặt hàng'}
        </h2>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isService ? 'Tìm theo tên dịch vụ...' : 'Tìm theo tên sản phẩm...'}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C] bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <CardSkeleton key={i} />)}</div>
      ) : orders.length === 0 ? (
        <EmptyState icon={Receipt} title={isService ? 'Chưa có lịch sử sử dụng' : 'Chưa có lịch sử đặt hàng'}
          description={search
            ? (isService ? 'Không có dịch vụ khớp từ khóa.' : 'Không có sản phẩm khớp từ khóa.')
            : (isService ? 'NCC này chưa có lần sử dụng nào hoàn thành.' : 'NCC này chưa có đơn đặt hàng nào hoàn thành.')} />
      ) : (
        <div className="space-y-4">
          {orders.map(o => (
            <OrderCard key={o.requestVendorId} order={o} isService={isService} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal chỉnh sửa thông tin NCC ────────────────────────────────────────────
function EditVendorModal({ vendorId, info, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: info.vendorName || '',
    vendorType: info.vendorType || 'MATERIAL',
    contactPerson: info.contactPerson || '',
    contactPhone: info.contactPhone || '',
    address: info.address || '',
    taxCode: info.taxCode || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setErr('Tên nhà cung cấp không được để trống'); return; }
    setSaving(true); setErr('');
    try {
      await ownerSupplierApi.updateVendor(vendorId, {
        name: form.name.trim(),
        vendorType: form.vendorType,
        contactPerson: form.contactPerson.trim(),
        contactPhone: form.contactPhone.trim(),
        address: form.address.trim(),
        taxCode: form.taxCode.trim(),
      });
      toast('Đã cập nhật thông tin nhà cung cấp', 'success');
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || 'Có lỗi xảy ra');
    } finally { setSaving(false); }
  };

  return (
    <Modal open title="Chỉnh sửa nhà cung cấp" onClose={onClose} size="md"
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Huỷ</SecondaryButton>
          <PrimaryButton onClick={submit} loading={saving}>Lưu thay đổi</PrimaryButton>
        </div>
      }>
      <div className="space-y-3">
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}
        <Field label="Tên nhà cung cấp" required>
          <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Loại nhà cung cấp">
          <select className={inputCls} value={form.vendorType} onChange={e => set('vendorType', e.target.value)}>
            {Object.entries(VENDOR_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Người liên hệ">
            <input className={inputCls} value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} />
          </Field>
          <Field label="Số điện thoại">
            <input className={inputCls} value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
          </Field>
        </div>
        <Field label="Địa chỉ">
          <input className={inputCls} value={form.address} onChange={e => set('address', e.target.value)} />
        </Field>
        <Field label="Mã số thuế">
          <input className={inputCls} value={form.taxCode} onChange={e => set('taxCode', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function SupplierInfoHeader({ info, isService }) {
  const rows = [
    info.contactPerson && { icon: User, label: 'Người liên hệ', value: info.contactPerson },
    info.contactPhone && { icon: Phone, label: 'Điện thoại', value: info.contactPhone },
    info.address && { icon: MapPin, label: 'Địa chỉ', value: info.address },
    info.taxCode && { icon: Hash, label: 'Mã số thuế', value: info.taxCode },
  ].filter(Boolean);

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#C9A84C]/15 text-[#C9A84C] flex items-center justify-center flex-shrink-0">
          <Building2 size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-[#1C1C1E]" style={{ fontFamily: 'var(--font-display)' }}>
            {info.vendorName}
          </h1>
          <span className="inline-block mt-1 text-xs font-medium bg-[#F5F0EB] text-[#8E8878] px-2 py-0.5 rounded-full">
            {VENDOR_TYPE_LABELS[info.vendorType] || info.vendorType || 'Khác'}
          </span>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 pt-4 border-t border-black/5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <r.icon size={14} className="text-[#8E8878] flex-shrink-0" />
              <span className="text-[#8E8878]">{r.label}:</span>
              <span className="text-[#1C1C1E] font-medium truncate">{r.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-black/5">
        <Stat label={isService ? 'Số lần sử dụng' : 'Số lần đặt'} value={info.orderCount} />
        <Stat label={isService ? 'Số dịch vụ' : 'Số sản phẩm'} value={info.distinctProductCount} />
        <Stat label={isService ? 'Tổng tiền đã sử dụng' : 'Tổng đã mua'} value={money(info.totalPurchased)} accent />
        <Stat label="Công nợ" value={money(info.totalDebt)}
          sub={info.oldestDebtDays != null ? `Lâu nhất ${info.oldestDebtDays} ngày` : null}
          danger={Number(info.totalDebt || 0) > 0} />
      </div>
    </div>
  );
}

// ── DANH MỤC KHOẢN CHI — POOL DÙNG CHUNG cho MỌI NCC (Owner quản lý) ──────
//
// Trước đây mỗi NCC có danh mục riêng → 10 nhãn × 200 NCC = 2.000 thao tác tạo,
// và cùng một khoản chi ("Tiền điện") nằm ở 200 bản ghi khác nhau nên rất khó
// tổng hợp chi phí theo mục. Giờ Owner tạo nhãn MỘT LẦN, mọi NCC đều chọn được.
function ExpenseCategorySection({ canManage }) {
  const [cats, setCats] = useState(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await ownerSupplierApi.listCategories(false);
      setCats(data || []);
    } catch { setCats([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeCats = (cats || []).filter(c => c.active);

  const doCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true); setErr('');
    try {
      await ownerSupplierApi.createCategory({ name });
      setNewName(''); setAdding(false);
      await load();
    } catch (e) { setErr(e?.response?.data?.message || 'Không tạo được nhãn'); }
    finally { setBusy(false); }
  };

  const doRename = async (id) => {
    const name = editing.name.trim();
    if (!name) return;
    setBusy(true); setErr('');
    try {
      await ownerSupplierApi.updateCategory(id, { name });
      setEditing(null);
      await load();
    } catch (e) { setErr(e?.response?.data?.message || 'Không cập nhật được'); }
    finally { setBusy(false); }
  };

  const toggleActive = async (c) => {
    setBusy(true); setErr('');
    try {
      await ownerSupplierApi.updateCategory(c.id, { active: !c.active });
      await load();
    } catch (e) { setErr(e?.response?.data?.message || 'Không cập nhật được'); }
    finally { setBusy(false); }
  };

  const doDelete = async (c) => {
    if (!window.confirm(`Ẩn nhãn "${c.name}"? Nhãn sẽ không còn chọn được khi lập phiếu chi cho BẤT KỲ nhà cung cấp nào (phiếu cũ giữ nguyên).`)) return;
    setBusy(true); setErr('');
    try {
      await ownerSupplierApi.deleteCategory(c.id);
      await load();
    } catch (e) { setErr(e?.response?.data?.message || 'Không xoá được'); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Tag size={16} className="text-[#C9A84C]" />
          <span className="text-sm font-semibold text-[#1C1C1E]">Danh mục khoản chi</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/30">
            Dùng chung
          </span>
          {cats && <span className="text-xs text-[#8E8878]">({activeCats.length} nhãn)</span>}
        </div>
        <span className="text-xs text-[#8E8878]">{open ? 'Thu gọn' : 'Mở rộng'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-black/5 pt-3 space-y-3">
          <p className="text-xs text-[#8E8878]">
            {canManage
              ? 'Danh mục DÙNG CHUNG cho tất cả nhà cung cấp — tạo nhãn một lần, mọi NCC đều chọn được. Kế toán chỉ được chọn từ danh sách này, không gõ tự do.'
              : 'Danh mục khoản chi dùng chung cho mọi nhà cung cấp (do chủ quản lý). Kế toán chọn nhãn khi lập phiếu chi.'}
          </p>

          {err && <p className="text-xs text-red-600">{err}</p>}

          {cats == null ? (
            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 bg-[#FAF7F2] rounded-xl animate-pulse" />)}</div>
          ) : cats.length === 0 ? (
            <p className="text-xs text-[#8E8878] py-2">Chưa có nhãn nào{canManage ? ' — hãy thêm nhãn đầu tiên.' : '.'}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cats.map(c => (
                <div key={c.id}
                  className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border text-sm ${c.active ? 'bg-[#FAF7F2] border-[#E8DDD0] text-[#1C1C1E]' : 'bg-gray-50 border-gray-200 text-gray-400 line-through'}`}>
                  {editing?.id === c.id ? (
                    <>
                      <input autoFocus value={editing.name}
                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && doRename(c.id)}
                        className="text-sm bg-white border border-[#C9A84C] rounded px-1.5 py-0.5 w-32 focus:outline-none" />
                      <button disabled={busy} onClick={() => doRename(c.id)} className="text-emerald-600"><Check size={14} /></button>
                      <button onClick={() => setEditing(null)} className="text-[#8E8878]"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <span>{c.name}</span>
                      {canManage && (
                        <span className="flex items-center gap-1">
                          <button onClick={() => setEditing({ id: c.id, name: c.name })} title="Sửa"
                            className="text-[#8E8878] hover:text-[#C9A84C]"><Pencil size={12} /></button>
                          <button onClick={() => toggleActive(c)} title={c.active ? 'Ẩn' : 'Bật lại'}
                            className="text-[#8E8878] hover:text-amber-600 text-[11px] font-semibold">{c.active ? 'Ẩn' : 'Bật'}</button>
                          <button onClick={() => doDelete(c)} title="Xoá (ẩn)"
                            className="text-[#8E8878] hover:text-red-600"><Trash2 size={12} /></button>
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManage && (
            adding ? (
              <div className="flex items-center gap-2">
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doCreate()}
                  placeholder="Tên nhãn khoản chi (VD: Tiền điện)..."
                  className="flex-1 px-3 py-2 text-sm rounded-xl border border-[#E8DDD0] focus:outline-none focus:border-[#C9A84C]" />
                <button disabled={busy || !newName.trim()} onClick={doCreate}
                  className="px-3 py-2 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold disabled:opacity-50">Lưu</button>
                <button onClick={() => { setAdding(false); setNewName(''); setErr(''); }}
                  className="px-3 py-2 rounded-xl border border-[#E8DDD0] text-sm">Huỷ</button>
              </div>
            ) : (
              <button onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#C9A84C] hover:underline">
                <Plus size={14} /> Thêm nhãn khoản chi
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent, danger }) {
  return (
    <div>
      <p className="text-xs text-[#8E8878]">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${danger ? 'text-amber-700' : accent ? 'text-[#C9A84C]' : 'text-[#1C1C1E]'}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#8E8878] mt-0.5">{sub}</p>}
    </div>
  );
}

function OrderCard({ order, isService }) {
  const payCfg = PAY_CFG[order.paymentStatus] || PAY_CFG.UNSET;
  const dateTs = order.completedAt || order.orderedAt;

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#FAF7F2] border-b border-black/5 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-[#C9A84C]">{order.requestCode}</span>
          {dateTs && (
            <span className="text-xs text-[#8E8878] flex items-center gap-1">
              <Calendar size={11} /> {formatDate(dateTs)}
            </span>
          )}
        </div>
        <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full border ${payCfg.cls}`}>
          {payCfg.label}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-[#8E8878]">
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">{isService ? 'Dịch vụ' : 'Sản phẩm'}</th>
              {!isService && <>
                <th className="text-right px-4 py-2 text-xs font-semibold uppercase whitespace-nowrap">Đơn giá</th>
                <th className="text-right px-4 py-2 text-xs font-semibold uppercase whitespace-nowrap">SL</th>
                <th className="text-left px-2 py-2 text-xs font-semibold uppercase">ĐVT</th>
              </>}
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase whitespace-nowrap">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map(it => (
              <tr key={it.itemId}
                className="border-b border-[#F0EBE3] last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-medium text-[#1C1C1E] inline-flex items-center gap-1.5">
                    <Package size={13} className="text-[#8E8878]" />
                    {it.materialName}
                  </span>
                </td>
                {!isService && <>
                  <td className="px-4 py-2.5 text-right text-[#1C1C1E] whitespace-nowrap">{money(it.unitPrice)}</td>
                  <td className="px-4 py-2.5 text-right text-[#1C1C1E] whitespace-nowrap">{qtyFmt(it.quantity)}</td>
                  <td className="px-2 py-2.5 text-[#8E8878]">{it.unit}</td>
                </>}
                <td className="px-4 py-2.5 text-right font-semibold text-[#1C1C1E] whitespace-nowrap">{money(it.lineAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#FAF7F2]/60">
              <td colSpan={isService ? 1 : 4} className="px-4 py-2.5 text-right text-xs font-semibold text-[#8E8878] uppercase">
                {isService ? 'Tổng chi phí sử dụng' : 'Tổng đơn đặt hàng'}
              </td>
              <td className="px-4 py-2.5 text-right font-bold text-[#C9A84C] whitespace-nowrap">{money(order.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Router wrapper
// ══════════════════════════════════════════════════════════════════════════
export default function SupplierManagementShared({
  basePath, dashboardPath, analysisPath, canManageCatalog = false,
}) {
  const { vendorId } = useParams();
  return vendorId
    ? <SupplierDetailPage basePath={basePath} canManageCatalog={canManageCatalog} />
    : <SupplierListPage basePath={basePath} dashboardPath={dashboardPath}
        analysisPath={analysisPath} canManageCatalog={canManageCatalog} />;
}