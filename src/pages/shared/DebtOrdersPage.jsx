// src/pages/shared/DebtOrdersPage.jsx
// Dùng chung cho ACCOUNTANT, SUPER_ACCOUNTANT, ADMIN, OWNER
// Nhận prop `type` = 'NEARING' | 'OVERDUE' từ route state hoặc searchParam
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import {
  AlertTriangle, Clock, ArrowLeft, Search, CheckSquare,
  Square, Wallet, ChevronDown, ChevronUp, X,
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────
function formatVND(n) {
  if (!n && n !== 0) return '0 đ';
  const num = Number(n);
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
  if (num >= 1_000_000)     return (num / 1_000_000).toFixed(1).replace('.0', '') + ' tr';
  return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
}
function formatVNDFull(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + ' đ';
}
function formatDate(ts) {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(ts));
}

// ─── DaySince badge ──────────────────────────────────────────────────────────
function DaysBadge({ daysOverdue, type }) {
  if (type === 'NEARING') {
    const days = -Number(daysOverdue); // daysOverdue âm = còn N ngày
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
        <Clock size={10} /> Còn {days} ngày
      </span>
    );
  }
  const days = Number(daysOverdue);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 whitespace-nowrap">
      <AlertTriangle size={10} /> Quá {days} ngày
    </span>
  );
}

// ─── Row detail expand ────────────────────────────────────────────────────────
function OrderRow({ order, checked, onCheck, type }) {
  const [open, setOpen] = useState(false);
  const remaining = Number(order.remainingAmount ?? 0);
  const final     = Number(order.finalAmount     ?? 0);
  const paid      = Number(order.paidAmount      ?? 0);

  return (
    <>
      <tr
        className={`border-b border-[#F0EBE3] transition-colors ${
          checked ? 'bg-amber-50' : 'hover:bg-[#FAF7F2]'
        }`}
      >
        {/* Checkbox */}
        <td className="px-3 py-3 w-8">
          <button
            onClick={() => onCheck(order.id)}
            className="text-[#C9A84C] hover:scale-110 transition-transform"
          >
            {checked ? <CheckSquare size={18} /> : <Square size={18} className="text-[#C4B9A8]" />}
          </button>
        </td>

        {/* Mã đơn */}
        <td className="px-3 py-3 whitespace-nowrap">
          <button
            onClick={() => setOpen(o => !o)}
            className="font-mono text-xs text-[#C9A84C] font-bold hover:underline"
          >
            {order.orderCode}
          </button>
        </td>

        {/* Khách hàng */}
        <td className="px-3 py-3 max-w-[160px]">
          <p className="text-sm font-semibold text-[#1C1C1E] truncate">{order.customerName || '—'}</p>
          {order.customerPhone && (
            <p className="text-xs text-[#8E8878]">{order.customerPhone}</p>
          )}
        </td>

        {/* Hạn thanh toán */}
        <td className="px-3 py-3 whitespace-nowrap">
          <p className="text-xs text-[#5C4E3D]">{order.paymentDeadline || '—'}</p>
          <DaysBadge daysOverdue={order.daysOverdue} type={type} />
        </td>

        {/* Tổng đơn */}
        <td className="px-3 py-3 text-right whitespace-nowrap">
          <p className="text-sm font-semibold text-[#1C1C1E]">{formatVNDFull(final)}</p>
          {paid > 0 && (
            <p className="text-xs text-emerald-600">Đã trả: {formatVNDFull(paid)}</p>
          )}
        </td>

        {/* Còn lại */}
        <td className="px-3 py-3 text-right whitespace-nowrap">
          <p className={`text-sm font-bold ${
            type === 'OVERDUE' ? 'text-red-600' : 'text-amber-600'
          }`}>
            {formatVNDFull(remaining)}
          </p>
        </td>

        {/* Người tạo / kho */}
        <td className="px-3 py-3 hidden md:table-cell whitespace-nowrap">
          <p className="text-xs text-[#5C4E3D]">{order.orderedByName || '—'}</p>
          {order.warehouseName && (
            <p className="text-xs text-[#8E8878]">{order.warehouseName}</p>
          )}
        </td>

        {/* Expand */}
        <td className="px-2 py-3 w-6">
          <button onClick={() => setOpen(o => !o)} className="text-[#8E8878] hover:text-[#1C1C1E]">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>

      {/* Expand row detail */}
      {open && (
        <tr className="bg-[#FAF7F2]">
          <td colSpan={8} className="px-6 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-[#8E8878] font-semibold uppercase mb-0.5">Ngày tạo đơn</p>
                <p className="text-[#1C1C1E]">{formatDate(order.createdAt)}</p>
              </div>
              <div>
                <p className="text-[#8E8878] font-semibold uppercase mb-0.5">Ngày chờ TT</p>
                <p className="text-[#1C1C1E]">{formatDate(order.pendingPaymentAt)}</p>
              </div>
              <div>
                <p className="text-[#8E8878] font-semibold uppercase mb-0.5">Số ngày nợ</p>
                <p className="text-[#1C1C1E]">{order.debtDays} ngày</p>
              </div>
              <div>
                <p className="text-[#8E8878] font-semibold uppercase mb-0.5">Loại KH</p>
                <p className="text-[#1C1C1E]">
                  {order.customerType === 'COMPANY' ? 'Doanh nghiệp' : 'Khách lẻ'}
                </p>
              </div>
              <div>
                <p className="text-[#8E8878] font-semibold uppercase mb-0.5">Tổng đơn</p>
                <p className="font-bold text-[#1C1C1E]">{formatVNDFull(order.finalAmount)}</p>
              </div>
              <div>
                <p className="text-[#8E8878] font-semibold uppercase mb-0.5">Đã thanh toán</p>
                <p className="font-bold text-emerald-600">{formatVNDFull(order.paidAmount)}</p>
              </div>
              <div>
                <p className="text-[#8E8878] font-semibold uppercase mb-0.5">Còn phải thu</p>
                <p className={`font-bold ${type === 'OVERDUE' ? 'text-red-600' : 'text-amber-600'}`}>
                  {formatVNDFull(order.remainingAmount)}
                </p>
              </div>
              <div>
                <p className="text-[#8E8878] font-semibold uppercase mb-0.5">Hạn thanh toán</p>
                <p className="font-bold text-[#1C1C1E]">{order.paymentDeadline}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Selection summary widget ─────────────────────────────────────────────────
function SelectionSummary({ orders, selectedIds, onClear }) {
  const selected = orders.filter(o => selectedIds.has(o.id));
  if (selected.length === 0) return null;

  const totalRemaining = selected.reduce((s, o) => s + Number(o.remainingAmount ?? 0), 0);
  const totalFinal     = selected.reduce((s, o) => s + Number(o.finalAmount     ?? 0), 0);
  const totalPaid      = selected.reduce((s, o) => s + Number(o.paidAmount      ?? 0), 0);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
      <div className="bg-[#1C1C1E] text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-5 min-w-[340px] max-w-[600px]">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/60 mb-0.5">
            Đã chọn {selected.length} đơn hàng
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div>
              <span className="text-xs text-white/50">Tổng giá trị: </span>
              <span className="text-sm font-semibold text-[#C9A84C]">{formatVNDFull(totalFinal)}</span>
            </div>
            {totalPaid > 0 && (
              <div>
                <span className="text-xs text-white/50">Đã trả: </span>
                <span className="text-sm font-semibold text-emerald-400">{formatVNDFull(totalPaid)}</span>
              </div>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Wallet size={13} className="text-amber-400 flex-shrink-0" />
            <span className="text-xs text-white/70">Cần thu: </span>
            <span className="text-base font-bold text-amber-400">{formatVNDFull(totalRemaining)}</span>
          </div>
        </div>
        <button
          onClick={onClear}
          className="p-1.5 rounded-lg hover:bg-white/10 transition text-white/60 hover:text-white flex-shrink-0"
          title="Bỏ chọn"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DebtOrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // type từ state navigate hoặc searchParam
  const searchParams = new URLSearchParams(location.search);
  const type = (location.state?.type || searchParams.get('type') || 'NEARING').toUpperCase();

  const isOverdue = type === 'OVERDUE';

  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get('/api/accountant/dashboard/debt-orders', { params: { type } });
      const data = res.data?.data ?? res.data ?? [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  // Filter theo search
  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o =>
      (o.orderCode     && o.orderCode.toLowerCase().includes(q))   ||
      (o.customerName  && o.customerName.toLowerCase().includes(q)) ||
      (o.customerPhone && o.customerPhone.includes(q))
    );
  }, [orders, search]);

  const toggleOne = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(o => o.id)));
    }
  };

  const totalRemaining = orders.reduce((s, o) => s + Number(o.remainingAmount ?? 0), 0);

  const allChecked = filtered.length > 0 && selectedIds.size === filtered.length;
  const someChecked = selectedIds.size > 0 && selectedIds.size < filtered.length;

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 pb-32">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-[#F0EBE3] transition text-[#5C4E3D]"
          >
            <ArrowLeft size={18} />
          </button>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isOverdue ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            {isOverdue
              ? <AlertTriangle size={20} className="text-red-600" />
              : <Clock size={20} className="text-amber-600" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1C1C1E]">
              {isOverdue ? 'Công nợ quá hạn' : 'Sắp đến hạn thanh toán'}
            </h1>
            <p className="text-sm text-[#8E8878]">
              {isOverdue
                ? 'Các đơn hàng có công nợ đã vượt quá hạn thanh toán'
                : 'Các đơn hàng có hạn thanh toán trong vòng 7 ngày tới'}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className={`rounded-2xl p-4 border ${
            isOverdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <p className={`text-xs font-semibold uppercase mb-1 ${
              isOverdue ? 'text-red-400' : 'text-amber-500'
            }`}>Số đơn</p>
            <p className={`text-3xl font-bold ${
              isOverdue ? 'text-red-600' : 'text-amber-700'
            }`}>{loading ? '…' : orders.length}</p>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-[#E8DDD0]">
            <p className="text-xs font-semibold text-[#8E8878] uppercase mb-1">Tổng cần thu</p>
            <p className="text-xl font-bold text-[#1C1C1E]">
              {loading ? '…' : formatVND(totalRemaining)}
            </p>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-[#E8DDD0] sm:block hidden">
            <p className="text-xs font-semibold text-[#8E8878] uppercase mb-1">Đang chọn</p>
            <p className="text-xl font-bold text-[#C9A84C]">
              {selectedIds.size} đơn
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo mã đơn, tên khách hàng, số điện thoại..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#E8DDD0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E8DDD0] p-8 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8DDD0] p-12 flex flex-col items-center gap-3 text-[#8E8878]">
            {isOverdue
              ? <AlertTriangle size={40} className="text-red-300" />
              : <Clock size={40} className="text-amber-300" />}
            <p className="font-semibold">
              {search ? 'Không tìm thấy kết quả' : (isOverdue ? 'Không có đơn quá hạn' : 'Không có đơn sắp đến hạn')}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E8DDD0] overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#E8DDD0]">
                  {/* Select all */}
                  <th className="px-3 py-3 w-8">
                    <button
                      onClick={toggleAll}
                      className="text-[#C9A84C] hover:scale-110 transition-transform"
                    >
                      {allChecked
                        ? <CheckSquare size={18} />
                        : someChecked
                        ? <CheckSquare size={18} className="opacity-50" />
                        : <Square size={18} className="text-[#C4B9A8]" />}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-[#8E8878] uppercase whitespace-nowrap">Mã đơn</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-[#8E8878] uppercase">Khách hàng</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-[#8E8878] uppercase whitespace-nowrap">
                    {isOverdue ? 'Hạn TT / Số ngày QH' : 'Hạn TT / Còn lại'}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-bold text-[#8E8878] uppercase whitespace-nowrap">Tổng đơn</th>
                  <th className="px-3 py-3 text-right text-xs font-bold text-[#8E8878] uppercase whitespace-nowrap">Còn phải thu</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-[#8E8878] uppercase whitespace-nowrap hidden md:table-cell">Người tạo / Kho</th>
                  <th className="px-2 py-3 w-6" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    checked={selectedIds.has(order.id)}
                    onCheck={toggleOne}
                    type={type}
                  />
                ))}
              </tbody>
            </table>

            {/* Footer total */}
            <div className="px-4 py-3 border-t border-[#F0EBE3] bg-[#FAF7F2] flex items-center justify-between">
              <p className="text-xs text-[#8E8878]">
                {filtered.length} đơn
                {search && orders.length !== filtered.length
                  ? ` (lọc từ ${orders.length})`
                  : ''}
              </p>
              <p className="text-sm font-bold text-[#1C1C1E]">
                Tổng cần thu: <span className={isOverdue ? 'text-red-600' : 'text-amber-600'}>
                  {formatVNDFull(totalRemaining)}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky selection summary widget */}
      <SelectionSummary
        orders={filtered}
        selectedIds={selectedIds}
        onClear={() => setSelectedIds(new Set())}
      />
    </>
  );
}