// src/pages/accountant/ExpenseListPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { expenseApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import DateRangePicker from '../../components/ui/DateRangePicker';
import {
  Receipt, Search, ChevronLeft, ChevronRight,
  X, Plus, CheckCircle, XCircle, Clock,
  Building2, Eye, TrendingDown, TrendingUp, Wallet
} from 'lucide-react';
import ExpenseCreateModal from './ExpenseCreateModal';
import ExpenseDetailModal from './ExpenseDetailModal';

function formatVND(n) {
  if (!n && n !== 0) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}
function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function dayRange(date) {
  const d = new Date(date + 'T00:00:00');
  return { from: d.getTime(), to: d.getTime() + 86399999 };
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS_CFG = {
  PENDING: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  APPROVED: { label: 'Đã duyệt', cls: 'bg-green-100 text-green-700', icon: CheckCircle },
  REJECTED: { label: 'Từ chối', cls: 'bg-red-100 text-red-600', icon: XCircle },
};
const PAGE_SIZE = 10;

export default function ExpenseListPage() {
  const toast = useToast();
  const searchDebounce = useRef(null);
  const searchTextRef = useRef('');

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [dateRange, setDateRange] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [detailVoucher, setDetailVoucher] = useState(null);

  const calcTotal = (list) => list.reduce((s, v) => s + (Number(v.totalAmount) || 0), 0);

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const range = dateRange || dayRange(selectedDate);
      const q = searchTextRef.current.trim();
      const res = q
        ? await expenseApi.search(q, range.from, range.to, { page: p, size: PAGE_SIZE })
        : await expenseApi.listByDate(range.from, range.to, { page: p, size: PAGE_SIZE });
      const data = res.data?.data || res.data || {};
      const content = data.content || [];
      setVouchers(content);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
      setTotalAmount(calcTotal(content));
      setPage(p);
    } catch { toast('Lỗi tải danh sách', 'error'); }
    finally { setLoading(false); }
  }, [selectedDate, dateRange]);

  useEffect(() => { load(0); }, [selectedDate, dateRange]);

  const handleSearchChange = (val) => {
    setSearchText(val);
    searchTextRef.current = val;
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => load(0), 500);
  };

  const clearSearch = () => {
    setSearchText(''); searchTextRef.current = '';
    clearTimeout(searchDebounce.current);
    load(0);
  };

  const handleDateRangeChange = (r) => {
    setDateRange(!r.from && !r.to ? null : r);
  };

  const currentRange = dateRange || dayRange(selectedDate);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <Receipt size={22} className="text-[#C9A84C]" />
        <h1 className="text-xl font-bold text-[#1C1C1E]">Phiếu chi</h1>
        <span className="text-xs text-[#8E8878] ml-1">{totalElements} phiếu</span>
      </div>

      <div className="bg-gradient-to-r from-[#C9A84C]/10 to-[#C9A84C]/5 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-[#8E8878] font-medium">
            {searchText ? `Tìm "${searchText}" trong kỳ` : 'Tổng chi trong kỳ'}
          </p>
          <p className="text-2xl font-bold text-[#C9A84C] mt-0.5">{formatVND(totalAmount)}</p>
        </div>
        <TrendingDown size={28} className="text-[#C9A84C]/40" />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input
            value={searchText}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Tìm mã phiếu, lý do, nhà cung cấp..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#E8DDD0] text-sm bg-white focus:outline-none focus:border-[#C9A84C]"
          />
          {searchText && (
            <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8E8878] hover:text-[#1C1C1E]">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex-shrink-0">
          <DateRangePicker from={currentRange.from} to={currentRange.to} onChange={handleDateRangeChange} placeholder="Chọn ngày" align="right" />
        </div>
        {dateRange && (
          <button onClick={() => setDateRange(null)} className="p-2 rounded-xl border border-[#E8DDD0] text-[#8E8878] hover:bg-[#FAF7F2] transition flex-shrink-0" title="Về hôm nay">
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : vouchers.length === 0 ? (
        <div className="text-center py-16 text-[#8E8878]">
          <Receipt size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Không có phiếu chi nào</p>
          <p className="text-sm mt-1">{searchText ? 'Thử từ khoá khác' : 'Trong khoảng thời gian này'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vouchers.map(v => {
            const s = STATUS_CFG[v.status] || STATUS_CFG.PENDING;
            const StatusIcon = s.icon;
            return (
              <div key={v.id} onClick={() => setDetailVoucher(v)}
                className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 hover:border-[#C9A84C]/40 hover:shadow-md transition cursor-pointer">
                {/* Row 1: mã + badge + tiền */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#C9A84C]">{v.voucherCode}</span>
                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>
                      <StatusIcon size={9} /> {s.label}
                    </span>
                    {v.voucherType === 'VENDOR_DEBT_PAYMENT' && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                        <Wallet size={9} /> Trả công nợ NCC
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-[#1C1C1E] text-sm">{formatVND(v.totalAmount)}</p>
                </div>
                {/* Row 2: lý do */}
                <p className="text-sm font-semibold text-[#1C1C1E] truncate mb-1.5">{v.reason}</p>
                {/* Row 3: meta */}
                <div className="flex items-center justify-between text-xs text-[#8E8878]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {v.vendorName && <span className="flex items-center gap-1 truncate max-w-[110px]"><Building2 size={9} />{v.vendorName}</span>}
                  </div>
                  <span className="flex-shrink-0">{formatDate(v.createdAt)}</span>
                </div>
                <p className="text-xs text-[#8E8878] mt-0.5">Bởi {v.createdByName}{v.items?.length > 0 ? ` · ${v.items.length} khoản` : ''}</p>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page === 0} onClick={() => load(page - 1)} className="p-2 rounded-lg border border-black/10 hover:bg-[#FAF7F2] disabled:opacity-30 transition"><ChevronLeft size={16} /></button>
          {[...Array(Math.min(totalPages, 7))].map((_, i) => (
            <button key={i} onClick={() => load(i)} className={`w-9 h-9 rounded-lg text-sm font-semibold transition ${i === page ? 'bg-[#C9A84C] text-white' : 'border border-black/10 hover:bg-[#FAF7F2] text-[#1C1C1E]'}`}>{i + 1}</button>
          ))}
          <button disabled={page >= totalPages - 1} onClick={() => load(page + 1)} className="p-2 rounded-lg border border-black/10 hover:bg-[#FAF7F2] disabled:opacity-30 transition"><ChevronRight size={16} /></button>
        </div>
      )}

      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#C9A84C] hover:bg-[#B8923E] shadow-xl flex items-center justify-center transition-all"
      >
        <Plus size={26} className="text-white" />
      </button>

      {showCreate && <ExpenseCreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(0); }} />}
      {detailVoucher && <ExpenseDetailModal voucher={detailVoucher} onClose={() => setDetailVoucher(null)} />}
    </div>
  );
}