// src/pages/accountant/ExpenseListPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { expenseApi, downloadBlob } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import DateRangePicker from '../../components/ui/DateRangePicker';
import {
  Receipt, Search, ChevronLeft, ChevronRight,
  X, Plus, CheckCircle, XCircle, Clock,
  Building2, Eye, TrendingDown, TrendingUp, Wallet,
  Landmark, ShieldCheck, Filter,
  Download, Upload, Loader2, AlertTriangle, FileSpreadsheet, ListChecks,
  ArrowLeft, // Thêm icon ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ExpenseBulkActionModal, { canApproveVoucher } from '../../components/expense/ExpenseBulkActionModal';
import ExpenseCreateModal from './ExpenseCreateModal';
import ExpenseDetailModal from './ExpenseDetailModal';
import { formatVND } from '../../utils/format.js';

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

function getStartOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getEndOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

function getCurrentMonthRange() {
  const start = getStartOfMonth();
  const end = getEndOfMonth();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return {
    from: start.getTime(),
    to: end.getTime()
  };
}

function SupplierNavButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = pathname.startsWith('/super-accountant') ? '/super-accountant'
    : pathname.startsWith('/accountant') ? '/accountant'
      : pathname.startsWith('/admin') ? '/admin'
        : pathname.startsWith('/owner') ? '/owner' : '/accountant';
  return (
    <button onClick={() => navigate(`${base}/suppliers`, { state: { from: pathname } })}
      className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs font-semibold text-ink-2 hover:border-gold hover:text-gold transition">
      <Building2 size={14} /> Quản lý NCC & danh mục
    </button>
  );
}

const STATUS_CFG = {
  PENDING: { label: 'Chờ duyệt', cls: 'bg-amber-100 dark:bg-amber-500/18 text-amber-700 dark:text-amber-300', icon: Clock },
  APPROVED: { label: 'Đã duyệt', cls: 'bg-green-100 dark:bg-green-500/18 text-green-700 dark:text-green-300', icon: CheckCircle },
  REJECTED: { label: 'Từ chối', cls: 'bg-red-100 dark:bg-red-500/18 text-red-600 dark:text-red-300', icon: XCircle },
};
const PAGE_SIZE = 10;

export default function ExpenseListPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const searchDebounce = useRef(null);
  const searchTextRef = useRef('');
  const fileInputRef = useRef(null);

  const initialMonthRange = getCurrentMonthRange();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [dateRange, setDateRange] = useState(initialMonthRange);
  const [searchText, setSearchText] = useState('');
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [detailVoucher, setDetailVoucher] = useState(null);
  const [creatorFilter, setCreatorFilter] = useState('');
  const [approverFilter, setApproverFilter] = useState('');
  const [downloadingTpl, setDownloadingTpl] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPaymentType, setExportPaymentType] = useState('ALL');

  const [selectedMap, setSelectedMap] = useState(new Map());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const selectedList = Array.from(selectedMap.values());
  const selectedTotal = selectedList.reduce((s, v) => s + Number(v.totalAmount || 0), 0);

  const toggleSelect = (v) => setSelectedMap(prev => {
    const next = new Map(prev);
    if (next.has(v.id)) next.delete(v.id); else next.set(v.id, v);
    return next;
  });

  const removeSelected = (id) => setSelectedMap(prev => {
    const next = new Map(prev); next.delete(id); return next;
  });
  const clearSelected = () => setSelectedMap(new Map());
  const removeManySelected = (ids) => setSelectedMap(prev => {
    const next = new Map(prev); ids.forEach(id => next.delete(id)); return next;
  });

  const calcTotal = (list) => list.reduce((s, v) => s + (Number(v.totalAmount) || 0), 0);

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const q = searchTextRef.current.trim();

      const userPickedRange = dateRange !== null;
      const ignoreDateForSearch = !!q && !userPickedRange;

      const range = dateRange || getCurrentMonthRange();

      // ─── ĐIỀU CHỈNH TIMESTAMP CHO TIMEZONE ───────────────────────────────
      let from = ignoreDateForSearch ? undefined : range.from;
      let to = ignoreDateForSearch ? undefined : range.to;

      if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);

        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);

        // Cộng thêm 7 tiếng (UTC+7)
        from = fromDate.getTime() + (7 * 60 * 60 * 1000);
        to = toDate.getTime() + (7 * 60 * 60 * 1000);
      }

      const res = q
        ? await expenseApi.searchByExpenseDate(q, from, to, {
          page: p,
          size: PAGE_SIZE,
          sort: 'expenseDate,desc'
        })
        : await expenseApi.listByExpenseDate(from, to, {
          page: p,
          size: PAGE_SIZE,
          sort: 'expenseDate,desc'
        });

      const data = res.data?.data || res.data || {};
      const content = data.content || [];
      setVouchers(content);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
      setTotalAmount(calcTotal(content));
      setPage(p);
    } catch (e) {
      console.error('Load error:', e);
      toast('Lỗi tải danh sách', 'error');
    }
    finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { load(0); }, [dateRange]);

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

  const handleDownloadTemplate = async () => {
    setDownloadingTpl(true);
    try {
      const res = await expenseApi.downloadImportTemplate();
      const today = todayStr().replace(/-/g, '');
      downloadBlob(res.data, `mau-nhap-phieu-chi-${today}.xlsx`);
    } catch {
      toast('Không tải được file mẫu', 'error');
    } finally {
      setDownloadingTpl(false);
    }
  };

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const res = await expenseApi.importExcel(file);
      const data = res.data?.data || res.data || {};
      setImportResult(data);
      if ((data.created || 0) > 0) {
        toast(`Đã tạo ${data.created} phiếu chi từ Excel`, 'success');
        load(0);
      } else if ((data.failed || 0) > 0) {
        toast('Không tạo được phiếu nào — xem chi tiết lỗi', 'error');
      }
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi nhập file Excel', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleExportReport = async () => {
    const range = dateRange || getCurrentMonthRange();
    setExporting(true);
    try {
      const res = await expenseApi.exportReport(range.from, range.to, exportPaymentType);
      const d = new Date(range.from);
      const dEnd = new Date(range.to);
      const fmt = (dt) => `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
      downloadBlob(res.data, `phieu-chi-${fmt(d)}_${fmt(dEnd)}.xlsx`);
      toast('Xuất báo cáo thành công', 'success');
      setShowExport(false);
    } catch {
      toast('Lỗi xuất báo cáo', 'error');
    } finally {
      setExporting(false);
    }
  };

  const currentRange = dateRange || getCurrentMonthRange();

  function formatExpenseDate(v) {
    if (!v) return '';
    if (v.expensePeriod) {
      const [year, month] = v.expensePeriod.split('-');
      return `Kỳ Tháng ${parseInt(month)}/${year}`;
    }
    if (v.expenseDate) {
      const d = new Date(v.expenseDate);
      return `Ngày ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
    return '';
  }

  const creatorOptions = [...new Set(vouchers.map(v => v.createdByName).filter(Boolean))];
  const approverOptions = [...new Set(vouchers.map(v => v.approvedByName).filter(Boolean))];
  const displayed = vouchers.filter(v =>
    (!creatorFilter || v.createdByName === creatorFilter) &&
    (!approverFilter || v.approvedByName === approverFilter)
  );

  const selectableOnPage = displayed.filter(v => canApproveVoucher(v, role));
  const canBulk = selectableOnPage.length > 0 || selectedList.length > 0;
  const allPageSelected = selectableOnPage.length > 0
    && selectableOnPage.every(v => selectedMap.has(v.id));
  const togglePageAll = () => setSelectedMap(prev => {
    const next = new Map(prev);
    if (allPageSelected) selectableOnPage.forEach(v => next.delete(v.id));
    else selectableOnPage.forEach(v => next.set(v.id, v));
    return next;
  });

  // ─── Xử lý nút Back ──────────────────────────────────────────────────────
  const handleBack = () => {
    // Nếu có state từ trang trước (ví dụ OwnerCashflowPage), quay lại đó
    if (location.state?.from) {
      navigate(location.state.from);
    } else {
      // Nếu không, quay lại trang trước đó trong lịch sử
      navigate(-1);
    }
  };

  // Hàm render pagination
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 7;
    let startPage = 0;
    let endPage = totalPages - 1;

    if (totalPages > maxVisible) {
      const half = Math.floor(maxVisible / 2);
      if (page <= half) {
        startPage = 0;
        endPage = maxVisible - 1;
      } else if (page >= totalPages - half - 1) {
        startPage = totalPages - maxVisible;
        endPage = totalPages - 1;
      } else {
        startPage = page - half;
        endPage = page + half;
      }
    }

    // Nút Previous
    pages.push(
      <button
        key="prev"
        disabled={page === 0}
        onClick={() => load(page - 1)}
        className="p-2 rounded-lg border border-hairline-2 hover:bg-canvas disabled:opacity-30 transition"
      >
        <ChevronLeft size={16} />
      </button>
    );

    // Nếu startPage > 0, hiển thị trang đầu và dấu ...
    if (startPage > 0) {
      pages.push(
        <button
          key={0}
          onClick={() => load(0)}
          className="w-9 h-9 rounded-lg text-sm font-semibold border border-hairline-2 hover:bg-canvas text-ink transition"
        >
          1
        </button>
      );
      if (startPage > 1) {
        pages.push(
          <span key="ellipsis-start" className="w-9 h-9 flex items-center justify-center text-muted">
            ...
          </span>
        );
      }
    }

    // Các trang trong khoảng visible
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => load(i)}
          className={`w-9 h-9 rounded-lg text-sm font-semibold transition ${i === page ? 'bg-gold text-white' : 'border border-hairline-2 hover:bg-canvas text-ink'
            }`}
        >
          {i + 1}
        </button>
      );
    }

    // Nếu endPage < totalPages - 1, hiển thị dấu ... và trang cuối
    if (endPage < totalPages - 1) {
      if (endPage < totalPages - 2) {
        pages.push(
          <span key="ellipsis-end" className="w-9 h-9 flex items-center justify-center text-muted">
            ...
          </span>
        );
      }
      pages.push(
        <button
          key={totalPages - 1}
          onClick={() => load(totalPages - 1)}
          className="w-9 h-9 rounded-lg text-sm font-semibold border border-hairline-2 hover:bg-canvas text-ink transition"
        >
          {totalPages}
        </button>
      );
    }

    // Nút Next
    pages.push(
      <button
        key="next"
        disabled={page >= totalPages - 1}
        onClick={() => load(page + 1)}
        className="p-2 rounded-lg border border-hairline-2 hover:bg-canvas disabled:opacity-30 transition"
      >
        <ChevronRight size={16} />
      </button>
    );

    return (
      <div className="flex items-center justify-center gap-2 pt-2">
        {pages}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 pb-24">
      {/* ─── Header với nút Back ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleBack}
          className="p-2 rounded-xl hover:bg-canvas transition-colors text-muted hover:text-ink"
          title="Quay lại"
        >
          <ArrowLeft size={20} />
        </button>
        <Receipt size={22} className="text-gold" />
        <h1 className="text-xl font-bold text-ink">Phiếu chi</h1>
        <span className="text-xs text-muted ml-1">{totalElements} phiếu</span>
        <SupplierNavButton />
      </div>

      <div className="bg-gradient-to-r from-gold/10 to-gold/5 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted font-medium">
            {searchText ? `Tìm "${searchText}" trong kỳ` : 'Tổng chi trong kỳ'}
          </p>
          <p className="text-2xl font-bold text-gold mt-0.5">{formatVND(totalAmount)}</p>
        </div>
        <TrendingDown size={28} className="text-gold/40" />
      </div>

      {/* Nhập từ Excel */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleDownloadTemplate}
          disabled={downloadingTpl}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-surface text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-50 transition"
        >
          {downloadingTpl ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} className="text-gold" />}
          Tải template
        </button>
        <button
          onClick={handlePickFile}
          disabled={importing}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold hover:bg-gold-strong text-sm font-semibold text-white disabled:opacity-60 transition"
        >
          {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {importing ? 'Đang nhập...' : 'Tạo từ file Excel'}
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-surface text-sm font-semibold text-ink hover:bg-canvas transition"
        >
          <FileSpreadsheet size={15} className="text-gold" />
          Export báo cáo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchText}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Tìm số phiếu chi, lý do, nhà cung cấp, số tiền..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-line text-sm bg-surface focus:outline-none focus:border-gold"
          />
          {searchText && (
            <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex-shrink-0">
          <DateRangePicker
            from={currentRange.from}
            to={currentRange.to}
            onChange={handleDateRangeChange}
            placeholder="Chọn ngày"
            align="right"
          />
        </div>
        {dateRange && (
          <button onClick={() => setDateRange(null)} className="p-2 rounded-xl border border-line text-muted hover:bg-canvas transition flex-shrink-0" title="Về hôm nay">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Bộ lọc người tạo / người duyệt */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs text-muted font-medium">
          <Filter size={12} /> Lọc:
        </span>
        <select value={creatorFilter} onChange={e => setCreatorFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-line text-xs bg-surface focus:outline-none focus:border-gold max-w-[45%]">
          <option value="">Tất cả người tạo</option>
          {creatorOptions.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={approverFilter} onChange={e => setApproverFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-line text-xs bg-surface focus:outline-none focus:border-gold max-w-[45%]">
          <option value="">Tất cả người duyệt</option>
          {approverOptions.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {(creatorFilter || approverFilter) && (
          <button onClick={() => { setCreatorFilter(''); setApproverFilter(''); }}
            className="text-xs text-gold hover:underline font-semibold">Xoá lọc</button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-surface-2 rounded-2xl animate-pulse" />)}</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <Receipt size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Không có phiếu chi nào</p>
          <p className="text-sm mt-1">{searchText || creatorFilter || approverFilter ? 'Thử điều kiện lọc khác' : 'Trong khoảng thời gian này'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {canBulk && (
            <label className="flex items-center gap-2 px-1 pb-1 text-xs text-muted cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                checked={allPageSelected}
                disabled={selectableOnPage.length === 0}
                onChange={togglePageAll}
                className="w-4 h-4 rounded border-gold/60 text-gold focus:ring-gold/40 disabled:opacity-30"
              />
              Chọn tất cả phiếu duyệt được ở trang này ({selectableOnPage.length})
            </label>
          )}

          {displayed.map(v => {
            const s = STATUS_CFG[v.status] || STATUS_CFG.PENDING;
            const StatusIcon = s.icon;
            const isBank = v.paymentType === 'BANK_TRANSFER';
            const selectable = canApproveVoucher(v, role);
            const checked = selectedMap.has(v.id);
            const expenseLabel = formatExpenseDate(v);

            return (
              <div key={v.id} onClick={() => setDetailVoucher(v)}
                className={`bg-surface rounded-2xl border shadow-sm p-4 hover:border-gold/40 hover:shadow-md transition cursor-pointer ${checked ? 'border-gold ring-1 ring-gold/30' : 'border-hairline'
                  }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={checked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(v)}
                        title="Chọn phiếu để duyệt/từ chối hàng loạt"
                        className="w-4 h-4 rounded border-gold/60 text-gold focus:ring-gold/40 cursor-pointer"
                      />
                    )}
                    <span className="font-mono text-xs font-bold text-gold">Số phiếu chi {v.paymentNumber || v.voucherCode}</span>
                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>
                      <StatusIcon size={9} /> {s.label}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${isBank ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
                      {isBank ? <Landmark size={9} /> : <Wallet size={9} />} {isBank ? 'CK' : 'Tiền mặt'}
                    </span>
                    {v.voucherType === 'VENDOR_DEBT_PAYMENT' && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        <Wallet size={9} /> Trả công nợ NCC
                      </span>
                    )}
                    {expenseLabel && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/28">
                        <Clock size={9} /> {expenseLabel}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-ink text-sm">{formatVND(v.totalAmount)}</p>
                </div>
                <p className="text-sm font-semibold text-ink truncate mb-1.5">Nội dung: {v.reason}</p>
                <div className="flex items-center justify-between text-xs text-muted">
                  <div className="flex items-center gap-1.5 min-w-0">
                    Người nhận / NCC: {v.vendorName && <span className="flex items-center gap-1">{v.vendorName}</span>}
                  </div>
                  <span className="flex-shrink-0">Tạo: {formatDate(v.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-muted">Tạo bởi {v.createdByName}</p>
                  {v.approvedByName ? (
                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-gold/10 text-gold-strong">
                      <ShieldCheck size={9} /> Người duyệt: {v.approvedByName}
                    </span>
                  ) : v.status === 'PENDING' && (
                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300">
                      <Clock size={9} /> {v.approverScope === 'SUPER_ACCOUNTANT' ? 'Chờ KT trưởng' : 'Chờ chủ/quản trị'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renderPagination()}

      {selectedList.length > 0 && (
        <div className="sticky bottom-4 z-40 mx-auto max-w-2xl">
          <div className="bg-forest-deep text-white rounded-2xl shadow-2xl px-4 py-3 flex flex-wrap items-center gap-3">
            <ListChecks size={18} className="text-gold flex-shrink-0" />
            <div className="flex-1 min-w-[130px]">
              <p className="text-sm font-bold">Đã chọn {selectedList.length} phiếu</p>
              <p className="text-xs text-white/60">Tổng {formatVND(selectedTotal)}</p>
            </div>
            <button onClick={() => setBulkModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition">
              Xem danh sách
            </button>
            <button onClick={clearSelected}
              className="px-3 py-2 rounded-xl border border-white/20 hover:bg-white/10 text-xs font-semibold transition">
              Bỏ chọn hết
            </button>
            <button onClick={() => setBulkModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gold hover:bg-gold-strong text-xs font-bold transition">
              Duyệt / Từ chối
            </button>
          </div>
        </div>
      )}

      {bulkModalOpen && (
        <ExpenseBulkActionModal
          vouchers={selectedList}
          onRemove={removeSelected}
          onClose={() => setBulkModalOpen(false)}
          onDone={(res) => {
            const okIds = (res?.results || []).filter(r => r.success).map(r => r.id);
            if (okIds.length) removeManySelected(okIds); else clearSelected();
            load(page);
          }}
        />
      )}

      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gold hover:bg-gold-strong shadow-xl flex items-center justify-center transition-all"
      >
        <Plus size={26} className="text-white" />
      </button>

      {showCreate && <ExpenseCreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(0); }} />}
      {detailVoucher && <ExpenseDetailModal voucher={detailVoucher} onClose={() => setDetailVoucher(null)} onChanged={() => load(page)} />}

      {/* ── Export báo cáo Modal ── */}
      {showExport && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => !exporting && setShowExport(false)}>
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-gold to-gold-strong px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <Download size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Xuất báo cáo phiếu chi</h3>
                  <p className="text-white/70 text-[10px]">File Excel · gộp khoản chi theo phiếu</p>
                </div>
              </div>
              <button onClick={() => setShowExport(false)}
                className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="rounded-xl bg-canvas border border-line px-4 py-3">
                <p className="text-[10px] font-bold text-gold-strong uppercase tracking-wider mb-1">Khoảng thời gian</p>
                <p className="text-sm font-semibold text-ink-2">
                  {formatDate(currentRange.from).split(' ').slice(1).join(' ')}
                  {' — '}
                  {formatDate(currentRange.to).split(' ').slice(1).join(' ')}
                </p>
                <p className="text-[10px] text-gold mt-1 italic">Theo bộ lọc ngày đang chọn (mặc định hôm nay)</p>
              </div>

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
                      className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${exportPaymentType === opt.key
                        ? 'bg-gold text-white border-gold'
                        : 'bg-surface text-ink-2 border-line hover:bg-surface-2'
                        }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {exportPaymentType === 'ALL' && (
                  <p className="text-[10px] text-gold mt-1 italic">File sẽ có thêm cột "Phương thức thanh toán"</p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Nội dung file</p>
                {[
                  'Thời gian tạo · Trạng thái · Thời gian duyệt',
                  'Người tạo · Người duyệt · Nhà cung cấp',
                  'Thời gian/Kỳ · Nội dung · Tổng tiền',
                  ...(exportPaymentType === 'ALL' ? ['Phương thức thanh toán'] : []),
                  'Danh mục khoản chi · Số tiền mỗi khoản',
                ].map(col => (
                  <div key={col} className="flex items-center gap-2 text-xs text-ink-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />
                    {col}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowExport(false)} disabled={exporting}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-ink-2 hover:bg-surface-2 transition-colors font-medium disabled:opacity-50">
                Huỷ
              </button>
              <button onClick={handleExportReport} disabled={exporting}
                className="flex-1 py-2.5 rounded-xl bg-gold hover:bg-gold-strong text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
                {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {exporting ? 'Đang xuất...' : 'Xuất Excel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {importResult && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setImportResult(null)}>
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-hairline">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-gold" />
                <h3 className="font-bold text-ink">Kết quả nhập từ Excel</h3>
              </div>
              <button onClick={() => setImportResult(null)} className="p-1.5 rounded-xl hover:bg-canvas text-muted">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-canvas p-3">
                  <p className="text-2xl font-bold text-ink">{importResult.totalVouchers || 0}</p>
                  <p className="text-xs text-muted mt-0.5">Tổng phiếu</p>
                </div>
                <div className="rounded-xl bg-green-50 dark:bg-green-500/10 p-3">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-300">{importResult.created || 0}</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">Thành công</p>
                </div>
                <div className="rounded-xl bg-red-50 dark:bg-red-500/10 p-3">
                  <p className="text-2xl font-bold text-red-500">{importResult.failed || 0}</p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">Bị lỗi</p>
                </div>
              </div>

              {Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-amber-500" /> Các phiếu chưa nhập được:
                  </p>
                  <div className="space-y-2">
                    {importResult.errors.map((er, i) => (
                      <div key={i} className="rounded-xl border border-red-100 dark:border-red-500/18 bg-red-50/50 dark:bg-red-500/5 p-3 text-sm">
                        <p className="font-semibold text-ink">
                          {er.groupKey ? `Số phiếu chi "${er.groupKey}"` : 'Phiếu'} <span className="text-xs text-muted font-normal">(dòng {er.excelRow})</span>
                        </p>
                        <p className="text-red-600 dark:text-red-300 text-xs mt-0.5">{er.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(importResult.created || 0) > 0 && (importResult.failed || 0) === 0 && (
                <div className="rounded-xl bg-green-50 dark:bg-green-500/10 p-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle size={16} /> Đã nhập tất cả phiếu chi thành công.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-hairline">
              <button onClick={() => setImportResult(null)}
                className="w-full py-2.5 rounded-xl bg-gold hover:bg-gold-strong text-white text-sm font-semibold transition">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}