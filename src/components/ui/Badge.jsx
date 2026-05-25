/**
 * Badge.jsx — unified badges
 */

export function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${className}`}>
      {children}
    </span>
  );
}

const ORDER_STATUS_MAP = {
  PENDING:         { label: 'Chờ xác nhận',   cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  CONFIRMED:       { label: 'Đã xác nhận',    cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  PREPARING:       { label: 'Đang chuẩn bị',  cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  READY:           { label: 'Sẵn sàng',       cls: 'bg-cyan-50 text-cyan-700 ring-cyan-200' },
  DELIVERING:      { label: 'Đang giao',      cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  COMPLETED:       { label: 'Hoàn thành',     cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CANCELLED:       { label: 'Đã hủy',         cls: 'bg-red-50 text-red-700 ring-red-200' },
  FAILED:          { label: 'Thất bại',       cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

const PAYMENT_STATUS_MAP = {
  UNPAID:   { label: 'Chưa TT',   cls: 'bg-red-50 text-red-700 ring-red-200' },
  PAID:     { label: 'Đã TT',     cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  REFUNDED: { label: 'Hoàn tiền', cls: 'bg-slate-50 text-slate-700 ring-slate-200' },
};

const EXPIRY_BADGE_MAP = {
  WARNING: { label: 'Sắp hết hạn (≤ 3 tháng)', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  DANGER:  { label: 'Hết hạn gấp (≤ 1 tháng)', cls: 'bg-red-50 text-red-700 ring-red-200' },
  NONE:    null,
};

export function OrderStatusBadge({ status }) {
  const cfg = ORDER_STATUS_MAP[status] || { label: status, cls: 'bg-slate-50 text-slate-700 ring-slate-200' };
  return <Badge className={cfg.cls}>{cfg.label}</Badge>;
}

export function PaymentStatusBadge({ status }) {
  const cfg = PAYMENT_STATUS_MAP[status] || { label: status, cls: 'bg-slate-50 text-slate-700 ring-slate-200' };
  return <Badge className={cfg.cls}>{cfg.label}</Badge>;
}

export function ExpiryBadge({ badge, text }) {
  const cfg = EXPIRY_BADGE_MAP[badge];
  if (!cfg) return null;
  return <Badge className={cfg.cls}>{text || cfg.label}</Badge>;
}

export function VarianceBadge({ pct }) {
  const v = parseFloat(pct || 0);
  if (Math.abs(v) < 0.1) return <Badge className="bg-slate-50 text-slate-500 ring-slate-200">±0%</Badge>;
  const up = v > 0;
  return (
    <Badge className={up ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}>
      {up ? '+' : ''}{v.toFixed(1)}%
    </Badge>
  );
}
