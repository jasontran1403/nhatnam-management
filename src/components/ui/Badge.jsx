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
    PENDING:         { label: t('status', 'pending_confirm'),   cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/28' },
    CONFIRMED:       { label: t('status', 'confirmed'),         cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-500/28' },
    PREPARING:       { label: t('status', 'preparing'),         cls: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-500/28' },
    READY:           { label: t('status', 'ready'),             cls: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 ring-cyan-200 dark:ring-cyan-500/28' },
    DELIVERING:      { label: t('status', 'delivering_short'),  cls: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-500/28' },
    PENDING_PAYMENT: { label: t('status', 'pending_payment'),   cls: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-500/28' },
    COMPLETED:       { label: t('status', 'completed'),         cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/28' },
    CANCELLED:       { label: t('status', 'cancelled'),         cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/28' },
    FAILED:          { label: t('status', 'rejected_short'),    cls: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-500/28' },
  };
}

function getPaymentStatusMap(t) {
  return {
    UNPAID:   { label: t('payment', 'unpaid'),    cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/28' },
    PAID:     { label: t('payment', 'paid'),      cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/28' },
    REFUNDED: { label: t('status', 'refunded'),   cls: 'bg-canvas text-ink-2 ring-line' },
  };
}

function getExpiryBadgeMap(t) {
  return {
    WARNING: { label: t('expiry', 'expired_soon_3m'), cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/28' },
    DANGER:  { label: t('expiry', 'expired_soon_1m'), cls: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/28' },
    NONE:    null,
  };
}

export function OrderStatusBadge({ status }) {
  const { t } = useLang();
  const map = getOrderStatusMap(t);
  const cfg = map[status] || { label: status, cls: 'bg-canvas text-ink-2 ring-line' };
  return <Badge className={cfg.cls}>{cfg.label}</Badge>;
}

export function PaymentStatusBadge({ status }) {
  const { t } = useLang();
  const map = getPaymentStatusMap(t);
  const cfg = map[status] || { label: status, cls: 'bg-canvas text-ink-2 ring-line' };
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
  if (Math.abs(v) < 0.1) return <Badge className="bg-canvas text-muted ring-line">±0%</Badge>;
  const up = v > 0;
  return (
    <Badge className={up ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-500/28' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/28'}>
      {up ? '+' : ''}{v.toFixed(1)}%
    </Badge>
  );
}
