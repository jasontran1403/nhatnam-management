// src/pages/accountant/AccountantCustomersPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { accountantApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import CustomerOrderHistory from '../../components/admin/CustomerOrderHistory';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  Building2, User as UserIcon, Clock3,
} from 'lucide-react';

// ── Debt urgency ──────────────────────────────────────────────────────────────
function getDebtUrgency(customer) {
  const ms = customer.nearestDeadlineMillis;
  if (!ms) return null;
  const days = Math.ceil((ms - Date.now()) / 86400000);
  if (days < 0 || days <= 3) return 'critical';
  if (days <= 6)              return 'warning';
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AccountantCustomersPage() {
  const toast = useToast();

  const [customers,  setCustomers]  = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [searchInput,setSearchInput]= useState('');

  // Navigate to history
  const [historyCustomerId, setHistoryCustomerId] = useState(null);

  const PAGE_SIZE  = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchCustomers = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = { page: p, size: PAGE_SIZE };
      if (search.trim()) params.q = search.trim();
      const res = await accountantApi.getCustomers(params);
      const data = res.data?.data;
      setCustomers(data?.content || []);
      setTotal(data?.totalItems || data?.totalElements || 0);
      setPage(p);
    } catch {
      toast('Không thể tải danh sách khách hàng', 'error');
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchCustomers(0); }, [fetchCustomers]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Nếu đang xem history
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
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-[#1C1C1E]">Khách hàng</h1>
            <p className="text-[10px] sm:text-xs text-[#8E8878]">{total} khách hàng</p>
          </div>
          <button onClick={() => fetchCustomers(0)}
            className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
          <input type="text" placeholder="Tìm tên, SĐT, mã khách hàng..."
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            className="w-full border border-[#E8DDD0] rounded-xl pl-9 pr-4 py-2 text-sm bg-white
              focus:outline-none focus:border-[#C9A84C]" />
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
            <p className="text-sm">Không có khách hàng nào</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-[#FAF7F2] border-b border-[#F0EBE3]">
                  <tr>
                    {['Khách hàng', 'Liên hệ', 'Loại', 'Công nợ', 'Ghi chú'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => {
                    const urgency = getDebtUrgency(c);
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
                              <p className="font-semibold text-xs text-[#1C1C1E] truncate">
                                {c.customerType === 'COMPANY' ? (c.companyName || c.name) : (c.name || '—')}
                              </p>
                              {c.customerCode && <p className="text-[10px] text-[#8E8878]">#{c.customerCode}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#1C1C1E]">{c.phone}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
                            ${c.customerType === 'COMPANY'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {c.customerType === 'COMPANY' ? 'Doanh nghiệp' : 'Khách lẻ'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.debtDays > 0
                            ? <span className="text-xs text-orange-600 font-semibold">{c.debtDays} ngày</span>
                            : <span className="text-xs text-[#C4B9A8]">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {urgency && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border
                              ${urgency === 'critical' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                              <Clock3 size={9} />
                              {urgency === 'critical' ? 'Sắp hết hạn' : 'Gần hết hạn'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {customers.map(c => {
                const urgency = getDebtUrgency(c);
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
                        <p className="font-semibold text-sm text-[#1C1C1E] truncate">
                          {c.customerType === 'COMPANY' ? (c.companyName || c.name) : (c.name || '—')}
                        </p>
                        <p className="text-xs text-[#8E8878]">{c.phone}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border
                            ${c.customerType === 'COMPANY' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {c.customerType === 'COMPANY' ? 'DN' : 'Lẻ'}
                          </span>
                          {c.debtDays > 0 && (
                            <span className="text-[10px] text-orange-500">📋 {c.debtDays} ngày</span>
                          )}
                          {urgency && (
                            <span className={`text-[10px] font-semibold
                              ${urgency === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                              <Clock3 size={9} className="inline mr-0.5" />
                              {urgency === 'critical' ? 'Sắp hết hạn!' : 'Gần hết hạn'}
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

        {/* Pagination */}
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
    </div>
  );
}