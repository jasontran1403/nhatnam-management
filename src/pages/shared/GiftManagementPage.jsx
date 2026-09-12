// src/pages/shared/GiftManagementPage.jsx
//
// QUẢN LÝ QUÀ TẶNG — trang mới dùng chung cho OWNER / ADMIN / SUPER_ACCOUNTANT.
//
// UI:
//   - Mỗi CARD = 1 đơn/phiếu, hiển thị: mã (badge), thời gian, KH, người xử lý,
//     số sản phẩm KM. Click card → modal chi tiết các SP KM.
//   - Search debounce 600ms theo tên KH / mã đơn / SĐT / tên SP.
//   - DateRangePicker mặc định 01/06/2026 → hôm nay.
//   - Dropdown filter theo người tạo (fetch từ dữ liệu thực tế).

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Gift, Search, User, ShoppingBag, RefreshCw, ArrowLeft, X, Package } from 'lucide-react';
import { giftManagementApi } from '../../api/giftManagementApi';
import useDebounce from '../../utils/useDebounce.js';
import useMinLoading from '../../hooks/useMinLoading.js';
// Modal LÀ DEFAULT EXPORT của components/ui/Modal.jsx, KHÔNG được re-export
// từ components/ui/index.jsx — nên phải import trực tiếp. Version trước import
// từ '../../components/ui' làm Modal = undefined ⇒ click card không hiện gì.
import Modal from '../../components/ui/Modal';
import {
  PageHeader, EmptyState, Pagination,
  inputCls, selectCls, formatNumber, formatDateTime,
  DateRangePicker, TableSkeleton,
} from '../../components/ui';

const PAGE_SIZE = 20;

function statusLabel(s) {
  switch (s) {
    case 'APPROVED':   return 'Đã duyệt';
    case 'DELIVERING': return 'Đang giao';
    case 'COMPLETED':  return 'Hoàn thành';
    default: return s;
  }
}

/**
 * Badge nhỏ hiển thị mã đơn/phiếu — kèm icon để phân biệt nhanh nguồn.
 * Thay cho label chữ "Đơn khuyến mãi" / "Phiếu quà tặng" của bản trước.
 */
function CodeBadge({ source, code, status }) {
  const isGift = source === 'GIFT_ORDER';
  const cls = isGift
    ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 border-violet-200 dark:border-violet-500/30'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30';
  const Icon = isGift ? Gift : ShoppingBag;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold font-mono ${cls}`}>
      <Icon size={12} />
      {code}
      {isGift && status && <span className="font-sans font-normal opacity-80">· {statusLabel(status)}</span>}
    </span>
  );
}

/**
 * Modal chi tiết — hiện danh sách SP KM của 1 đơn/phiếu, + nút "Xem chi tiết đơn".
 *
 * <p>LƯU Ý về props Modal:
 *  - Prop điều khiển mở/đóng tên là {@code open}, KHÔNG phải {@code isOpen}.
 *  - {@code title} được render bên trong {@code <h3>} nên chỉ truyền string,
 *    không truyền JSX phức tạp (nested div/span trong h3 là HTML invalid).
 *    Badge mã đơn giờ nằm ở body ngay dưới title thay vì gộp vào title.
 */
function GiftDetailModal({ record, onClose, onOpenSource }) {
  return (
    <Modal open={!!record} onClose={onClose} size="lg" title="Chi tiết quà tặng">
      {record && (
        <div className="space-y-4">
          {/* Badge mã đơn/phiếu — trước ở title, chuyển xuống body để không nested trong h3 */}
          <div className="flex items-center gap-2 flex-wrap">
            <CodeBadge source={record.source} code={record.code} status={record.giftOrderStatus} />
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[11px] text-muted uppercase font-semibold tracking-wide">Thời gian</div>
              <div className="text-ink">{formatDateTime(record.createdAt)}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted uppercase font-semibold tracking-wide">Khách hàng</div>
              <div className="text-ink font-medium">{record.customerName || 'Khách lẻ'}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted uppercase font-semibold tracking-wide">Người xử lý</div>
              <div className="text-ink inline-flex items-center gap-1.5">
                <User size={12} className="text-muted" />{record.handlerName || '—'}
              </div>
            </div>
            {record.warehouseName && (
              <div>
                <div className="text-[11px] text-muted uppercase font-semibold tracking-wide">Kho</div>
                <div className="text-ink">{record.warehouseName}</div>
              </div>
            )}
          </div>

          {/* Note chung (chỉ GIFT_ORDER có) */}
          {record.note && (
            <div className="p-3 rounded-xl bg-canvas border border-hairline">
              <div className="text-[11px] text-muted uppercase font-semibold tracking-wide mb-1">Ghi chú phiếu</div>
              <div className="text-sm text-ink italic">📝 {record.note}</div>
            </div>
          )}

          {/* Danh sách SP */}
          <div>
            <div className="text-[11px] text-muted uppercase font-semibold tracking-wide mb-2">
              Sản phẩm khuyến mãi ({record.itemCount})
            </div>
            <div className="divide-y divide-hairline border border-hairline rounded-xl overflow-hidden">
              {(record.items || []).map((it, i) => (
                <div key={i} className="p-3 flex items-start justify-between gap-3 bg-surface hover:bg-canvas/40">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink truncate">{it.productName}</div>
                    {it.note && <div className="text-[12px] text-muted mt-0.5 italic">📝 {it.note}</div>}
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="text-ink font-semibold">{formatNumber(it.quantity)}</span>
                    {it.unit && <span className="text-muted ml-1 text-sm">{it.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink hover:bg-canvas transition-colors">
              Đóng
            </button>
            <button
              onClick={() => { onOpenSource(record); onClose(); }}
              className="px-4 py-2 rounded-xl bg-gold text-white text-sm font-medium hover:bg-gold-600 transition-colors">
              {record.source === 'GIFT_ORDER' ? 'Xem chi tiết phiếu →' : 'Xem chi tiết đơn →'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function GiftManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const rolePrefix = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith('/owner'))            return '/owner';
    if (p.startsWith('/admin'))            return '/admin';
    if (p.startsWith('/super-accountant')) return '/super-accountant';
    return '/owner';
  }, [location.pathname]);

  const ordersBackPath = rolePrefix === '/super-accountant'
    ? '/super-accountant/history'
    : `${rolePrefix}/orders`;

  // Bộ lọc
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 600);
  const [dateRange, setDateRange] = useState(() => ({
    from: new Date(2026, 5, 1),
    to: new Date(),
  }));
  const [handlerId, setHandlerId] = useState('');

  // Dữ liệu
  const [handlers, setHandlers] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useMinLoading();
  const [selected, setSelected] = useState(null);  // record đang xem modal

  useEffect(() => {
    let cancelled = false;
    giftManagementApi.handlers()
      .then(data => { if (!cancelled) setHandlers(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setHandlers([]); });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback((p = 0) => {
    setLoading(true);
    giftManagementApi.list({
      q: debouncedSearch,
      from: dateRange.from ? new Date(dateRange.from).getTime() : undefined,
      to: dateRange.to ? new Date(dateRange.to).getTime() + 86399999 : undefined,
      handlerId: handlerId || undefined,
      page: p, size: PAGE_SIZE,
    })
      .then(data => {
        setRows(data?.content || []);
        setTotal(data?.totalElements || 0);
        setPage(p);
      })
      .catch(err => { console.error('[GiftManagement] load error', err); setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, dateRange, handlerId]);

  useEffect(() => { load(0); /* eslint-disable-next-line */ }, [debouncedSearch, dateRange.from, dateRange.to, handlerId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openSourceDetail = (r) => {
    if (r.source === 'GIFT_ORDER') navigate(`${rolePrefix}/gift-orders/${r.sourceId}`);
    else navigate(`${ordersBackPath}?highlight=${r.sourceId}`);
  };

  const clearFilters = () => {
    setSearchInput('');
    setDateRange({ from: new Date(2026, 5, 1), to: new Date() });
    setHandlerId('');
  };
  const hasFilter = !!(searchInput || handlerId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <button
        onClick={() => navigate(ordersBackPath)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink hover:bg-canvas transition-colors">
        <ArrowLeft size={14} /> Đơn hàng
      </button>

      <PageHeader icon={Gift} title="Quản lý quà tặng"
        subtitle={`Tổng ${formatNumber(total)} đơn/phiếu quà tặng`} />

      {/* Bộ lọc */}
      <div className="bg-surface rounded-2xl border border-hairline p-3 sm:p-4 shadow-sm flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên khách, tên sản phẩm, mã đơn/phiếu, SĐT..."
            className={`${inputCls} pl-9`} />
          {searchInput && (
            <button onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-ink hover:bg-canvas"
              title="Xoá tìm kiếm"><X size={14} /></button>
          )}
        </div>
        <div className="flex-shrink-0 [&>*]:h-[38px] [&_button]:h-[38px] [&_button]:rounded-xl">
          <DateRangePicker from={dateRange.from} to={dateRange.to}
            onChange={r => setDateRange(r)} placeholder="Khoảng ngày tạo" />
        </div>
        <div className="flex-shrink-0 lg:w-56">
          <select className={selectCls} value={handlerId} onChange={e => setHandlerId(e.target.value)}>
            <option value="">Tất cả người tạo</option>
            {handlers.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => load(0)}
            className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3 transition-colors"
            title="Tải lại"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          {hasFilter && (
            <button onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink hover:bg-canvas transition-colors"
              title="Xoá bộ lọc"><X size={13} /> Xoá lọc</button>
          )}
        </div>
      </div>

      {/* Danh sách card */}
      {loading ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
          <TableSkeleton cols={4} rows={6} />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
          <EmptyState icon={Gift} title="Chưa có quà tặng nào"
            description="Chưa có đơn KM hoặc phiếu tặng quà đã duyệt trong khoảng lọc." />
        </div>
      ) : (
        <>
          {/* Grid card: 1 col mobile, 2 col tablet+, 3 col desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map((r) => (
              <button
                key={`${r.source}-${r.sourceId}`}
                onClick={() => setSelected(r)}
                className="text-left bg-surface rounded-2xl border border-hairline shadow-sm p-4 hover:shadow-md hover:border-gold/40 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <CodeBadge source={r.source} code={r.code} status={r.giftOrderStatus} />
                  <span className="text-[11px] text-muted whitespace-nowrap mt-1">{formatDateTime(r.createdAt)}</span>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted text-[11px] uppercase font-semibold tracking-wide w-20 shrink-0">Khách</span>
                    <span className="text-ink font-medium truncate">{r.customerName || 'Khách lẻ'}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted text-[11px] uppercase font-semibold tracking-wide w-20 shrink-0">Xử lý</span>
                    <span className="text-ink truncate inline-flex items-center gap-1">
                      <User size={11} className="text-muted" />{r.handlerName || '—'}
                    </span>
                  </div>
                  {r.warehouseName && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-muted text-[11px] uppercase font-semibold tracking-wide w-20 shrink-0">Kho</span>
                      <span className="text-ink truncate text-[13px]">{r.warehouseName}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold">
                    <Package size={14} />
                    {r.itemCount} sản phẩm KM
                  </span>
                  <span className="text-[11px] text-muted group-hover:text-gold transition-colors">Xem chi tiết →</span>
                </div>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination page={page} totalPages={totalPages} onChange={load} />
            </div>
          )}
        </>
      )}

      <GiftDetailModal
        record={selected}
        onClose={() => setSelected(null)}
        onOpenSource={openSourceDetail}
      />
    </div>
  );
}