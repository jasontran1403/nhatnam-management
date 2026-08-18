// src/pages/seller/OrderForecastPage.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, Search, Phone, PhoneCall, CheckCircle2, RotateCcw,
  CalendarClock, Building2, User as UserIcon, RefreshCw, Cake, Store,
} from 'lucide-react';
import { orderForecastApi } from '../../api/voucherApi';
import { TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import useDebounce from '../../utils/useDebounce.js';
import { useToast } from '../../components/common/Toast';
import { PageHeader, EmptyState, inputCls, formatNumber } from '../../components/ui';
import { formatDate, formatDateTime } from '../../utils/anniversary';

/**
 * DỰ BÁO ĐẶT HÀNG — màn hình để seller chủ động gọi chào hàng.
 *
 * <p>Server tính chu kỳ đặt hàng trung bình của từng khách rồi cộng vào ngày đặt gần nhất
 * ra ngày dự kiến khách hết hàng. Màn hình này chỉ hiển thị kết quả và cho phép đánh dấu
 * đã gọi.
 *
 * <p><b>Đánh dấu "đã gọi" KHÔNG ẩn khách khỏi danh sách</b> — chỉ đổi style và ghi lại
 * ngày giờ. Khách gọi hôm nay mà chưa chốt đơn vẫn phải nhìn thấy được, nếu ẩn đi thì
 * hôm sau không ai nhớ gọi lại. Bản ghi đánh dấu gắn theo NGÀY nên sang ngày mới tự
 * hết hiệu lực và hàng quay về trạng thái "chưa liên hệ".
 */
export default function OrderForecastPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, 500);
  const [onlyDue, setOnlyDue] = useState(true);
  const [data, setData] = useState({ asOfDate: '', dueCount: 0, contactedCount: 0, rows: [] });
  const [loading, setLoading] = useMinLoading();
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderForecastApi.forecast(debouncedQ, onlyDue);
      setData(res || { rows: [] });
    } catch (e) {
      toast(e?.message || 'Không tải được dữ liệu dự báo', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, onlyDue, setLoading, toast]);

  useEffect(() => { load(); }, [load]);

  const toggleContacted = async (row) => {
    setBusyId(row.customerId);
    try {
      if (row.contactedToday) {
        await orderForecastApi.unmarkContacted(row.customerId);
        toast('Đã bỏ đánh dấu', 'success');
      } else {
        await orderForecastApi.markContacted(row.customerId);
        toast('Đã ghi nhận liên hệ', 'success');
      }
      await load();
    } catch (e) {
      toast(e?.message || 'Thao tác thất bại', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const rows = data.rows || [];

  // Ba nhóm khớp với thứ tự backend trả về: hôm nay → gần đến hạn → đã trễ.
  const counts = useMemo(() => ({
    today:    rows.filter(r => r.overdueDays === 0).length,
    upcoming: rows.filter(r => r.overdueDays < 0).length,
    late:     rows.filter(r => r.overdueDays > 0).length,
  }), [rows]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <PageHeader
        icon={TrendingUp}
        title="Dự báo đặt hàng"
        subtitle={data.asOfDate ? `Dữ liệu ngày ${data.asOfDate}` : 'Khách hàng có thể sắp cần đặt hàng'}
        action={
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-line text-xs text-ink-2 hover:border-gold transition-colors">
            <RefreshCw size={13} /> Làm mới
          </button>
        }
      />

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Đến hạn hôm nay" value={counts.today} tone="amber" />
        <StatBox label="Gần đến hạn" value={counts.upcoming} tone="gold" />
        <StatBox label="Đã trễ" value={counts.late} tone="rose" />
        <StatBox label="Đã liên hệ hôm nay" value={data.contactedCount || 0} tone="emerald" />
      </div>

      {/* Bộ lọc */}
      <div className="bg-surface rounded-2xl border border-hairline p-3 sm:p-4 shadow-sm
                      flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Tìm theo tên khách, tên công ty, số điện thoại..."
            className={`${inputCls} pl-9 pr-9`}
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">✕</button>
          )}
        </div>
        <button
          onClick={() => setOnlyDue(v => !v)}
          className={`px-4 h-[38px] rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap
            ${onlyDue
              ? 'bg-gold text-white border-gold'
              : 'border-line text-ink-2 hover:bg-surface-2'}`}>
          {onlyDue ? 'Tới hạn & sắp tới hạn' : 'Tất cả khách có dự báo'}
        </button>
      </div>

      {/* Danh sách */}
      <div className="bg-surface rounded-2xl border border-hairline shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton cols={5} rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Chưa có khách nào tới hạn"
            description="Hệ thống cần ít nhất 2 đơn hàng của khách để tính được chu kỳ đặt hàng."
          />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-canvas text-muted">
                    <Th>Khách hàng</Th>
                    <Th className="text-center">Chu kỳ TB</Th>
                    <Th className="text-center">Đặt gần nhất</Th>
                    <Th className="text-center">Dự kiến đặt lại</Th>
                    <Th className="text-right">Trạng thái</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map(r => (
                    <tr key={r.customerId} className={`transition-colors ${rowClass(r)}`}>
                      <td className="px-4 py-3">
                        <CustomerCell row={r} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-ink">{r.avgCycleDays}</span>
                        <span className="text-muted text-xs"> ngày</span>
                        <div className="text-[10px] text-faint mt-0.5">
                          từ {r.orderCount} đơn
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {/* Ngày đặt hàng gần nhất — thông tin seller cần nhất khi
                            gọi chào hàng ("lần trước anh đặt ngày..."). */}
                        <div className="text-sm font-semibold text-ink">
                          {formatDate(r.lastOrderAt)}
                        </div>
                        <div className="text-[10px] text-faint mt-0.5">
                          {daysAgoLabel(r.lastOrderAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-xs font-semibold text-ink">
                          {formatDate(r.predictedNextOrderAt)}
                        </div>
                        <OverdueBadge row={r} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end gap-1.5">
                          <ContactButton
                            row={r}
                            busy={busyId === r.customerId}
                            onClick={() => toggleContacted(r)}
                          />
                          {r.contactedToday && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-300">
                              {formatDateTime(r.contactedAt)}
                              {r.contactedBy ? ` — ${r.contactedBy}` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="lg:hidden divide-y divide-hairline">
              {rows.map(r => (
                <div key={r.customerId} className={`p-4 space-y-3 ${rowClass(r)}`}>
                  <CustomerCell row={r} />

                  <div className="rounded-xl bg-canvas px-3 py-2">
                    <p className="text-[9px] text-muted uppercase tracking-wide">Đặt hàng gần nhất</p>
                    <p className="text-sm font-bold text-ink mt-0.5">
                      {formatDate(r.lastOrderAt)}
                      <span className="text-[10px] font-normal text-faint ml-1.5">
                        {daysAgoLabel(r.lastOrderAt)}
                      </span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <MiniStat label="Chu kỳ TB" value={`${r.avgCycleDays} ngày`} />
                    <MiniStat label="Dự kiến đặt lại" value={formatDate(r.predictedNextOrderAt)} />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <OverdueBadge row={r} />
                    <ContactButton
                      row={r}
                      busy={busyId === r.customerId}
                      onClick={() => toggleContacted(r)}
                    />
                  </div>

                  {r.contactedToday && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-300">
                      Đã liên hệ {formatDateTime(r.contactedAt)}
                      {r.contactedBy ? ` — ${r.contactedBy}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-faint leading-relaxed">
        Danh sách xếp theo thứ tự: <strong>đến hạn hôm nay</strong> → <strong>gần đến hạn</strong>{' '}
        (gần nhất trước) → <strong>đã trễ</strong> (trễ ít nhất trước).
        Chu kỳ được tính bằng trung bình khoảng cách giữa các lần đặt hàng gần đây (làm tròn xuống);
        nhiều đơn trong cùng một ngày được tính là chu kỳ 1 ngày. Đánh dấu đã gọi chỉ đổi màu hàng
        trong ngày hôm nay — nếu khách vẫn chưa đặt, ngày mai khách sẽ xuất hiện lại.
      </p>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Th({ children, className = '' }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

/**
 * Màu hàng: đã liên hệ → xanh nhạt (đã xử lý xong); tới hạn chưa gọi → hổ phách (cần
 * hành động); chưa tới hạn → trong suốt. Ba mức đủ để seller quét mắt là biết gọi ai trước.
 */
function rowClass(r) {
  if (r.contactedToday) return 'bg-emerald-50/70 dark:bg-emerald-500/10';
  // Đúng hôm nay = cơ hội nóng nhất nên nổi bật nhất. Đã trễ để nhạt hơn: trễ càng lâu
  // khả năng khách đã mua chỗ khác càng cao, gọi họ là việc vớt vát chứ không cấp bằng.
  if (r.overdueDays === 0) return 'bg-amber-50 dark:bg-amber-500/12';
  if (r.overdueDays > 0)   return 'bg-rose-50/50 dark:bg-rose-500/8';
  return 'hover:bg-canvas';
}

function CustomerCell({ row: r }) {
  const isCompany = r.customerType === 'COMPANY';
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
        ${isCompany
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300'
          : 'bg-gold/15 text-gold'}`}>
        {isCompany ? <Building2 size={15} /> : <UserIcon size={15} />}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-ink text-sm truncate">{r.displayName}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {r.phone && (
            <a href={`tel:${r.phone}`}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-gold transition-colors">
              <Phone size={10} /> {r.phone}
            </a>
          )}
          {r.customerCode && (
            <span className="text-[10px] text-faint">{r.customerCode}</span>
          )}
        </div>
        {/* Dịp chăm sóc kèm theo — tiện chào hàng luôn trong cùng cuộc gọi */}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {!isCompany && r.birthday && (
            <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-300">
              <Cake size={9} /> {formatDate(r.birthday)}
            </span>
          )}
          {isCompany && r.storeOpeningDate && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-300">
              <Store size={9} /> Khai trương {formatDate(r.storeOpeningDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function OverdueBadge({ row: r }) {
  if (r.overdueDays === 0) {
    return (
      <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold
                       bg-amber-500 text-white">
        Đến hạn hôm nay
      </span>
    );
  }
  if (r.overdueDays < 0) {
    const days = Math.abs(r.overdueDays);
    return (
      <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold
                       bg-gold/15 text-gold">
        {days === 1 ? 'Ngày mai' : `Còn ${days} ngày`}
      </span>
    );
  }
  return (
    <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold
                     bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
      Trễ {r.overdueDays} ngày
    </span>
  );
}

function ContactButton({ row: r, busy, onClick }) {
  if (r.contactedToday) {
    return (
      <button
        onClick={onClick}
        disabled={busy}
        title="Bấm để bỏ đánh dấu"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                   bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300
                   hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
        {busy
          ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          : <CheckCircle2 size={13} />}
        Đã liên hệ
        <RotateCcw size={11} className="opacity-60" />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                 bg-gold text-white hover:bg-gold-deep transition-colors disabled:opacity-50">
      {busy
        ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        : <PhoneCall size={13} />}
      Đánh dấu đã gọi
    </button>
  );
}

function StatBox({ label, value, tone }) {
  const tones = {
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300',
    gold: 'bg-gold/10 border-gold/25 text-gold',
    rose: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300',
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone] || tones.gold}`}>
      <p className="text-2xl font-bold">{formatNumber(value)}</p>
      <p className="text-[11px] font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-canvas rounded-lg px-2 py-1.5">
      <p className="text-[9px] text-muted uppercase tracking-wide">{label}</p>
      <p className="text-xs font-semibold text-ink mt-0.5">{value}</p>
    </div>
  );
}


/**
 * Nhãn "cách đây N ngày" cho ngày đặt hàng gần nhất.
 *
 * <p>Ngày tuyệt đối một mình không đủ: seller đang gọi điện phải nhẩm ra khoảng cách
 * để biết khách đã nghỉ mua bao lâu. Hiện kèm số ngày giúp bỏ bước nhẩm đó.
 */
function daysAgoLabel(millis) {
  if (!millis) return '';
  const days = Math.floor((Date.now() - millis) / 86400000);
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'hôm qua';
  return `${days} ngày trước`;
}
