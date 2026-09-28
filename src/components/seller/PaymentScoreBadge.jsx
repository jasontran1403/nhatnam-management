// src/components/seller/PaymentScoreBadge.jsx
// Badge hiển thị tỷ lệ thanh toán công nợ của khách hàng.
//
// Chỉ hiển thị khi customer.debtDays > 0.
// Tự fetch score từ API khi customerId thay đổi (debounce 300ms).
// Dùng được trong CustomerSearchModal (kết quả tìm kiếm) và POSPage (giỏ hàng).
//
// Tooltip được render qua Portal ra document.body để KHÔNG bị cắt bởi
// container overflow-y-auto của modal/danh sách cuộn.

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { customerApi } from '../../api/services';

/**
 * @param {Object}  props
 * @param {number}  props.customerId   - ID khách hàng
 * @param {number}  props.debtDays     - Số ngày công nợ được cấp (0 = không hiển thị)
 * @param {'sm'|'md'} [props.size='sm'] - Kích thước badge
 * @param {boolean} [props.showDetail=false] - Hiện tooltip chi tiết khi hover
 */
export default function PaymentScoreBadge({ customerId, debtDays, size = 'sm', showDetail = false }) {
  const [data, setData]       = useState(null);   // null = loading / not applicable
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [coords, setCoords]   = useState({ top: 0, left: 0 });
  const timerRef  = useRef(null);
  const badgeRef  = useRef(null);

  useEffect(() => {
    // Không gọi API nếu không có công nợ
    if (!customerId || !debtDays || debtDays <= 0) {
      setData(null);
      return;
    }

    setLoading(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await customerApi.getPaymentScore(customerId);
        const body = res?.data?.data ?? res?.data;
        // score = null nghĩa là chưa có lịch sử công nợ → không hiển thị
        if (!body || body.score == null) {
          setData(null);
        } else {
          setData(body);
        }
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [customerId, debtDays]);

  // Đo vị trí badge để đặt tooltip đúng chỗ (render qua Portal)
  const updateCoords = useCallback(() => {
    const el = badgeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      // tooltip nằm PHÍA TRÊN badge, canh giữa
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const handleEnter = () => {
    if (!showDetail) return;
    updateCoords();
    setHovering(true);
  };
  const handleLeave = () => {
    if (!showDetail) return;
    setHovering(false);
  };

  // Cập nhật lại vị trí khi scroll/resize trong lúc đang hover
  useEffect(() => {
    if (!hovering) return;
    const onScrollOrResize = () => updateCoords();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [hovering, updateCoords]);

  // Không render khi không có công nợ
  if (!debtDays || debtDays <= 0) return null;
  // Đang load: hiện skeleton nhỏ
  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 animate-pulse
        bg-gray-100 dark:bg-gray-700 ${size === 'md' ? 'text-xs' : 'text-[10px]'}`}>
        <span className="w-8 h-2.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
      </span>
    );
  }
  // Chưa có data (API lỗi hoặc chưa có lịch sử)
  if (!data) return null;

  const { scorePct, color, label, totalDebtOrders, lateOrders, onTimeOrders, avgLateDays } = data;

  // Màu & icon theo color
  const styles = {
    green:  {
      bg:   'bg-emerald-50 dark:bg-emerald-500/10',
      text: 'text-emerald-700 dark:text-emerald-300',
      border:'border-emerald-200 dark:border-emerald-500/28',
      bar:  'bg-emerald-400',
      icon: <TrendingUp size={size === 'md' ? 12 : 10} />,
    },
    yellow: {
      bg:   'bg-amber-50 dark:bg-amber-500/10',
      text: 'text-amber-700 dark:text-amber-300',
      border:'border-amber-200 dark:border-amber-500/28',
      bar:  'bg-amber-400',
      icon: <Minus size={size === 'md' ? 12 : 10} />,
    },
    red:    {
      bg:   'bg-red-50 dark:bg-red-500/10',
      text: 'text-red-600 dark:text-red-300',
      border:'border-red-200 dark:border-red-500/28',
      bar:  'bg-red-400',
      icon: <TrendingDown size={size === 'md' ? 12 : 10} />,
    },
  };
  const s = styles[color] ?? styles.yellow;

  const badgeCls = `inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-semibold
    whitespace-nowrap select-none cursor-default
    ${s.bg} ${s.text} ${s.border}
    ${size === 'md' ? 'text-xs' : 'text-[10px]'}`;

  const badge = (
    <span
      ref={badgeRef}
      className={badgeCls}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {s.icon}
      Tỷ lệ Thanh toán {scorePct}%
    </span>
  );

  if (!showDetail) return badge;

  // Tooltip render qua Portal → nằm ngoài modal, không bị overflow cắt.
  const tooltip = hovering ? createPortal(
    <div
      className="fixed z-[9999] w-52 -translate-x-1/2 -translate-y-full
        rounded-xl border border-hairline-2 bg-surface shadow-xl p-3 text-left
        pointer-events-none"
      style={{ top: coords.top - 8, left: coords.left }}
    >
      <p className="text-xs font-bold text-ink mb-2">Tỷ lệ thanh toán CN</p>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all ${s.bar}`}
          style={{ width: `${scorePct}%` }}
        />
      </div>

      <div className="space-y-1">
        <Row label="Điểm" value={`${scorePct}/100 — ${label}`} valueClass={s.text} />
        <Row label="Tổng đơn CN" value={`${totalDebtOrders} đơn`} />
        <Row label="Đúng hạn" value={`${onTimeOrders} đơn`} valueClass="text-emerald-600 dark:text-emerald-400" />
        {lateOrders > 0 && (
          <Row label="Trễ hạn" value={`${lateOrders} đơn (TB ${avgLateDays} ngày)`} valueClass="text-red-500" />
        )}
      </div>

      {color === 'red' && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-2 py-1">
          <AlertTriangle size={10} className="shrink-0" />
          Cần chú ý khi bán công nợ
        </div>
      )}
      {color === 'yellow' && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-2 py-1">
          <AlertTriangle size={10} className="shrink-0" />
          Có một số đơn thanh toán trễ
        </div>
      )}

      {/* Arrow trỏ xuống badge */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full
        border-4 border-transparent border-t-surface" />
    </div>,
    document.body
  ) : null;

  return (
    <span className="relative inline-block">
      {badge}
      {tooltip}
    </span>
  );
}

function Row({ label, value, valueClass = 'text-ink' }) {
  return (
    <div className="flex justify-between items-center text-[10px]">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}