import { useLang } from '../../context/LangContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  ShoppingCart, Search, Eye, Ban,
  User, Users, X,
  Download, FileText, FileBarChart,
} from 'lucide-react';
import { adminOrderApi, getImageUrl } from '../../api/adminApi';
import { downloadBlob, orderApi } from '../../api/services';
import { OrderStatusBadge } from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import OrderDetailModal from '../../components/seller/OrderDetailModal.jsx';
import Pagination from '../../components/ui/Pagination';
import DateRangePicker from '../../components/ui/DateRangePicker';
import useDebounce from '../../utils/useDebounce.js';
import {
  PageHeader, LoadingSpinner, EmptyState,
  SecondaryButton, DangerButton,
  Field, inputCls, formatCurrency, formatNumber, formatDateTime,
} from '../../components/ui';



// ── Customer filter ──────────────────────────────────────────────────────────
function CustomerFilter({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [allOptions, setAllOptions] = useState([]);   // toàn bộ list từ API
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const ref = useRef(null);

  // debounce query để lọc + gọi API khi gõ
  const debouncedQuery = useDebounce(query, 600);

  // Fetch từ API search customer của admin — chỉ gọi lại khi debouncedQuery thay đổi
  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    adminOrderApi.searchCustomers(debouncedQuery || '')
      .then(items => {
        if (cancelled) return;
        setAllOptions(Array.isArray(items) ? items : []);
      })
      .catch(() => { if (!cancelled) setAllOptions([]); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    // Reset query khi mở để load lại full list
    if (!open) setQuery('');
  };

  const handleSelect = (c) => {
    const displayName = c.companyName || c.name || 'Khách lẻ';
    onChange({ id: c.id, name: displayName });
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
  };

  return (
    <div ref={ref} className="relative sm:w-56">
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full flex items-center gap-2 px-3 h-[38px] rounded-xl border text-sm transition-colors
          ${value ? 'border-gold bg-gold/5 text-ink' : 'border-line bg-surface text-muted'}
          hover:border-gold/60`}>
        <Users size={14} className={value ? 'text-gold' : 'text-muted'} />
        <span className="flex-1 text-left truncate text-xs">
          {value?.name || 'Lọc theo khách hàng'}
        </span>
        {value
          ? <X size={13} className="text-muted hover:text-red-500 shrink-0" onClick={handleClear} />
          : <Search size={13} className="text-faint shrink-0" />}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-72 bg-surface border border-line rounded-2xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-line-soft">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Tìm tên, SĐT khách hàng..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-line rounded-xl focus:outline-none focus:border-gold bg-canvas"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {fetching ? (
              <div className="flex justify-center py-5">
                <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : allOptions.length === 0 ? (
              <p className="text-xs text-muted text-center py-5">Không tìm thấy</p>
            ) : (
              allOptions.map(c => {
                const displayName = c.companyName || c.name || 'Khách lẻ';
                const isCompany = c.customerType === 'COMPANY';
                const isSelected = value?.id === c.id;
                const initial = displayName[0]?.toUpperCase() || '?';
                return (
                  <button key={c.id} type="button"
                    onClick={() => handleSelect(c)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-canvas transition-colors
                      ${isSelected ? 'bg-gold/10' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold
                      ${isCompany ? 'bg-gold/20 text-gold' : 'bg-surface-2 text-muted'}`}>
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-ink truncate">{displayName}</p>
                      {c.phone && <p className="text-[10px] text-muted">{c.phone}</p>}
                    </div>
                    {isSelected
                      ? <div className="w-2 h-2 rounded-full bg-gold shrink-0" />
                      : <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0
                          ${isCompany ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'bg-surface-2 text-muted'}`}>
                          {isCompany ? 'Cty' : 'Lẻ'}
                        </span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Spinner nhỏ ──────────────────────────────────────────────────────────────
function BtnSpinner({ size = 13, colorClass = 'border-current' }) {
  return <div style={{ width: size, height: size }} className={`border-2 ${colorClass} border-t-transparent rounded-full animate-spin flex-shrink-0`} />;
}

// ── Invoice button ────────────────────────────────────────────────────────────
function InvoiceButton({ order, invoiceLoadingId, onInvoice }) {
  const isCancelled = order.status === 'CANCELLED';
  const isThisLoading = invoiceLoadingId === order.id;
  const isOtherLoading = !!invoiceLoadingId && !isThisLoading;
  const isDisabled = isCancelled || !!invoiceLoadingId;
  return (
    <button
      onClick={e => { e.stopPropagation(); if (!isCancelled) onInvoice(order.id, e); }}
      disabled={isDisabled}
      title={isCancelled ? 'Đơn đã huỷ' : 'Xuất hoá đơn PDF'}
      className={`relative p-1.5 rounded-lg border transition-all duration-200
        ${isCancelled
          ? 'bg-surface-2 text-faint border-line-soft cursor-not-allowed opacity-40'
          : isThisLoading
            ? 'bg-gold/15 text-gold border-gold/40 cursor-wait ring-2 ring-gold/30 ring-offset-1'
            : isOtherLoading
              ? 'bg-surface-2 text-faint border-line-soft cursor-not-allowed opacity-40'
              : 'bg-gold/10 text-gold border-transparent hover:bg-gold/20 hover:scale-105 active:scale-95'}`}>
      {isThisLoading
        ? <BtnSpinner size={13} colorClass="border-gold !border-t-transparent" />
        : <FileText size={13} />}
      {isThisLoading && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium bg-chrome text-white px-2 py-0.5 rounded-md pointer-events-none z-10">
          Đang tạo...
        </span>
      )}
    </button>
  );
}

// ── Seller badge ──────────────────────────────────────────────────────────────
function SellerBadge({ name }) {
  if (!name) return <span className="text-faint text-xs">—</span>;
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-full h-6 px-2 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center shrink-0">
        {name}
      </span>
    </span>
  );
}

export default function AdminOrders() {
  const { t } = useLang();
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useMinLoading();

  const STATUS_OPTIONS = [
    { value: '', label: t('admin', 'all_status') },
    { value: 'PREPARING', label: t('status', 'preparing') },
    { value: 'DELIVERING', label: t('status', 'delivering_short') },
    { value: 'PENDING_PAYMENT', label: t('status', 'pending_payment') },
    { value: 'COMPLETED', label: t('status', 'completed') },
    { value: 'CANCELLED', label: t('status', 'cancelled2') },
  ];





  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(null);
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDateRange, setReportDateRange] = useState({ from: null, to: null });
  const [reportCategories, setReportCategories] = useState([]);
  const [reportCategoryId, setReportCategoryId] = useState('');
  const [exportingReport, setExportingReport] = useState(false);


  useEffect(() => {
    if (showReportModal) {
      orderApi.getReportCategories()
        .then(res => setReportCategories(res.data?.data ?? res.data ?? []))
        .catch(() => {});
    }
  }, [showReportModal]);

  const handleReportExport = async () => {
    if (!reportDateRange.from || !reportDateRange.to) { alert('Vui lòng chọn khoảng thời gian'); return; }
    setExportingReport(true);
    try {
      const fromDate = new Date(reportDateRange.from); fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(reportDateRange.to); toDate.setHours(23, 59, 59, 999);
      const res = await orderApi.exportCustomerProductReport({
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
        ...(reportCategoryId ? { categoryId: reportCategoryId } : {}),
      });
      downloadBlob(res.data, `bao-cao-kh-sp-${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.xlsx`);
      setShowReportModal(false); setReportDateRange({ from: null, to: null }); setReportCategoryId('');
    } catch {
      alert('Không thể xuất báo cáo');
    } finally { setExportingReport(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (debouncedQ) params.q = debouncedQ;
      if (dateRange.from) params.from = new Date(dateRange.from).setHours(0, 0, 0, 0);
      if (dateRange.to) params.to = new Date(dateRange.to).setHours(23, 59, 59, 999);
      if (filters.productId) params.productId = filters.productId;
      if (selectedCustomer?.id) params.customerId = selectedCustomer.id;
      const res = await adminOrderApi.exportOrders(params);
      downloadBlob(res.data, `don-hang-admin-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`);
    } catch {
      alert('Không thể xuất file Excel');
    } finally {
      setExporting(false);
    }
  };


  const debouncedQ = useDebounce(filters.q, 600);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: 20, sort: 'createdAt,desc' };
      if (debouncedQ) params.q = debouncedQ;
      if (filters.status) params.status = filters.status;
      if (dateRange.from) params.fromDate = new Date(dateRange.from).setHours(0, 0, 0, 0);
      if (dateRange.to) params.toDate = new Date(dateRange.to).setHours(23, 59, 59, 999);
      if (filters.productId) params.productId = filters.productId;
      if (selectedCustomer?.id) params.customerId = selectedCustomer.id;
      const res = await adminOrderApi.list(params);
      setData(res);
    } finally { setLoading(false); }
  }, [page, debouncedQ, filters.status, dateRange, filters.productId, selectedCustomer]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    setDetailLoading(id);
    try {
      const order = await adminOrderApi.getById(id);
      setDetailOrder({ ...order, logs: order.logs || [] });
      setDetailOpen(true);
    } catch { alert('Lỗi tải chi tiết'); }
    finally { setDetailLoading(null); }
  };

  const handleInvoice = async (orderId, e) => {
    if (e) e.stopPropagation();
    if (invoiceLoadingId) return;
    setInvoiceLoadingId(orderId);
    try {
      const res = await adminOrderApi.downloadInvoice(orderId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch { alert('Không thể tải hoá đơn'); }
    finally { setInvoiceLoadingId(null); }
  };

  const openCancel = (order) => {
    setCancelTarget(order);
    setCancelReason('');
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await adminOrderApi.cancel(cancelTarget.id, cancelReason);
      setCancelOpen(false);
      if (detailOpen && detailOrder?.id === cancelTarget.id) setDetailOpen(false);
      load();
    } catch (e) {
      alert(e?.response?.data?.message || e.message || 'Hủy đơn thất bại');
    } finally { setCancelling(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader icon={ShoppingCart} title="Đơn hàng" subtitle={`Tổng ${formatNumber(data.totalElements)} đơn`} />

      {/* Filters */}
      <div className="bg-surface rounded-2xl border border-hairline p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input type="text" placeholder="Tìm theo mã đơn, tên khách, SĐT..."
            value={filters.q}
            onChange={e => { setFilters({ ...filters, q: e.target.value }); setPage(0); }}
            className={`${inputCls} pl-9`} />
        </div>
        <select value={filters.status}
          onChange={e => { setFilters({ ...filters, status: e.target.value }); setPage(0); }}
          className={`${inputCls} sm:w-52`}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex-shrink-0 [&>*]:h-[38px] [&_button]:h-[38px] [&_button]:rounded-xl">
          <DateRangePicker
            from={dateRange.from} to={dateRange.to}
            onChange={r => { setDateRange(r); setPage(0); }}
            placeholder="Khoảng ngày" />
        </div>
        <CustomerFilter
          value={selectedCustomer}
          onChange={c => { setSelectedCustomer(c); setPage(0); }} />
        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/28
    hover:bg-emerald-100 dark:bg-emerald-500/18 transition-colors disabled:opacity-60 text-sm font-medium whitespace-nowrap"
          title="Xuất Excel">
          {exporting
            ? <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            : <Download size={15} />}
          Xuất Excel
        </button>
        <button onClick={() => setShowReportModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 text-gold border border-gold/30
    hover:bg-gold/20 transition-colors text-sm font-medium whitespace-nowrap"
          title="Báo cáo KH × Sản phẩm">
          <FileBarChart size={15} /> Báo cáo KH×SP
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton cols={5} rows={8} />
        ) : data.content.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Không có đơn hàng" description="Thử điều chỉnh bộ lọc" />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-canvas text-muted">
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider">Mã đơn</th>
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider">Khách hàng</th>
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider">Seller</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Tổng tiền</th>
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider">Trạng thái</th>
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider">TT</th>
                    <th className="px-4 py-3 text-left   text-xs font-bold uppercase tracking-wider whitespace-nowrap">Ngày tạo</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.content.map(o => (
                    <tr key={o.id} className={`border-t border-hairline hover:bg-canvas/50 transition-colors ${o.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gold whitespace-nowrap">{o.orderCode}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{o.customerName || '—'}</p>
                        {o.customerPhone && <p className="text-xs text-muted">{o.customerPhone}</p>}
                      </td>
                      <td className="px-4 py-3"><SellerBadge name={o.fullName || o.userName} /></td>
                      <td className="px-4 py-3 text-center font-semibold text-ink">{formatCurrency(o.finalAmount)}</td>
                      <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={o.paymentStatus} paidAmount={o.paidAmount} finalAmount={o.finalAmount} orderStatus={o.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <InvoiceButton order={o} invoiceLoadingId={invoiceLoadingId} onInvoice={handleInvoice} />
                          <button
                            onClick={async (e) => { e.stopPropagation(); await openDetail(o.id); }}
                            className="relative p-1.5 rounded-lg border bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300 border-transparent hover:bg-sky-100 dark:bg-sky-500/18 hover:scale-105 active:scale-95 transition-all duration-200"
                            title="Xem chi tiết">
                            {detailLoading === o.id
                              ? <BtnSpinner size={13} colorClass="border-sky-400 !border-t-transparent" />
                              : <Eye size={13} />}
                          </button>
                          {o.status !== 'CANCELLED' && o.status !== 'COMPLETED' && (
                            <button onClick={() => openCancel(o)}
                              className="p-2 rounded-lg text-muted hover:bg-red-50 dark:bg-red-500/10 hover:text-red-600 dark:text-red-300 transition-colors" title="Hủy đơn">
                              <Ban size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-hairline">
              {data.content.map(o => (
                <div key={o.id} className={`p-4 space-y-2.5 ${o.status === 'CANCELLED' ? 'opacity-60' : ''}`}>

                  {/* Row 1: mã đơn + ngày tạo */}
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs font-semibold text-gold">{o.orderCode}</p>
                    <p className="text-[10px] text-muted">{formatDateTime(o.createdAt)}</p>
                  </div>

                  {/* Row 2: tên khách hàng */}
                  <p className="font-semibold text-ink leading-snug">{o.customerName || '—'}</p>

                  {/* Row 3: SĐT khách */}
                  {o.customerPhone && (
                    <p className="text-xs text-muted">📞 {o.customerPhone}</p>
                  )}

                  {/* Row 4: Seller badge */}
                  <div className="flex items-center gap-1.5">
                    <User size={11} className="text-muted" />
                    <SellerBadge name={o.fullName || o.userName} />
                  </div>

                  {/* Row 5: badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <OrderStatusBadge status={o.status} />
                    <PaymentStatusBadge status={o.paymentStatus} paidAmount={o.paidAmount} finalAmount={o.finalAmount} orderStatus={o.status} />
                  </div>

                  {/* Row 6: tổng tiền + actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-hairline">
                    <p className="font-bold text-ink">{formatCurrency(o.finalAmount)}</p>
                    <div className="flex gap-1.5 items-center">
                      <InvoiceButton order={o} invoiceLoadingId={invoiceLoadingId} onInvoice={handleInvoice} />
                      <button onClick={() => openDetail(o.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-canvas text-ink flex items-center gap-1">
                        {detailLoading === o.id
                          ? <BtnSpinner size={11} colorClass="border-muted !border-t-transparent" />
                          : <Eye size={12} />}
                        Chi tiết
                      </button>
                      {o.status !== 'CANCELLED' && o.status !== 'COMPLETED' && (
                        <button onClick={() => openCancel(o)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300">
                          Hủy
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {!loading && data.content.length > 0 && <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />}
      </div>

      {/* Detail modal — dùng OrderDetailModal có sẵn */}
      {detailOpen && detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOpen(false)}
          onRefresh={load}
        />
      )}

      {/* Report modal — KH × Sản phẩm */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowReportModal(false)} />
          <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider">Xuất báo cáo</p>
                <h2 className="font-bold text-ink">Báo cáo KH × Sản phẩm</h2>
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-1.5 rounded-lg text-muted hover:bg-surface-2"><X size={16} /></button>
            </div>
            <p className="text-xs text-muted">Tổng hợp sản lượng & doanh thu theo từng khách hàng, lọc theo danh mục sản phẩm.</p>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Khoảng thời gian</label>
              <DateRangePicker from={reportDateRange.from} to={reportDateRange.to} onChange={r => setReportDateRange(r)} placeholder="Chọn khoảng ngày" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Danh mục sản phẩm</label>
              <select value={reportCategoryId} onChange={e => setReportCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-surface focus:outline-none focus:border-gold">
                <option value="">-- Danh mục mặc định --</option>
                {reportCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-[11px] text-muted mt-1">Để trống sẽ dùng danh mục mặc định (kem).</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowReportModal(false); setReportDateRange({ from: null, to: null }); }}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-muted hover:bg-surface-2">Huỷ</button>
              <button onClick={handleReportExport} disabled={exportingReport || !reportDateRange.from || !reportDateRange.to}
                className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong disabled:opacity-50 flex items-center justify-center gap-2">
                {exportingReport ? <BtnSpinner size={14} colorClass="border-white/40 !border-t-white" /> : <><Download size={14} /> Xuất báo cáo</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      <Modal open={cancelOpen} onClose={() => !cancelling && setCancelOpen(false)} title="Hủy đơn hàng" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <SecondaryButton onClick={() => setCancelOpen(false)} disabled={cancelling}>Không</SecondaryButton>
            <DangerButton onClick={confirmCancel} loading={cancelling}>Xác nhận hủy</DangerButton>
          </div>
        }
      >
        <p className="text-sm text-ink">
          Bạn có chắc muốn hủy đơn <span className="font-semibold text-gold">{cancelTarget?.orderCode}</span>?
        </p>
        <p className="text-xs text-muted mt-1">Đơn sẽ lưu lại với trạng thái "Đã hủy".</p>
        <div className="mt-4">
          <Field label="Lý do hủy" hint="Không bắt buộc">
            <textarea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              placeholder="VD: Khách đổi ý, hết hàng, ..." className={inputCls} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}


function PaymentStatusBadge({ status, paidAmount, finalAmount, orderStatus }) {
  if (orderStatus === 'CANCELLED') {
    return <span className="text-xs text-faint">—</span>;
  }

  const map = {
    PAID: { label: 'Đã TT', cls: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/28' },
    UNPAID: { label: 'Chưa TT', cls: 'text-red-500 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/28' },
    PARTIAL: { label: 'TT 1 phần', cls: 'text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/28' },
  };
  const cfg = map[status] || { label: status, cls: 'text-muted bg-canvas border-line' };

  if (status === 'PARTIAL' && paidAmount != null && finalAmount != null) {
    const remaining = Number(finalAmount) - Number(paidAmount);
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.cls}`}>
          {cfg.label}
        </span>
        <span className={`inline-flex text-[10px] text-emerald-600 dark:text-emerald-300 whitespace-nowrap items-center font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
          Đã thu: {new Intl.NumberFormat('vi-VN').format(Math.round(paidAmount))}đ
        </span>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}