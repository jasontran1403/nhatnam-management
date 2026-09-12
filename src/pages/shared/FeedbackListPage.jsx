// src/pages/shared/FeedbackListPage.jsx
//
// DANH SÁCH FEEDBACK — dành cho OWNER / ADMIN.
//
// Yêu cầu: sort mới nhất trước, search theo tên SP, mỗi card gồm:
//   thời gian | mã đơn | tên KH | tên SP | nội dung feedback.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare, Search, RefreshCw, ArrowLeft, X,
  User, Phone, Package, Clock,
} from 'lucide-react';
import { feedbackApi } from '../../api/feedbackApi';
import { getImageUrl } from '../../api/services';
import useDebounce from '../../utils/useDebounce.js';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  PageHeader, EmptyState, Pagination,
  inputCls, formatNumber, formatDateTime,
  TableSkeleton,
} from '../../components/ui';

const PAGE_SIZE = 20;

export default function FeedbackListPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const rolePrefix = useMemo(
    () => (location.pathname.startsWith('/admin') ? '/admin' : '/owner'),
    [location.pathname]
  );

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 600);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useMinLoading();

  const load = useCallback((p = 0) => {
    setLoading(true);
    feedbackApi.list({ q: debouncedSearch, page: p, size: PAGE_SIZE })
      .then(data => {
        setRows(data?.content || []);
        setTotal(data?.totalElements || 0);
        setPage(p);
      })
      .catch(err => { console.error('[Feedback] load error', err); setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  useEffect(() => { load(0); /* eslint-disable-next-line */ }, [debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button
        onClick={() => navigate(`${rolePrefix}/orders`)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink hover:bg-canvas transition-colors">
        <ArrowLeft size={14} /> Đơn hàng
      </button>

      <PageHeader
        icon={MessageSquare}
        title="Feedback khách hàng"
        subtitle={`Tổng ${formatNumber(total)} phản hồi`}
      />

      {/* Bộ lọc */}
      <div className="bg-surface rounded-2xl border border-hairline p-3 sm:p-4 shadow-sm flex gap-3 items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên sản phẩm, khách hàng, mã đơn, nội dung..."
            className={`${inputCls} pl-9`}
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-ink hover:bg-canvas"
              title="Xoá tìm kiếm"><X size={14} /></button>
          )}
        </div>
        <button onClick={() => load(0)}
          className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3 transition-colors flex-shrink-0"
          title="Tải lại">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
          <TableSkeleton cols={4} rows={6} />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
          <EmptyState icon={MessageSquare} title="Chưa có feedback nào"
            description={searchInput ? "Không có feedback khớp với tìm kiếm." : "Chưa có phản hồi nào từ khách hàng."} />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map(fb => (
              <div key={fb.id}
                className="bg-surface rounded-2xl border border-hairline shadow-sm p-4 hover:shadow-md transition-shadow">
                {/* Header: mã đơn + thời gian */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-semibold font-mono">
                    {fb.orderCode || 'N/A'}
                  </span>
                  <span className="text-[11px] text-muted inline-flex items-center gap-1 whitespace-nowrap">
                    <Clock size={11} /> {formatDateTime(fb.createdAt)}
                  </span>
                </div>

                {/* Grid meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-3">
                  <div className="inline-flex items-baseline gap-1.5">
                    <span className="text-muted text-[11px] uppercase font-semibold tracking-wide">KH:</span>
                    <span className="text-ink font-medium truncate">{fb.customerName || fb.contactName || '—'}</span>
                  </div>
                  <div className="inline-flex items-baseline gap-1.5">
                    <Package size={11} className="text-muted mt-0.5 shrink-0" />
                    <span className="text-ink font-medium truncate">{fb.productName}</span>
                  </div>
                  {fb.contactName && fb.contactName !== fb.customerName && (
                    <div className="inline-flex items-baseline gap-1.5">
                      <User size={11} className="text-muted mt-0.5 shrink-0" />
                      <span className="text-ink truncate text-[13px]">{fb.contactName}</span>
                    </div>
                  )}
                  {fb.contactPhone && (
                    <div className="inline-flex items-baseline gap-1.5">
                      <Phone size={11} className="text-muted mt-0.5 shrink-0" />
                      <span className="text-ink truncate text-[13px] font-mono">{fb.contactPhone}</span>
                    </div>
                  )}
                </div>

                {/* Nội dung feedback */}
                <div className="p-3 rounded-xl bg-canvas border border-hairline">
                  <div className="text-[10px] text-muted uppercase font-semibold tracking-wide mb-1">Nội dung</div>
                  <div className="text-sm text-ink whitespace-pre-wrap">{fb.content}</div>
                </div>

                {/* Ảnh đính kèm — click ảnh mở tab mới xem full size */}
                {fb.imageUrls && fb.imageUrls.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[10px] text-muted uppercase font-semibold tracking-wide mb-1.5">
                      Ảnh đính kèm ({fb.imageUrls.length})
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {fb.imageUrls.map((u, i) => (
                        <a key={i} href={getImageUrl(u)} target="_blank" rel="noreferrer"
                          className="block w-20 h-20 rounded-lg overflow-hidden border border-hairline hover:opacity-80 hover:border-gold transition-all"
                          title="Click để xem full size">
                          <img src={getImageUrl(u)} alt="" loading="lazy" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {fb.createdByName && (
                  <div className="mt-2 text-[11px] text-muted text-right italic">
                    — Ghi nhận bởi {fb.createdByName}
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination page={page} totalPages={totalPages} onChange={load} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
