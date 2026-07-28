// src/pages/accountant/AccountantCustomersPage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { accountantApi, reportApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import CustomerOrderHistory from '../../components/admin/CustomerOrderHistory';
import DebtReportCustomerModal from '../../components/accountant/DebtReportCustomerModal';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  Building2, User as UserIcon, Clock3, Download, Upload, FileText,
  ArrowUp, Filter,
} from 'lucide-react';

// ── Debt urgency ──────────────────────────────────────────────────────────────
function getDebtUrgency(customer) {
  const ms = customer.nearestDeadlineMillis;
  if (!ms) return null;
  const days = Math.ceil((ms - Date.now()) / 86400000);
  if (days < 0 || days <= 3) return 'critical';
  if (days <= 6) return 'warning';
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AccountantCustomersPage() {
  const { t } = useLang();
  const toast = useToast();

  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useMinLoading();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');   // '' | 'ACTIVE' | 'LOCKED'
  const [sortDebt, setSortDebt] = useState(false);          // true = công nợ tăng dần
  const [exportingDebt, setExportingDebt] = useState(false);
  const [debtModalOpen, setDebtModalOpen] = useState(false);

  // Format số tiền
  const formatPrice = (n) => {
    if (!n && n !== 0) return '0 đ';
    const num = Number(n);
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + ' tr';
    return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
  };

  // Nguồn dữ liệu cho modal chọn khách hàng (search + phân trang)
  const fetchCustomersForReport = useCallback(async ({ q, page: p = 0, size = 20 }) => {
    const res = await accountantApi.getCustomers({ q: q || undefined, page: p, size });
    const d = res.data?.data || {};
    const content = d.content || [];
    const totalElements = d.totalItems ?? d.totalElements ?? content.length;
    const totalPages = d.totalPages ?? Math.ceil(totalElements / size);
    return { content, totalPages, totalElements };
  }, []);

  // Export báo cáo công nợ.
  // - customerIds là mảng ID → CHỈ xuất đúng những khách được chọn ở modal.
  // - customerIds = null → xuất theo từ khoá đang tìm (hành vi cũ).
  const handleExportAgedReceivables = useCallback(async (customerIds = null) => {
    setExportingDebt(true);
    try {
      const activeFilters = (customerIds && customerIds.length)
        ? { customerIds }
        : { q: search.trim() || undefined };
      const res = await reportApi.exportAgedReceivables(undefined, activeFilters);
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
  }, [toast, search]);

  const [historyCustomerId, setHistoryCustomerId] = useState(null);

  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchCustomers = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = { page: p, size: PAGE_SIZE };
      if (search.trim()) params.q = search.trim();
      if (statusFilter) params.status = statusFilter;   // ACTIVE | LOCKED
      if (sortDebt) params.sort = 'debtAsc';            // sort giữ nguyên filter trạng thái
      const res = await accountantApi.getCustomers(params);
      const data = res.data?.data;
      setCustomers(data?.content || []);
      setTotal(data?.totalItems || data?.totalElements || 0);
      setPage(p);
    } catch {
      toast(t('common', 'error_retry'), 'error');
    } finally { setLoading(false); }
  }, [search, statusFilter, sortDebt]);

  useEffect(() => { fetchCustomers(0); }, [fetchCustomers]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  if (historyCustomerId) {
    return (
      <CustomerOrderHistory
        customerId={historyCustomerId}
        apiPrefix="/api/accountant"
        onBack={() => setHistoryCustomerId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FAF7F2]">
      {/* Header - giữ nguyên */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-[#1C1C1E]">{t('customer', 'customer')}</h1>
            <p className="text-[10px] sm:text-xs text-[#8E8878]">{total} {t('customer', 'customer').toLowerCase()}</p>
          </div>
          <button onClick={() => setDebtModalOpen(true)} disabled={exportingDebt}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] text-xs text-[#5C5C5C] hover:border-[#C9A84C] transition-all disabled:opacity-60">
            {exportingDebt
              ? <span className="w-3 h-3 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
              : <FileText size={13} />}
            {exportingDebt ? 'Đang xuất...' : 'Báo cáo công nợ'}
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] text-xs text-[#5C5C5C] hover:border-[#C9A84C] cursor-pointer transition-all">
            <Upload size={13} /> Import
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => {
              if (e.target.files[0]) toast(t('common', 'info'), 'info');
            }} />
          </label>
          <button onClick={() => toast(t('common', 'info'), 'info')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8DDD0] text-xs text-[#5C5C5C] hover:border-[#C9A84C] transition-all">
            <Download size={13} /> Export
          </button>
          <button onClick={() => fetchCustomers(0)}
            className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input type="text" {...{ placeholder: t("customer", "customer_name") }}
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            className="w-full border border-[#E8DDD0] rounded-xl pl-9 pr-4 py-2 text-sm bg-white
              focus:outline-none focus:border-[#C9A84C]" />
        </div>

        {/* Bộ lọc trạng thái + sắp xếp công nợ */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Dropdown trạng thái: Đang hoạt động / Đang khóa */}
          <div className="relative">
            <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8878] pointer-events-none" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none border border-[#E8DDD0] rounded-xl pl-8 pr-8 py-2 text-xs bg-white
                text-[#5C5C5C] cursor-pointer focus:outline-none focus:border-[#C9A84C]"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="LOCKED">Đang khóa</option>
            </select>
            <ChevronRight size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[#8E8878] pointer-events-none" />
          </div>

          {/* Nút sắp xếp theo công nợ tăng dần */}
          <button
            onClick={() => setSortDebt(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs transition-all
              ${sortDebt
                ? 'border-[#C9A84C] bg-[#FBF6E9] text-[#8A6D1F] font-semibold'
                : 'border-[#E8DDD0] bg-white text-[#5C5C5C] hover:border-[#C9A84C]'}`}
            title="Sắp xếp công nợ từ nhỏ đến lớn"
          >
            <ArrowUp size={13} />
            Công nợ tăng dần
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        {loading && customers.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8E8878] gap-2">
            <Search size={32} strokeWidth={1} />
            <p className="text-sm">{t('common', 'no_data')}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[#FAF7F2] border-b border-[#F0EBE3]">
                  <tr>
                    <th className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3">
                      {t('customer', 'customer')}
                    </th>
                    <th className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3">
                      TT Liên hệ {/* Đã đổi từ "Tên người liên hệ" */}
                    </th>
                    <th className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3">
                      {t('common', 'type')}
                    </th>
                    <th className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3">
                      {t('payment', 'debt')}
                    </th>
                    <th className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3">
                      {t('common', 'note')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => {
                    // Tính urgency dựa trên oldestDebtDays
                    const urgency = c.oldestDebtDays !== null && c.oldestDebtDays !== undefined
                      ? c.oldestDebtDays >= 0 && c.oldestDebtDays <= 3 ? 'critical'
                        : c.oldestDebtDays <= 6 ? 'warning' : null
                      : null;
                    
                    return (
                      <tr key={c.id}
                        onClick={() => setHistoryCustomerId(c.id)}
                        className={`border-b border-[#F0EBE3] last:border-0 cursor-pointer transition-colors hover:bg-[#FAF7F2]
                          ${urgency === 'critical' ? 'bg-red-50/40' : urgency === 'warning' ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 relative
                              ${c.customerType === 'COMPANY' ? 'bg-blue-500' : 'bg-[#C9A84C]'}`}>
                              {c.customerType === 'COMPANY' ? <Building2 size={14} /> : <UserIcon size={14} />}
                              {urgency && (
                                <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white
                                  ${urgency === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-semibold text-xs text-[#1C1C1E] truncate">
                                  {c.customerType === 'COMPANY' ? (c.companyName || c.name) : (c.name || '—')}
                                </p>
                                {c.isActive === false && (
                                  <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 flex-shrink-0">
                                    Đã khóa
                                  </span>
                                )}
                              </div>
                              {c.customerCode && <p className="text-[10px] text-[#8E8878]">#{c.customerCode}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#1C1C1E]">
                          {c.phone || '—'} {/* TT Liên hệ hiển thị số điện thoại */}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
                            ${c.customerType === 'COMPANY'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {c.customerType === 'COMPANY' ? t('customer', 'company') : t('customer', 'retail')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {/* Công nợ hiển thị số tiền */}
                          {c.unpaidDebt > 0
                            ? <span className="text-xs font-bold text-orange-600">{formatPrice(c.unpaidDebt)}</span>
                            : <span className="text-xs text-[#C4B9A8]">0 đ</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {/* Note: số ngày công nợ của đơn cũ nhất */}
                          {c.oldestDebtDays !== null && c.oldestDebtDays !== undefined && c.oldestDebtDays > 0
                            ? <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
                              ${c.oldestDebtDays <= 3 ? 'bg-red-50 text-red-600 border-red-200'
                                : c.oldestDebtDays <= 6 ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                {c.oldestDebtDays} ngày
                              </span>
                            : <span className="text-[10px] text-[#C4B9A8]">—</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards - giữ nguyên nhưng cập nhật data */}
            <div className="md:hidden space-y-3">
              {customers.map(c => {
                const urgency = c.oldestDebtDays !== null && c.oldestDebtDays !== undefined
                  ? c.oldestDebtDays >= 0 && c.oldestDebtDays <= 3 ? 'critical'
                    : c.oldestDebtDays <= 6 ? 'warning' : null
                  : null;
                
                return (
                  <div key={c.id}
                    onClick={() => setHistoryCustomerId(c.id)}
                    className={`bg-white rounded-2xl p-4 border cursor-pointer transition-all hover:shadow-md
                      ${urgency === 'critical' ? 'border-red-300 ring-1 ring-red-300' : urgency === 'warning' ? 'border-amber-300 ring-1 ring-amber-300' : 'border-[#F0EBE3]'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 relative
                        ${c.customerType === 'COMPANY' ? 'bg-blue-500' : 'bg-[#C9A84C]'}`}>
                        {c.customerType === 'COMPANY' ? <Building2 size={15} /> : <UserIcon size={15} />}
                        {urgency && (
                          <span className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white
                            ${urgency === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-[#1C1C1E] truncate">
                            {c.customerType === 'COMPANY' ? (c.companyName || c.name) : (c.name || '—')}
                          </p>
                          {/* TRẠNG THÁI KHOÁ — chỉ HIỂN THỊ. Kế toán viên cần biết
                              để không ghi nhận đơn mới, nhưng quyền khoá/mở khoá
                              thuộc SUPER_ACCOUNTANT/OWNER/ADMIN. */}
                          {c.isActive === false && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200 flex-shrink-0">
                              Đã khóa
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8E8878]">{c.phone}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border
                            ${c.customerType === 'COMPANY' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {c.customerType === 'COMPANY' ? t('customer', 'company').substring(0, 2) : t('customer', 'retail')}
                          </span>
                          {c.unpaidDebt > 0 && (
                            <span className="text-[10px] text-orange-500 font-semibold">💰 {formatPrice(c.unpaidDebt)}</span>
                          )}
                          {c.oldestDebtDays !== null && c.oldestDebtDays !== undefined && c.oldestDebtDays > 0 && (
                            <span className={`text-[10px] font-semibold
                              ${c.oldestDebtDays <= 3 ? 'text-red-600' : c.oldestDebtDays <= 6 ? 'text-amber-600' : 'text-blue-600'}`}>
                              📋 {c.oldestDebtDays} ngày
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-[#C4B9A8] shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination - giữ nguyên */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => fetchCustomers(page - 1)} disabled={page === 0 || loading}
              className="p-2 rounded-xl bg-white border border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm text-[#8E8878] px-3">{page + 1} / {totalPages}</span>
            <button onClick={() => fetchCustomers(page + 1)} disabled={page >= totalPages - 1 || loading}
              className="p-2 rounded-xl bg-white border border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Modal chọn khách hàng trước khi xuất báo cáo công nợ */}
      <DebtReportCustomerModal
        open={debtModalOpen}
        onClose={() => setDebtModalOpen(false)}
        fetchCustomers={fetchCustomersForReport}
        onConfirm={(ids) => handleExportAgedReceivables(ids)}
        onExportAll={() => handleExportAgedReceivables(null)}
        exporting={exportingDebt}
      />
    </div>
  );
}