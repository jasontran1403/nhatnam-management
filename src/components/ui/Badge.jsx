/**
 * Badge.jsx — unified badges
 */
import { useLang } from '../../context/LangContext';

export function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${className}`}>
      {children}
    </span>
  );
}

function getOrderStatusMap(t) {
  return {
    PENDING:         { label: t('status', 'pending_confirm'),   cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
    CONFIRMED:       { label: t('status', 'confirmed'),         cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
    PREPARING:       { label: t('status', 'preparing'),         cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
    READY:           { label: t('status', 'ready'),             cls: 'bg-cyan-50 text-cyan-700 ring-cyan-200' },
    DELIVERING:      { label: t('status', 'delivering_short'),  cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
    PENDING_PAYMENT: { label: t('status', 'pending_payment'),   cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
    COMPLETED:       { label: t('status', 'completed'),         cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    CANCELLED:       { label: t('status', 'cancelled'),         cls: 'bg-red-50 text-red-700 ring-red-200' },
    FAILED:          { label: t('status', 'rejected_short'),    cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  };
}

function getPaymentStatusMap(t) {
  return {
    UNPAID:   { label: t('payment', 'unpaid'),    cls: 'bg-red-50 text-red-700 ring-red-200' },
    PAID:     { label: t('payment', 'paid'),      cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    REFUNDED: { label: t('status', 'refunded'),   cls: 'bg-slate-50 text-slate-700 ring-slate-200' },
  };
}

function getExpiryBadgeMap(t) {
  return {
    WARNING: { label: t('expiry', 'expired_soon_3m'), cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
    DANGER:  { label: t('expiry', 'expired_soon_1m'), cls: 'bg-red-50 text-red-700 ring-red-200' },
    NONE:    null,
  };
}

export function OrderStatusBadge({ status }) {
  const { t } = useLang();
  const map = getOrderStatusMap(t);
  const cfg = map[status] || { label: status, cls: 'bg-slate-50 text-slate-700 ring-slate-200' };
  return <Badge className={cfg.cls}>{cfg.label}</Badge>;
}

export function PaymentStatusBadge({ status }) {
  const { t } = useLang();
  const map = getPaymentStatusMap(t);
  const cfg = map[status] || { label: status, cls: 'bg-slate-50 text-slate-700 ring-slate-200' };
  return <Badge className={cfg.cls}>{cfg.label}</Badge>;
}

export function ExpiryBadge({ badge, text }) {
  const { t } = useLang();
  const map = getExpiryBadgeMap(t);
  const cfg = map[badge];
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
