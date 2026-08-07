// src/components/admin/CustomerOrderHistory.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ShoppingBag, CheckCircle2, Clock, DollarSign,
  AlertTriangle, CreditCard, Package, TrendingUp,
  Clock3, XCircle, Truck, CreditCard as CardIcon, FileText,
} from 'lucide-react';
import api from '../../api/axios';
import { adminOrderApi } from '../../api/adminApi';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPrice(n) {
  if (!n && n !== 0) return '0 đ';
  const num = Number(n);
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace('.0', '') + ' tỷ';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + ' tr';
  return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Số ngày còn lại đến deadline (có thể âm = quá hạn)
function daysUntil(deadlineMillis) {
  if (!deadlineMillis) return null;
  const diff = deadlineMillis - Date.now();
  return Math.ceil(diff / 86400000);
}



// Badge hạn thanh toán — màu theo độ khẩn
function DeadlineBadge({ deadlineMillis, deadlineStr, onExtend }) {
  if (!deadlineMillis || !deadlineStr) return null;

  const days = daysUntil(deadlineMillis);

  let bg, label;
  if (days < 0) {
    bg = 'bg-red-100 dark:bg-red-500/18 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/35';
    label = `Quá hạn ${Math.abs(days)} ngày`;
  } else if (days <= 3) {
    bg = 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/28';
    label = `Còn ${days} ngày (${deadlineStr})`;
  } else if (days <= 6) {
    bg = 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-500/28';
    label = `Còn ${days} ngày (${deadlineStr})`;
  } else {
    // 👉 đổi từ xám → xanh dương
    bg = 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-500/28';
    label = `Còn ${days} ngày (${deadlineStr})`;
  }

  return (
    <button
      onClick={onExtend}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${bg}
        hover:opacity-80 transition`}
      title="Click để gia hạn"
    >
      <Clock3 size={9} /> {label}
    </button>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, accent = 'gold', sub }) {
  const colors = {
    gold: { bg: 'bg-gold/10', icon: 'text-gold' },
    green: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', icon: 'text-blue-500' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-500/10', icon: 'text-orange-500' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-500/10', icon: 'text-purple-500' },
    red: { bg: 'bg-red-50 dark:bg-red-500/10', icon: 'text-red-500' },
  };
  const c = colors[accent] || colors.gold;
  return (
    <div className="bg-surface rounded-2xl border border-line-soft shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] sm:text-xs text-muted font-medium">{label}</p>
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Icon size={13} className={c.icon} />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-ink tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CustomerOrderHistory({ customerId, apiPrefix = '/api/admin', onBack }) {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // ── Status config ─────────────────────────────────────────────────────────────
  const STATUS_MAP = {
    PENDING: { label: t('status', 'pending'), bg: 'bg-amber-50 dark:bg-amber-500/10   text-amber-600 dark:text-amber-300   border-amber-200 dark:border-amber-500/28', icon: Clock },
    CONFIRMED: { label: t('status', 'confirmed'), bg: 'bg-sky-50 dark:bg-sky-500/10     text-sky-600 dark:text-sky-300     border-sky-200 dark:border-sky-500/28', icon: CheckCircle2 },
    PREPARING: { label: t('status', 'preparing'), bg: 'bg-blue-50 dark:bg-blue-500/10    text-blue-600 dark:text-blue-300    border-blue-200 dark:border-blue-500/28', icon: Package },
    READY: { label: t('status', 'ready'), bg: 'bg-indigo-50 dark:bg-indigo-500/10  text-indigo-600 dark:text-indigo-300  border-indigo-200 dark:border-indigo-500/28', icon: CheckCircle2 },
    DELIVERING: { label: t('status', 'delivering_short'), bg: 'bg-purple-50 dark:bg-purple-500/10  text-purple-600 dark:text-purple-300  border-purple-200 dark:border-purple-500/28', icon: Truck },
    PENDING_PAYMENT: { label: t('status', 'pending_payment'), bg: 'bg-orange-50 dark:bg-orange-500/10  text-orange-600 dark:text-orange-300  border-orange-200 dark:border-orange-500/28', icon: CardIcon },
    COMPLETED: { label: t('status', 'completed'), bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28', icon: CheckCircle2 },
    CANCELLED: { label: t('status', 'cancelled'), bg: 'bg-red-50 dark:bg-red-500/10     text-red-500     border-red-200 dark:border-red-500/28', icon: XCircle },
    FAILED: { label: t('status', 'rejected_short'), bg: 'bg-red-50 dark:bg-red-500/10     text-red-700 dark:text-red-300     border-red-300 dark:border-red-500/35', icon: XCircle },
  };

  const PAYMENT_METHOD_LABELS = {
    CASH: '💵 Tiền mặt',
    BANK_TRANSFER: '🏦 Chuyển khoản',
    DEBT: '📋 Công nợ',
  };

  function StatusBadge({ status }) {
    const cfg = STATUS_MAP[status] || STATUS_MAP.PENDING;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.bg}`}>
        <Icon size={9} /> {cfg.label}
      </span>
    );
  }

  // Thêm component ReceiptBadge
  function ReceiptBadge({ receiptNumbers, paymentStatus }) {
    if (!receiptNumbers || receiptNumbers.length === 0) return null;

    // PAID → xanh lá, PARTIAL → xanh dương
    const isPaid = paymentStatus === 'PAID';
    const bgColor = isPaid ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/28';

    return (
      <div className="flex flex-wrap gap-1">
        {receiptNumbers.map((rn, idx) => (
          <span key={idx}
            className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${bgColor}`}>
            <FileText size={9} /> {rn}
          </span>
        ))}
      </div>
    );
  }

  const showToast = useCallback((msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const [extendModal, setExtendModal] = useState({
    open: false,
    orderId: null,
    days: 1,
    loading: false,
  });

  const submitExtendDeadline = async () => {
    const { orderId, days } = extendModal;

    if (!days || days <= 0) {
      showToast('Số ngày không hợp lệ');
      return;
    }

    setExtendModal(prev => ({ ...prev, loading: true }));

    try {
      await adminOrderApi.extendDeadline(orderId, days);

      // 👉 lấy orderCode để show toast
      const order = (data?.orders || []).find(o => o.id === orderId);

      const res = await api.get(`${apiPrefix}/customers/${customerId}/orders`);
      if (res.data?.success) setData(res.data.data);

      setExtendModal({ open: false, orderId: null, days: 1, loading: false });

      showToast(
        `Gia hạn thành công cho đơn hàng ${order?.orderCode || ''}, thêm ${days} ngày`,
        'success'
      );
    } catch (e) {
      showToast(e.message || 'Lỗi gia hạn');
      setExtendModal(prev => ({ ...prev, loading: false }));
    }
  };

  const openExtendModal = (orderId) => {
    setExtendModal({
      open: true,
      orderId,
      days: 1,
      loading: false,
    });
  };

  const handleExtendDeadline = async (orderId) => {
    const input = prompt('Nhập số ngày muốn gia hạn:', '3');
    if (!input) return;

    const days = parseInt(input);
    if (isNaN(days) || days <= 0) {
      showToast('Số ngày không hợp lệ', 'error');
      return;
    }

    try {
      await adminOrderApi.extendDeadline(orderId, days);

      const order = (data?.orders || []).find(o => o.id === orderId);

      const res = await api.get(`${apiPrefix}/customers/${customerId}/orders`);
      if (res.data?.success) setData(res.data.data);

      showToast(
        `Gia hạn thành công cho đơn hàng ${order?.orderCode || ''}, thêm ${days} ngày`,
        'success'
      );
    } catch (e) {
      showToast(e.message || 'Lỗi gia hạn', 'error');
    }
  };

  useEffect(() => {
    setLoading(true);
    api.get(`${apiPrefix}/customers/${customerId}/orders`)
      .then(res => {
        const body = res.data;
        if (body?.success) setData(body.data);
        else setError(body?.message || 'Lỗi tải dữ liệu');
      })
      .catch(e => setError(e?.response?.data?.message || 'Lỗi kết nối'))
      .finally(() => setLoading(false));
  }, [customerId, apiPrefix]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted hover:text-ink mb-4">
        <ArrowLeft size={16} /> Quay lại
      </button>
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-2xl p-4 text-red-600 dark:text-red-300 text-sm">{error}</div>
    </div>
  );

  if (!data) return null;

  const orders = data.orders || [];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {toast && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 12,
          background: toast.type === 'error' ? 'var(--c-danger)' : 'var(--c-success)',
          color: 'var(--c-surface)',
          padding: '10px 20px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          zIndex: 99999,
          boxShadow: '0 4px 16px rgba(0,0,0,.2)',
          maxWidth: '80vw',
          textAlign: 'center',
          animation: 'fadeInUp .2s ease',
        }}>
          {toast.msg}
        </div>
      )}
      {
        extendModal.open && (
          <>
            {/* overlay */}
            <div
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setExtendModal({ open: false })}
            />

            {/* modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="bg-surface w-full max-w-sm rounded-2xl shadow-xl border border-line-soft p-5">

                <h3 className="text-lg font-bold text-ink mb-3">
                  Gia hạn thanh toán
                </h3>

                <p className="text-sm text-muted mb-4">
                  Nhập số ngày muốn gia hạn thêm
                </p>

                <input
                  type="number"
                  min="1"
                  value={extendModal.days}
                  onChange={(e) =>
                    setExtendModal(prev => ({
                      ...prev,
                      days: parseInt(e.target.value) || 0
                    }))
                  }
                  onFocus={(e) => e.target.select()} // 👈 (yêu cầu 4 luôn)
                  className="w-full border border-line rounded-xl px-3 py-2 text-sm
    focus:outline-none focus:border-gold
    appearance-none [&::-webkit-outer-spin-button]:appearance-none
    [&::-webkit-inner-spin-button]:appearance-none"
                />

                <div className="flex justify-end gap-2 mt-5">
                  <button
                    onClick={() => setExtendModal({ open: false })}
                    className="px-4 py-2 text-sm rounded-xl border border-line text-muted
              hover:bg-surface-2"
                  >
                    Huỷ
                  </button>

                  <button
                    onClick={submitExtendDeadline}
                    disabled={extendModal.loading}
                    className="px-4 py-2 text-sm rounded-xl bg-gold text-white
              hover:bg-gold-strong disabled:opacity-50"
                  >
                    {extendModal.loading ? 'Đang xử lý...' : t('common', 'confirm')}
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      }

      {/* Back + Header */}
      <div>
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors mb-3">
          <ArrowLeft size={15} /> Quay lại danh sách
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg
            ${data.customerType === 'COMPANY' ? 'bg-blue-500' : 'bg-gold'}`}>
            {(data.customerName || '?')[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink">{data.customerName}</h1>
            <p className="text-xs text-muted">
              {data.customerPhone}
              {data.customerCode && <span> · #{data.customerCode}</span>}
              {data.debtDays > 0 && <span className="ml-2 text-orange-500">📋 Công nợ {data.debtDays} ngày</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Tổng đơn" value={data.totalOrders} icon={ShoppingBag} accent="gold" />
        <StatCard label="Đã hoàn thành" value={data.completedOrders} icon={CheckCircle2} accent="green" />
        <StatCard label="Đang xử lý" value={data.activeOrders} icon={Clock} accent="blue" />
        <StatCard label="Tổng tiền (tất cả)" value={formatPrice(data.totalAmount)} icon={DollarSign} accent="gold" />
        <StatCard label="Đã thanh toán" value={formatPrice(data.completedAmount)} icon={TrendingUp} accent="green" />
        <StatCard label="Chờ thanh toán" value={formatPrice(data.pendingPaymentAmount)} icon={AlertTriangle} accent="orange" />
      </div>

      {/* Orders table */}
      <div className="bg-surface rounded-2xl border border-line-soft shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-line-soft">
          <h2 className="font-bold text-ink">Lịch sử đơn hàng ({orders.length})</h2>
        </div>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted gap-2">
            <ShoppingBag size={32} strokeWidth={1} />
            <p className="text-sm">Chưa có đơn hàng nào</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-canvas border-b border-line-soft">
                  <tr>
                    {[t('order', 'order_code'), 'Thời gian', 'Người đặt', t('order', 'total_amount'), t('payment', 'payment'), t('common', 'status'), 'Hạn TT', 'Phiếu thu'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-muted uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-b border-line-soft last:border-0 hover:bg-canvas transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-gold whitespace-nowrap">
                        {o.orderCode}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink whitespace-nowrap">
                        {o.orderedByName || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-ink whitespace-nowrap">
                        {formatPrice(o.finalAmount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                        {PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3">
                        <DeadlineBadge
                          deadlineMillis={o.paymentDeadlineMillis}
                          deadlineStr={o.paymentDeadline}
                          onExtend={() => openExtendModal(o.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <ReceiptBadge
                          receiptNumbers={o.receiptNumbers}
                          paymentStatus={o.receiptPaymentStatus}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-line-soft">
              {orders.map(o => (
                <div key={o.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="font-mono text-xs font-bold text-gold">{o.orderCode}</p>
                    <p className="text-xs font-bold text-ink">{formatPrice(o.finalAmount)}</p>
                  </div>
                  <p className="text-[10px] text-muted">{formatDate(o.createdAt)}</p>
                  {o.orderedByName && (
                    <p className="text-[10px] text-muted">Bởi: {o.orderedByName}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge status={o.status} />
                    {o.paymentMethod && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-surface-2 text-muted border-line">
                        {PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod}
                      </span>
                    )}
                  </div>
                  {o.paymentDeadlineMillis && (
                    <DeadlineBadge
                      deadlineMillis={o.paymentDeadlineMillis}
                      deadlineStr={o.paymentDeadline}
                      onExtend={() => openExtendModal(o.id)}
                    />
                  )}
                  {/* Thêm phiếu thu */}
                  <ReceiptBadge
                    receiptNumbers={o.receiptNumbers}
                    paymentStatus={o.receiptPaymentStatus}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );


}