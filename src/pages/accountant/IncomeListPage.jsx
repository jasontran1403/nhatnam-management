// src/pages/accountant/IncomeListPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { incomeApi, downloadBlob } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import DateRangePicker from '../../components/ui/DateRangePicker';
import {
  TrendingUp, TrendingDown, Search, ChevronLeft, ChevronRight,
  X, Plus, Banknote, CreditCard, Eye, Download,
} from 'lucide-react';
import IncomeCreateModal from './IncomeCreateModal';
import IncomeDetailModal from './IncomeDetailModal';
import { VOUCHER_PAGE_SIZE } from '../../constants/pagination';
import { formatVND } from '../../utils/format.js';
import { BackButton, useSubPageNav } from '../../components/common/SubPageNav';

function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function dayRange(date) {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { from: start.getTime(), to: end.getTime() };
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Số item/trang DÙNG CHUNG cho mọi role (xem src/constants/pagination.js)
const PAGE_SIZE = VOUCHER_PAGE_SIZE;

export default function IncomeListPage({ adminMode = false }) {
  // Mở từ nút trên trang Dòng tiền → có state.from để quay lại.
  const { from: subFrom } = useSubPageNav();
  const toast = useToast();
  const searchDebounce = useRef(null);
  const searchTextRef = useRef('');

  // OWNER/ADMIN (adminMode): mặc định KHÔNG chọn ngày → fetch TẤT CẢ phiếu.
  // ACCOUNTANT/SUPER_ACCOUNTANT: mặc định lọc theo hôm nay (giữ nguyên).
  const [selectedDate, setSelectedDate] = useState(adminMode ? null : todayStr());
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
  const [editVoucher, setEditVoucher] = useState(null);

  // Bấm Sửa: nạp ĐẦY ĐỦ phiếu (items + đơn liên kết) rồi mở lại form ở chế độ sửa.
  const handleEdit = async (v) => {
    try {
      const res = await incomeApi.getById(v.id);
      const full = res.data?.data || res.data || v;
      setDetailVoucher(null);
      setEditVoucher(full);
    } catch {
      toast('Không tải được chi tiết phiếu thu', 'error');
    }
  };
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPaymentType, setExportPaymentType] = useState('ALL'); // ALL | CASH | BANK_TRANSFER

  const handleExport = async () => {
    const range = dateRange || dayRange(selectedDate || todayStr());
    setExporting(true);
    try {
      const res = await incomeApi.exportReport(range.from, range.to, exportPaymentType);
      const d = new Date(range.from);
      const dEnd = new Date(range.to);
      const fmt = (dt) => `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
      downloadBlob(res.data, `phieu-thu-${fmt(d)}_${fmt(dEnd)}.xlsx`);
      toast('Xuất báo cáo thành công', 'success');
      setShowExport(false);
    } catch { toast('Lỗi xuất báo cáo', 'error'); }
    finally { setExporting(false); }
  };

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const q = searchTextRef.current.trim();

      // adminMode + chưa chọn ngày (selectedDate null, dateRange null) → fetch TẤT CẢ.
      const noDateChosen = adminMode && !selectedDate && !dateRange;

      if (noDateChosen) {
        const [res, sumRes] = await Promise.all([
          q ? incomeApi.search(q, undefined, undefined, { page: p, size: PAGE_SIZE })
            : incomeApi.listAll({ page: p, size: PAGE_SIZE }),
          incomeApi.summary(q || undefined, undefined, undefined),
        ]);
        const data = res.data?.data || res.data || {};
        setVouchers(data.content || []);
        setTotalPages(data.totalPages || 0);
        setTotalElements(data.totalElements || 0);
        setPage(p);
        const sum = sumRes.data?.data || sumRes.data || {};
        setTotalAmount(Number(sum.totalAmount) || 0);
        return;
      }

      // Quy tắc lọc ngày khi tìm kiếm:
      //  - dateRange === null  → đang ở mặc định "hôm nay" (user CHƯA chỉnh filter).
      //      · Không search  → lọc theo hôm nay.
      //      · Có search     → BỎ filter ngày, tìm trên toàn bộ.
      //  - dateRange !== null  → user ĐÃ chủ động chọn khoảng ngày.
      //      · Search hay không, đều áp filter ngày đó.
      //  (Nút X gọi setDateRange(null) → về "hôm nay" → search lại thành không-filter.)
      const userPickedRange = dateRange !== null;
      const ignoreDateForSearch = !!q && !userPickedRange;

      const range = dateRange || dayRange(selectedDate || todayStr());
      const from = ignoreDateForSearch ? undefined : range.from;
      const to = ignoreDateForSearch ? undefined : range.to;

      const [res, sumRes] = await Promise.all([
        q
          ? incomeApi.search(q, from, to, { page: p, size: PAGE_SIZE })
          : incomeApi.listByDate(range.from, range.to, { page: p, size: PAGE_SIZE }),
        incomeApi.summary(q || undefined, from, to),
      ]);

      const data = res.data?.data || res.data || {};
      setVouchers(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
      setPage(p);

      const sum = sumRes.data?.data || sumRes.data || {};
      setTotalAmount(Number(sum.totalAmount) || 0);
    } catch { toast('Lỗi tải danh sách', 'error'); }
    finally { setLoading(false); }
  }, [selectedDate, dateRange, adminMode]);

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

  // adminMode chưa chọn ngày → picker để trống (from/to undefined).
  const currentRange = dateRange || (selectedDate ? dayRange(selectedDate) : { from: undefined, to: undefined });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 pb-24">
      {/* Trang dùng chung nhiều role — chỉ hiện nút Quay lại khi vào từ Dòng tiền. */}
      {subFrom && <BackButton fallback={subFrom} />}

      <div className="flex items-center gap-3">
        <TrendingUp size={22} className="text-gold" />
        <h1 className="text-xl font-bold text-ink">Phiếu thu</h1>
        <span className="text-xs text-muted ml-1">{totalElements} phiếu</span>
      </div>

      <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted font-medium">
            {searchText ? `Tìm "${searchText}" trong kỳ` : 'Tổng thu trong kỳ'}
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300 mt-0.5">{formatVND(totalAmount)}</p>
        </div>
        <TrendingUp size={28} className="text-emerald-400/40" />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchText}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Tìm số phiếu thu, lý do, người nộp, số tiền..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-line text-sm bg-surface focus:outline-none focus:border-gold"
          />
          {searchText && (
            <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex-shrink-0">
          <DateRangePicker from={currentRange.from} to={currentRange.to} onChange={handleDateRangeChange} placeholder="Chọn ngày" align="right" />
        </div>
        {dateRange && (
          <button onClick={() => setDateRange(null)} className="p-2 rounded-xl border border-line text-muted hover:bg-canvas transition flex-shrink-0" title={adminMode ? 'Xem tất cả' : 'Về hôm nay'}>
            <X size={14} />
          </button>
        )}
        <button
          onClick={() => setShowExport(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs font-medium text-ink-2 hover:border-gold hover:text-gold transition-all"
          title="Xuất báo cáo"
        >
          <Download size={13} /> Export
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-surface-2 rounded-2xl animate-pulse" />)}</div>
      ) : vouchers.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Không có phiếu thu nào</p>
          <p className="text-sm mt-1">{searchText ? 'Thử từ khoá khác' : 'Trong khoảng thời gian này'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vouchers.map(v => <IncomeCard key={v.id} v={v} onClick={() => setDetailVoucher(v)} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page === 0} onClick={() => load(page - 1)} className="p-2 rounded-lg border border-hairline-2 hover:bg-canvas disabled:opacity-30 transition"><ChevronLeft size={16} /></button>
          {[...Array(Math.min(totalPages, 7))].map((_, i) => (
            <button key={i} onClick={() => load(i)} className={`w-9 h-9 rounded-lg text-sm font-semibold transition ${i === page ? 'bg-gold text-white' : 'border border-hairline-2 hover:bg-canvas text-ink'}`}>{i + 1}</button>
          ))}
          <button disabled={page >= totalPages - 1} onClick={() => load(page + 1)} className="p-2 rounded-lg border border-hairline-2 hover:bg-canvas disabled:opacity-30 transition"><ChevronRight size={16} /></button>
        </div>
      )}

      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gold hover:bg-gold-strong shadow-xl flex items-center justify-center transition-all"
      >
        <Plus size={26} className="text-white" />
      </button>

      {showCreate && <IncomeCreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(0); }} />}
      {detailVoucher && (
        <IncomeDetailModal voucher={detailVoucher}
          onClose={() => setDetailVoucher(null)} onEdit={handleEdit}
          onChanged={() => load(page)} />
      )}
      {editVoucher && (
        <IncomeCreateModal editVoucher={editVoucher}
          onClose={() => setEditVoucher(null)}
          onCreated={() => { setEditVoucher(null); load(0); }} />
      )}

      {/* ── Export Modal ── */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Download size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Xuất báo cáo phiếu thu</h3>
                  <p className="text-white/70 text-[10px]">File Excel · gồm hóa đơn liên kết</p>
                </div>
              </div>
              <button onClick={() => setShowExport(false)}
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {/* Khoảng thời gian đang chọn */}
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/28 px-4 py-3">
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 uppercase tracking-wider mb-1">Khoảng thời gian</p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatDate(currentRange.from).split(' ').slice(1).join(' ')}
                  {' — '}
                  {formatDate(currentRange.to).split(' ').slice(1).join(' ')}
                </p>
                <p className="text-[10px] text-emerald-500 mt-1 italic">Theo bộ lọc ngày đang chọn</p>
              </div>

              {/* Phương thức thanh toán */}
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Phương thức thanh toán</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: 'CASH', label: 'Tiền mặt' },
                    { key: 'BANK_TRANSFER', label: 'Chuyển khoản' },
                    { key: 'ALL', label: 'Cả 2' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setExportPaymentType(opt.key)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        exportPaymentType === opt.key
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-surface text-ink-2 border-line hover:bg-surface-2'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {exportPaymentType === 'ALL' && (
                  <p className="text-[10px] text-emerald-500 mt-1 italic">File sẽ có thêm cột "Phương thức thanh toán"</p>
                )}
              </div>

              {/* Các cột sẽ có */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Nội dung file</p>
                {[
                  'Thời gian tạo phiếu thu',
                  'Số phiếu thu',
                  'Hóa đơn thu (mỗi đơn 1 dòng)',
                  ...(exportPaymentType === 'ALL' ? ['Phương thức thanh toán'] : []),
                  'Tổng tiền thu',
                ].map(col => (
                  <div key={col} className="flex items-center gap-2 text-xs text-ink-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    {col}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowExport(false)}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-surface-2 transition-colors font-medium">
                Hủy
              </button>
              <button onClick={handleExport} disabled={exporting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-600 disabled:opacity-40 transition-colors">
                {exporting
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xuất...</>
                  : <><Download size={14} /> Xuất Excel</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeCard({ v, onClick }) {
  const isBankTransfer = v.paymentType === 'BANK_TRANSFER';
  const hasOverpay = v.overpay && v.overpay.amount > 0 && !v.overpay.refundVoucherCode;
  return (
    <div onClick={onClick} className={`bg-surface rounded-2xl border shadow-sm p-4 hover:shadow-md transition cursor-pointer ${hasOverpay ? 'border-orange-300 dark:border-orange-500/40 hover:border-orange-400' : 'border-hairline hover:border-gold/40'}`}>
      {/* Row 1: mã + badge + tiền */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold text-gold">Số phiếu thu {v.receiptNumber || v.voucherCode}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isBankTransfer ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300' : 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-300'}`}>
            {isBankTransfer ? 'CK' : 'TM'}
          </span>
          {hasOverpay && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-500/28">
              Thu dư {new Intl.NumberFormat('vi-VN').format(v.overpay.amount)} đ
            </span>
          )}
        </div>
        <p className="font-bold text-ink text-sm">{new Intl.NumberFormat('vi-VN').format(v.totalAmount || 0)} đ</p>
      </div>
      {/* Row 2: lý do */}
      <p className="text-sm font-semibold text-ink truncate mb-1.5">{v.reason}</p>
      {/* Row 3: meta info */}
      <div className="flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-1.5 min-w-0">
          {v.payerName && <span className="truncate max-w-[110px]">{v.payerName}</span>}
          {v.linkedOrderCodes?.length > 0 && <span className="text-gold flex-shrink-0">· {v.linkedOrderCodes.length} đơn</span>}
        </div>
        <span className="flex-shrink-0">{formatDate(v.createdAt)}</span>
      </div>
      {isBankTransfer && v.bankName && <p className="text-xs text-blue-500 mt-1">{v.bankName} · {v.bankRef}</p>}
      <p className="text-xs text-muted mt-0.5">Bởi {v.createdByName}</p>
      {v.lastEditedAt && (
        <p className="text-[11px] text-amber-600 dark:text-amber-300 mt-0.5 italic">
          Lần chỉnh sửa gần nhất bởi {v.lastEditedByName} vào lúc {formatDate(v.lastEditedAt)}
        </p>
      )}
    </div>
  );
}