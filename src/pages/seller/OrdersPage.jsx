// src/pages/seller/OrdersPage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { accountantApi, orderApi, categoryApi, downloadBlob, paymentApi, getImageUrl } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import CancelOrderModal from '../../components/common/CancelOrderModal';
import SuperSellerCancelOrderModal from '../../components/seller/SuperSellerCancelOrderModal';
import OrderDetailModal from '../../components/seller/OrderDetailModal';
import DateRangePicker from '../../components/ui/DateRangePicker';
import { formatPrice } from '../../utils/formatPrice';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  Clock, CheckCircle, XCircle, Truck, Package, CreditCard,
  ChevronDown, DollarSign, X, AlertCircle, Calendar,
  Download, FileText, List, Ban, Edit2, FileBarChart,
  ClipboardCheck,
  FileClock, Ticket,
} from 'lucide-react';
import VoucherPaymentModal from '../../components/payment/VoucherPaymentModal';
import { PageToggle } from '../../components/common/PageSwitchButtons';
import EditOrderModal from '../../components/seller/EditOrderModal';

const CANCELLABLE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERING']);

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatDateShort(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function parseVND(str) { return Number(String(str).replace(/[^0-9]/g, '')); }

/**
 * Mở blob PDF ở tab mới để xem trước / in ngay.
 * (downloadBlob dùng chung đang hard-code MIME xlsx nên không dùng được cho PDF.)
 * Nếu trình duyệt chặn popup thì fallback sang tải file về.
 */
function openPdfBlob(blobData, filename) {
  const url = URL.createObjectURL(new Blob([blobData], { type: 'application/pdf' }));
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function BtnSpinner({ size = 13, colorClass = 'border-current' }) {
  return <div style={{ width: size, height: size }} className={`border-2 ${colorClass} border-t-transparent rounded-full animate-spin flex-shrink-0`} />;
}
function StatusBadge({ status }) {
  const { t } = useLang();
  const STATUS_MAP = {
    PENDING: { label: t('status', 'pending'), bg: 'bg-amber-50 dark:bg-amber-500/10   text-amber-600 dark:text-amber-300   border-amber-200 dark:border-amber-500/28', icon: Clock },
    CONFIRMED: { label: t('status', 'confirmed'), bg: 'bg-sky-50 dark:bg-sky-500/10     text-sky-600 dark:text-sky-300     border-sky-200 dark:border-sky-500/28', icon: CheckCircle },
    PREPARING: { label: t('status', 'preparing'), bg: 'bg-blue-50 dark:bg-blue-500/10    text-blue-600 dark:text-blue-300    border-blue-200 dark:border-blue-500/28', icon: Package },
    READY: { label: t('status', 'ready'), bg: 'bg-indigo-50 dark:bg-indigo-500/10  text-indigo-600 dark:text-indigo-300  border-indigo-200 dark:border-indigo-500/28', icon: CheckCircle },
    DELIVERING: { label: t('status', 'delivering_short'), bg: 'bg-purple-50 dark:bg-purple-500/10  text-purple-600 dark:text-purple-300  border-purple-200 dark:border-purple-500/28', icon: Truck },
    PENDING_PAYMENT: { label: t('status', 'pending_payment'), bg: 'bg-orange-50 dark:bg-orange-500/10  text-orange-600 dark:text-orange-300  border-orange-200 dark:border-orange-500/28', icon: CreditCard },
    COMPLETED: { label: t('status', 'completed'), bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28', icon: CheckCircle },
    CANCELLED: { label: t('status', 'cancelled'), bg: 'bg-red-50 dark:bg-red-500/10     text-red-500     border-red-200 dark:border-red-500/28', icon: XCircle },
    FAILED: { label: t('status', 'rejected_short'), bg: 'bg-red-50 dark:bg-red-500/10     text-red-700 dark:text-red-300     border-red-300 dark:border-red-500/35', icon: XCircle },
  };
  const cfg = STATUS_MAP[status] || STATUS_MAP.PENDING;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.bg}`}>
      <Icon size={9} /> {cfg.label}
    </span>
  );
}

function PaymentMethodBadge({ method }) {
  const { t } = useLang();
  const PAYMENT_METHOD_MAP = {
    CASH: { label: t('payment', 'cash_icon'), bg: 'bg-green-50 dark:bg-green-500/10  text-green-700 dark:text-green-300  border-green-200 dark:border-green-500/28' },
    BANK_TRANSFER: { label: t('payment', 'bank_transfer_icon'), bg: 'bg-blue-50 dark:bg-blue-500/10   text-blue-700 dark:text-blue-300   border-blue-200 dark:border-blue-500/28' },
    DEBT: { label: t('payment', 'debt_icon'), bg: 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/28' },
  };
  const cfg = PAYMENT_METHOD_MAP[method];
  if (!cfg) return <span className="text-xs text-muted">{method || '—'}</span>;
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function WarehouseBadge({ name }) {
  if (!name) return <span className="text-xs text-muted">—</span>;
  return <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/28 whitespace-nowrap">🏭 {name}</span>;
}
function SellerBadge({ name }) {
  if (!name) return <span className="text-xs text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/28 whitespace-nowrap">
      🏪 {name}
    </span>
  );
}

function CreatedByBadge({ name }) {
  if (!name) return <span className="text-xs text-muted">—</span>;
  return <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-surface-2 text-muted border-line whitespace-nowrap">👤 {name}</span>;
}

function PaymentMethodCell({ value, onSave, disabled }) {
  const { t } = useLang();
  const PAYMENT_METHODS = [
    { value: 'CASH', label: t('payment', 'cash_icon') },
    { value: 'BANK_TRANSFER', label: t('payment', 'bank_transfer_icon') },
    { value: 'DEBT', label: t('payment', 'debt_icon') },
  ];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const handleSelect = (val) => { setOpen(false); if (val !== value) onSave(val); };

  /*
   * Dropdown render qua PORTAL ra <body> thay vì đặt absolute trong ô bảng.
   *
   * Bảng có vùng cuộn riêng; khi chỉ có 1–2 đơn thì vùng đó thấp hơn dropdown và nó bị
   * cắt mất — đúng lỗi trong ảnh chụp. Đưa ra ngoài body thì không còn tổ tiên nào cắt
   * được, và toạ độ lấy từ getBoundingClientRect nên vẫn dính đúng vị trí nút.
   */
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      // Không đủ chỗ bên dưới thì lật lên trên, tránh dropdown chạy khỏi màn hình.
      const openUp = window.innerHeight - r.bottom < 140;
      setPos({ left: r.left, top: openUp ? r.top - 4 : r.bottom + 4, openUp });
    }
    setOpen(true);
  };

  if (disabled) return <PaymentMethodBadge method={value} />;

  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggle} className="inline-flex items-center gap-1 group">
        <PaymentMethodBadge method={value} />
        <ChevronDown size={10} className="text-gold opacity-70 group-hover:opacity-100 transition-opacity" />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div
            style={{
              left: pos.left,
              top: pos.top,
              transform: pos.openUp ? 'translateY(-100%)' : undefined,
            }}
            className="fixed z-[91] bg-surface border border-line rounded-xl shadow-lg py-1 min-w-[160px]">
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} onClick={() => handleSelect(m.value)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-canvas transition-colors ${m.value === value ? 'font-bold text-gold' : 'text-ink'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </>,
        document.body)}
    </div>
  );
}

// ── PartialPaymentModal ─────────────────────────────────────────────────────
function PartialPaymentModal({ order, onClose, onConfirm, loading }) {
  const finalAmount = Number(order?.finalAmount || 0); const alreadyPaid = Number(order?.paidAmount || 0); const remaining = finalAmount - alreadyPaid;
  const [amountInput, setAmountInput] = useState(''); const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDays, setDeadlineDays] = useState(''); const [paymentMethod, setPaymentMethod] = useState(order?.paymentMethod || 'CASH');
  const [bankName, setBankName] = useState(''); const [transactionRef, setTransactionRef] = useState('');
  const [error, setError] = useState(''); const [txHistory, setTxHistory] = useState([]); const [txLoading, setTxLoading] = useMinLoading();
  const [waiveConfirm, setWaiveConfirm] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);

  useEffect(() => { paymentApi.getTransactions(order.id).then(r => setTxHistory(r.data?.data || [])).catch(() => { }).finally(() => setTxLoading(false)); }, [order.id]);

  const paidNum = parseVND(amountInput); const newRemaining = remaining - paidNum;
  const totalWouldPay = alreadyPaid + paidNum; const shortfall = finalAmount - totalWouldPay;
  const isFullPayment = paidNum === remaining && paidNum > 0; const canWaive = paidNum > 0 && shortfall > 0 && shortfall < 50000;
  const isBankTransfer = paymentMethod === 'BANK_TRANSFER';

  const handleAmountChange = (e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); setAmountInput(raw ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : ''); setError(''); };
  const handleConfirm = () => {
    if (!paidNum || paidNum <= 0) { setError('Vui lòng nhập số tiền thu được'); return; }
    if (paidNum > remaining) { setError(`Số tiền không được vượt quá số còn lại (${formatPrice(remaining)})`); return; }
    if (hasDeadline && (!deadlineDays || Number(deadlineDays) <= 0)) { setError('Vui lòng nhập số ngày hạn thanh toán hợp lệ'); return; }
    if (isBankTransfer && !bankName.trim()) { setError('Vui lòng nhập tên ngân hàng'); return; }
    onConfirm({ paidAmount: paidNum, debtDays: hasDeadline ? Number(deadlineDays) : 0, paymentMethod, bankName: isBankTransfer ? bankName.trim() : undefined, transactionRef: isBankTransfer ? transactionRef.trim() : undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft flex-shrink-0">
          <div><p className="text-[10px] text-muted uppercase tracking-wider">Ghi nhận thanh toán</p><h2 className="font-bold text-ink font-mono text-sm">{order?.orderCode}</h2></div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-surface-2"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="bg-canvas rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs"><span className="text-muted">Tổng đơn hàng</span><span className="font-semibold text-ink">{formatPrice(finalAmount)}</span></div>
            {alreadyPaid > 0 && <div className="flex justify-between text-xs"><span className="text-muted">Đã thanh toán trước</span><span className="font-semibold text-emerald-600 dark:text-emerald-300">−{formatPrice(alreadyPaid)}</span></div>}
            <div className="flex justify-between text-xs pt-1 border-t border-line"><span className="font-bold text-ink">Còn lại cần thu</span><span className="font-bold text-orange-600 dark:text-orange-300">{formatPrice(remaining)}</span></div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink">Số tiền thu được lần này</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs font-medium">₫</span>
              <input type="text" inputMode="numeric" value={amountInput} onChange={handleAmountChange} placeholder="0" autoFocus className="w-full pl-7 pr-28 py-3 border border-line rounded-xl text-sm font-bold text-ink focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20" />
              <button onClick={() => setAmountInput(new Intl.NumberFormat('vi-VN').format(remaining))} className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-gold/10 text-gold text-[10px] font-semibold hover:bg-gold/20 transition-colors">Tất cả</button>
            </div>
            {paidNum > 0 && paidNum <= remaining && (
              <div className={`flex flex-col gap-1.5 px-3 py-2 rounded-lg text-xs ${isFullPayment ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                <div className="flex items-center gap-1.5">{isFullPayment ? <><CheckCircle size={12} /> Thanh toán đủ — đơn sẽ chuyển sang <strong>Hoàn thành</strong></> : <><AlertCircle size={12} /> Còn lại: <strong>{formatPrice(newRemaining)}</strong> — đơn sẽ là <strong>Còn nợ</strong></>}</div>
                {canWaive && !waiveConfirm && <button onClick={() => setWaiveConfirm(true)} className="self-start mt-0.5 px-2.5 py-1 rounded-lg bg-amber-600/15 text-amber-800 dark:text-amber-300 text-[10px] font-semibold hover:bg-amber-600/25 transition-colors">Bỏ số lẻ {formatPrice(shortfall)} — xác nhận thu đủ luôn</button>}
                {canWaive && waiveConfirm && (
                  <div className="flex flex-col gap-1.5 p-2 bg-amber-100 dark:bg-amber-500/18 rounded-lg border border-amber-300 dark:border-amber-500/35">
                    <p className="text-[10px] font-semibold text-amber-900 dark:text-amber-300">⚠️ Xác nhận bỏ {formatPrice(shortfall)} — thực thu {formatPrice(totalWouldPay)} thay vì {formatPrice(finalAmount)}?</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => setWaiveConfirm(false)} className="flex-1 py-1 rounded-lg border border-amber-300 dark:border-amber-500/35 text-[10px] text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:bg-amber-500/10">Không</button>
                      <button onClick={() => onConfirm({ paidAmount: paidNum, debtDays: 0, paymentMethod, bankName: isBankTransfer ? bankName.trim() : undefined, transactionRef: isBankTransfer ? transactionRef.trim() : undefined, waiveRemainder: true, actualPaid: totalWouldPay })} className="flex-1 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-semibold hover:bg-amber-700">Xác nhận bỏ số lẻ</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink">Phương thức thanh toán lần này</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'CASH', label: 'Tiền mặt' },
                { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
                { value: 'DEBT', label: 'Công nợ' },
              ].map(m => <button key={m.value} onClick={() => setPaymentMethod(m.value)} className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${paymentMethod === m.value ? 'bg-gold text-white border-gold' : 'border-line text-ink-2 hover:border-gold'}`}>{m.label}</button>)}
            </div>
          </div>
          {/* Thanh toán bằng VOUCHER — luồng riêng, không phải một lựa chọn của biểu mẫu
              bên trên: khách đưa mã, hệ thống kiểm tra rồi mới trừ, số tiền do voucher
              quyết định chứ không gõ tay. */}
          <button
            onClick={() => setVoucherOpen(true)}
            className="w-full py-2 rounded-xl border-2 border-dashed border-gold/50
                       text-[11px] font-semibold text-gold hover:bg-gold/10 transition-colors
                       flex items-center justify-center gap-1.5">
            <Ticket size={13} /> Thanh toán bằng voucher
          </button>
          {isBankTransfer && (
            <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-100 dark:border-blue-500/18">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Thông tin chuyển khoản</p>
              <div><label className="block text-[10px] font-medium text-blue-600 dark:text-blue-300 mb-1">Tên ngân hàng *</label><input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="VD: Vietcombank, BIDV..." className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-500/28 bg-surface focus:outline-none focus:border-blue-400" /></div>
              <div><label className="block text-[10px] font-medium text-blue-600 dark:text-blue-300 mb-1">Mã giao dịch</label><input value={transactionRef} onChange={e => setTransactionRef(e.target.value)} placeholder="VD: FT23161234567" className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 dark:border-blue-500/28 bg-surface focus:outline-none focus:border-blue-400" /></div>
            </div>
          )}
          {!isFullPayment && paidNum > 0 && paidNum < remaining && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setHasDeadline(v => !v)} className={`w-9 h-5 rounded-full transition-colors relative ${hasDeadline ? 'bg-gold' : 'bg-surface-3'}`}><div className={`absolute top-0.5 w-4 h-4 bg-surface rounded-full shadow transition-transform ${hasDeadline ? 'translate-x-4' : 'translate-x-0.5'}`} /></div>
                <span className="text-xs font-medium text-ink">Đặt hạn cho phần còn nợ</span>
              </label>
              {hasDeadline && <div className="flex items-center gap-2 pl-11"><Calendar size={13} className="text-muted shrink-0" /><input type="number" min="1" max="365" value={deadlineDays} onChange={e => { setDeadlineDays(e.target.value); setError(''); }} placeholder="Số ngày" className="w-24 px-3 py-1.5 border border-line rounded-lg text-xs focus:outline-none focus:border-gold text-center font-bold" /><span className="text-xs text-muted">ngày kể từ hôm nay</span></div>}
            </div>
          )}
          {error && <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 rounded-lg text-xs"><AlertCircle size={12} /> {error}</div>}
          {!txLoading && txHistory.length > 0 && (
            <div><p className="text-xs font-semibold text-ink-2 mb-2">Lịch sử thanh toán ({txHistory.length} lần)</p>
              <div className="space-y-2">{txHistory.map((tx, i) => (
                <div key={tx.id} className="flex items-start gap-3 p-3 bg-canvas rounded-xl border border-line-soft">
                  <div className="w-5 h-5 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-[9px] font-bold text-gold">{i + 1}</span></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between"><span className="text-xs font-semibold text-ink">{formatPrice(tx.amount)}</span><span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tx.paymentMethod === 'BANK_TRANSFER' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' : tx.paymentMethod === 'DEBT' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>{tx.paymentMethod === 'CASH' ? '💵 TM' : tx.paymentMethod === 'BANK_TRANSFER' ? '🏦 CK' : tx.paymentMethod === 'DEBT' ? '📋 Nợ' : tx.paymentMethod}</span></div>
                    {tx.bankName && <p className="text-[10px] text-ink-2 mt-0.5">{tx.bankName}{tx.transactionRef ? ` — ${tx.transactionRef}` : ''}</p>}
                    <p className="text-[10px] text-muted">{tx.collectedBy} · {formatDateShort(tx.createdAt)}</p>
                  </div>
                </div>
              ))}</div>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-line-soft flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-muted hover:bg-surface-2 transition-colors font-medium">Huỷ</button>
          <button onClick={handleConfirm} disabled={loading || !paidNum || paidNum <= 0} className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? <BtnSpinner size={14} colorClass="border-white/40 !border-t-white" /> : <><DollarSign size={14} /> Xác nhận thu tiền</>}
          </button>
        </div>
      </div>

      {voucherOpen && (
        <VoucherPaymentModal
          order={order}
          onClose={() => setVoucherOpen(false)}
          onSuccess={() => { setVoucherOpen(false); onClose(); }}
        />
      )}
    </div>
  );
}

function StatusActionButtons({ order, onCancel, onEdit, onVoucher, loading, disabled, isSuperSeller }) {
  const { status } = order;
  const isCancelled = status === 'CANCELLED';

  // SUPER_SELLER: sửa được mọi trạng thái trừ CANCELLED
  // Seller thường: chỉ sửa PREPARING
  const canEdit = isSuperSeller
    ? !isCancelled
    : status === 'PREPARING';

  const locked = (status === 'COMPLETED' || isCancelled || status === 'FAILED') && !canEdit;
  // Đơn khoá nhưng vẫn còn nợ tiền thì vẫn phải cho thu bằng voucher.
  if (locked && !(Number(order.finalAmount || 0) - Number(order.paidAmount || 0) > 0
        && status !== 'CANCELLED' && status !== 'FAILED'))
    return <span className="text-[10px] text-faint">—</span>;

  // SUPER_SELLER: hủy được mọi trạng thái trừ CANCELLED
  // Seller thường: chỉ hủy được các trạng thái chưa xử lý xong (CANCELLABLE_STATUSES)
  const canCancel = isSuperSeller ? !isCancelled : CANCELLABLE_STATUSES.has(status);

  /*
   * Nút thanh toán bằng voucher hiện khi đơn CÒN THIẾU TIỀN và chưa huỷ.
   *
   * Điều kiện dựa trên SỐ TIỀN còn lại chứ không dựa trên trạng thái đơn: đơn phải trả
   * trước vẫn đang PREPARING mà đã cần thu, còn đơn đã giao thì nằm ở PENDING_PAYMENT —
   * lọc theo trạng thái sẽ bỏ sót một trong hai.
   */
  const remainingDue = Number(order.finalAmount || 0) - Number(order.paidAmount || 0);
  const canPayVoucher = !isCancelled && status !== 'FAILED' && remainingDue > 0;

  if (!canEdit && !canCancel && !canPayVoucher) return null;
  if (disabled) return <span className="text-[10px] text-faint italic">Chỉ xem</span>;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {canEdit && (
        <button onClick={e => { e.stopPropagation(); onEdit?.(); }} disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/28 hover:bg-indigo-100 dark:bg-indigo-500/18 transition-colors text-[10px] font-semibold disabled:opacity-50 whitespace-nowrap">
          {loading ? <BtnSpinner size={10} colorClass="border-indigo-400 !border-t-indigo-600 dark:border-t-indigo-500/40" /> : <><Edit2 size={10} /> Sửa đơn</>}
        </button>
      )}
      {canPayVoucher && (
        <button onClick={e => { e.stopPropagation(); onVoucher?.(); }} disabled={loading}
          title="Thanh toán bằng voucher"
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition-colors text-[10px] font-semibold disabled:opacity-50 whitespace-nowrap">
          <Ticket size={10} /> Voucher
        </button>
      )}
      {canCancel && (
        <button onClick={e => { e.stopPropagation(); onCancel(); }} disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 border border-red-200 dark:border-red-500/28 hover:bg-red-100 dark:bg-red-500/18 transition-colors text-[10px] font-semibold disabled:opacity-50 whitespace-nowrap">
          {loading ? <BtnSpinner size={10} colorClass="border-red-400 !border-t-red-500" /> : <><Ban size={10} /> Hủy đơn</>}
        </button>
      )}
    </div>
  );
}

function InvoiceButton({ order, invoiceLoadingId, onInvoice }) {
  const isCancelled = order.status === 'CANCELLED';
  const isThisLoading = invoiceLoadingId === order.id;
  const isOtherLoading = !!invoiceLoadingId && !isThisLoading;
  const isDisabled = isCancelled || !!invoiceLoadingId;

  return (
    <button
      onClick={e => { e.stopPropagation(); if (!isCancelled) onInvoice(order.id, e); }}
      disabled={isDisabled}
      title={isCancelled ? 'Đơn đã huỷ' : 'Xuất hoá đơn'}
      className={`relative p-1.5 rounded-lg border transition-all duration-200
        ${isCancelled
          ? 'bg-surface-2 text-faint border-line-soft cursor-not-allowed opacity-40'
          : isThisLoading
            ? 'bg-gold/15 text-gold border-gold/40 cursor-wait ring-2 ring-gold/30 ring-offset-1'
            : isOtherLoading
              ? 'bg-surface-2 text-faint border-line-soft cursor-not-allowed opacity-40'
              : 'bg-gold/10 text-gold border-transparent hover:bg-gold/20 hover:scale-105 active:scale-95'}`}>
      {isThisLoading
        ? <BtnSpinner size={13} colorClass="border-gold !border-t-transparent" />
        : <FileText size={13} />}
      {isThisLoading && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium bg-chrome text-white px-2 py-0.5 rounded-md pointer-events-none z-10">
          Đang tạo...
        </span>
      )}
    </button>
  );
}

function getRowBg(o) {
  if (o.status === 'COMPLETED') return 'bg-emerald-50/70 dark:bg-emerald-500/7';
  if (o.status === 'DELIVERING' || o.status === 'PENDING_PAYMENT') {
    if (o.debtDays > 0 && o.pendingPaymentAt) { const dl = o.pendingPaymentAt + o.debtDays * 86400000; if (dl - Date.now() < 3 * 86400000) return 'bg-red-50/70 dark:bg-red-500/7'; }
    return 'bg-orange-50/50 dark:bg-orange-500/5';
  }
  return '';
}

export default function OrdersPage() {
  const { t } = useLang();
  const toast = useToast();
  const [orders, setOrders] = useState([]); const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(null); const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0); const [loading, setLoading] = useMinLoading();
  const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [actionLoading, setActionLoading] = useState(null); const [exporting, setExporting] = useState(false);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
  const [partialOrder, setPartialOrder] = useState(null); const [partialLoading, setPartialLoading] = useMinLoading();
  const [selectedIds, setSelectedIds] = useState(new Set()); const [bulkConfirm, setBulkConfirm] = useState(null);
  const [bulkLoading, setBulkLoading] = useMinLoading(); const [pageSize, setPageSize] = useState(100);
  const [bulkCancelReason, setBulkCancelReason] = useState('');
  /** Đơn đang mở hộp thoại thanh toán bằng voucher từ cột Thao tác. */
  const [voucherOrder, setVoucherOrder] = useState(null);

  const [exportDateRange, setExportDateRange] = useState({ from: null, to: null });
  const [showExportPicker, setShowExportPicker] = useState(false);
  // Loại báo cáo trong modal export: ORDER = đơn hàng (Excel, như cũ) | PRODUCT = sản phẩm (PDF để in)
  const [exportType, setExportType] = useState('ORDER');
  const [exportCategories, setExportCategories] = useState([]);
  const [exportCategoryIds, setExportCategoryIds] = useState([]);   // [] = tất cả

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState('INGREDIENT');
  const [reportDateRange, setReportDateRange] = useState({ from: null, to: null });
  const [reportCategories, setReportCategories] = useState([]);
  const [reportCategoryId, setReportCategoryId] = useState('');
  const [exportingReport, setExportingReport] = useState(false);

  const STATUS_MAP = {
    CONFIRMED: { label: t('status', 'confirmed'), bg: 'bg-sky-50 dark:bg-sky-500/10     text-sky-600 dark:text-sky-300     border-sky-200 dark:border-sky-500/28', icon: CheckCircle },
    PREPARING: { label: t('status', 'preparing'), bg: 'bg-blue-50 dark:bg-blue-500/10    text-blue-600 dark:text-blue-300    border-blue-200 dark:border-blue-500/28', icon: Package },
    READY: { label: t('status', 'ready'), bg: 'bg-indigo-50 dark:bg-indigo-500/10  text-indigo-600 dark:text-indigo-300  border-indigo-200 dark:border-indigo-500/28', icon: CheckCircle },
    DELIVERING: { label: t('status', 'delivering_short'), bg: 'bg-purple-50 dark:bg-purple-500/10  text-purple-600 dark:text-purple-300  border-purple-200 dark:border-purple-500/28', icon: Truck },
    PENDING_PAYMENT: { label: t('status', 'pending_payment'), bg: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-500/28', icon: CreditCard },
    COMPLETED: { label: t('status', 'completed'), bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28', icon: CheckCircle },
    CANCELLED: { label: t('status', 'cancelled'), bg: 'bg-red-50 dark:bg-red-500/10     text-red-500     border-red-200 dark:border-red-500/28', icon: XCircle },
    FAILED: { label: t('status', 'rejected_short'), bg: 'bg-red-50 dark:bg-red-500/10     text-red-700 dark:text-red-300     border-red-300 dark:border-red-500/35', icon: XCircle },
  };
  const FILTER_TABS = [
    { value: 'ALL', label: t('common', 'all') },
    { value: 'PREPARING', label: t('status', 'preparing') },
    { value: 'DELIVERING', label: t('status', 'delivering_short') },
    { value: 'PENDING_PAYMENT', label: t('status', 'pending_payment') },
    { value: 'COMPLETED', label: t('status', 'completed') },
    { value: 'CANCELLED', label: t('status', 'cancelled') },
  ];

  const [cancelTarget, setCancelTarget] = useState(null); const [cancelLoading, setCancelLoading] = useMinLoading();
  const [editTarget, setEditTarget] = useState(null);

  const totalPages = Math.ceil(total / pageSize);

  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  }, []);

  const currentId = currentUser.userId || 0;
  const isThuytm = currentId === 15;
  const isSuperSeller = currentUser.role === 'SUPER_SELLER';
  const canSeeReport = currentId === 12 || currentId === 15
    || currentUser.role === 'OWNER' || currentUser.role === 'ADMIN';

  const canActOnOrder = useCallback((o) => {
    if (isSuperSeller) return true;
    return o.createdByUserId === currentUser.userId;
  }, [isSuperSeller, currentUser.userId]);

  // label ngày hôm nay cho nút mobile
  const todayLabel = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hasDateFilter = !!(dateRange.from || dateRange.to);

  const fetchOrders = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = { page: p, size: pageSize };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) {
        params.keyword = search.trim();
      } else {
        if (dateRange.from) params.from = new Date(dateRange.from).setHours(0, 0, 0, 0);
        if (dateRange.to) params.to = new Date(dateRange.to).setHours(23, 59, 59, 999);
      }
      const res = await orderApi.getMyOrders(params);
      let content = res.data?.data?.content || [];
      if (search.trim()) { const q = search.toLowerCase(); content = content.filter(o => o.orderCode?.toLowerCase().includes(q) || o.customerName?.toLowerCase().includes(q) || o.customerPhone?.includes(q)); }
      setOrders(content); setTotal(res.data?.data?.totalItems || 0); setPage(p);
    } catch { toast('Không thể tải danh sách đơn hàng', 'error'); }
    finally { setLoading(false); }
  }, [statusFilter, dateRange, search, pageSize]);

  useEffect(() => { fetchOrders(0); }, [fetchOrders]);
  useEffect(() => { const ti = setTimeout(() => setSearch(searchInput), 500); return () => clearTimeout(ti); }, [searchInput]);

  // Nạp danh mục cho ô filter khi mở modal export
  useEffect(() => {
    if (!showExportPicker || exportCategories.length) return;
    categoryApi.getAll()
      .then(res => setExportCategories(res.data?.data ?? res.data ?? []))
      .catch(() => setExportCategories([]));
  }, [showExportPicker]);

  const toggleExportCategory = (id) => {
    setExportCategoryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const allCategoriesSelected =
    exportCategories.length > 0 && exportCategoryIds.length === exportCategories.length;
  const toggleAllExportCategories = () => {
    setExportCategoryIds(allCategoriesSelected ? [] : exportCategories.map(c => c.id));
  };

  const handleExport = async () => {
    if (!exportDateRange.from || !exportDateRange.to) { setShowExportPicker(true); return; }
    setExporting(true);
    try {
      // exportDateRange.from/to đã là timestamp từ startOfDay/endOfDay (DateRangePicker).
      // Truyền thẳng — KHÔNG dùng setHours() để tránh lệch timezone.
      const from = exportDateRange.from;
      const to = exportDateRange.to;

      if (exportType === 'PRODUCT') {
        // Báo cáo SẢN PHẨM → PDF. Chọn hết = không chọn gì = tất cả danh mục.
        const categoryIds = allCategoriesSelected ? [] : exportCategoryIds;
        const res = await orderApi.exportOrderProductReport({ from, to, categoryIds });
        const stamp = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
        openPdfBlob(res.data, `bao-cao-san-pham-${stamp}.pdf`);
        toast('Xuất báo cáo sản phẩm thành công', 'success');
      } else {
        // Báo cáo ĐƠN HÀNG → giữ nguyên như cũ (Excel)
        const params = { excludeCancelled: true, from, to };
        if (statusFilter !== 'ALL') params.status = statusFilter;
        const res = await accountantApi.exportOrders(params);
        downloadBlob(res.data, `don-hang-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`);
      }
      setShowExportPicker(false);
    } catch (err) {
      console.error(err);
      toast(exportType === 'PRODUCT' ? 'Không thể xuất báo cáo sản phẩm' : 'Không thể xuất file Excel', 'error');
    }
    finally { setExporting(false); }
  };

  useEffect(() => {
    if (showReportModal && canSeeReport) {
      orderApi.getReportCategories()
        .then(res => setReportCategories(res.data?.data ?? res.data ?? []))
        .catch(() => {});
    }
  }, [showReportModal]);

  const handleReportExport = async () => {
    if (!reportDateRange.from || !reportDateRange.to) { toast('Vui lòng chọn khoảng thời gian', 'error'); return; }
    setExportingReport(true);
    try {
      const fromDate = new Date(reportDateRange.from); fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(reportDateRange.to); toDate.setHours(23, 59, 59, 999);
      let res; let filename = '';
      if (reportType === 'INGREDIENT') {
        res = await orderApi.exportIngredients({ from: fromDate.getTime(), to: toDate.getTime() });
        filename = `nguyen-lieu-${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.xlsx`;
      } else if (reportType === 'CUSTOMER_PRODUCT') {
        res = await orderApi.exportCustomerProductReport({ from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10), ...(reportCategoryId ? { categoryId: reportCategoryId } : {}) });
        filename = `bao-cao-kh-sp-${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.xlsx`;
      } else if (reportType === 'DELIVERY') {
        res = await orderApi.exportDeliveryReport({ from: fromDate.getTime(), to: toDate.getTime() });
        filename = `bao-cao-giao-hang-${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.xlsx`;
      }
      if (res) { downloadBlob(res.data, filename); toast('Xuất báo cáo thành công', 'success'); }
      setShowReportModal(false); setReportDateRange({ from: null, to: null });
    } catch (err) { console.error(err); toast('Không thể xuất báo cáo', 'error'); }
    finally { setExportingReport(false); }
  };

  const handleInvoice = async (orderId, e) => {
    if (e) e.stopPropagation(); if (invoiceLoadingId) return; setInvoiceLoadingId(orderId);
    try { const res = await accountantApi.getInvoice(orderId); const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })); window.open(url, '_blank'); }
    catch { toast('Không thể tải hoá đơn', 'error'); } finally { setInvoiceLoadingId(null); }
  };

  const handlePendingPayment = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await accountantApi.markPendingPayment(orderId); if (res?.data?.success === false) { toast(res.data.message || 'Không thể cập nhật', 'error'); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PENDING_PAYMENT' } : o)); toast('Đã chuyển sang Chờ thanh toán', 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi cập nhật', 'error'); } finally { setActionLoading(null); }
  };

  const handleComplete = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await accountantApi.markCompleted(orderId); if (res?.data?.success === false) { toast(res.data.message || 'Không thể hoàn thành', 'error'); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'COMPLETED', paymentStatus: 'PAID', paidAmount: o.finalAmount } : o)); toast('Đã hoàn thành đơn hàng', 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi hoàn thành', 'error'); } finally { setActionLoading(null); }
  };

  const handlePartialPayment = async (payload) => {
    if (!partialOrder) return;
    const { paidAmount, debtDays = 0, paymentMethod, bankName, transactionRef, waiveRemainder, actualPaid } = payload;
    setPartialLoading(true);
    try {
      if (waiveRemainder) {
        await accountantApi.waiveRemainder(partialOrder.id, { actualPaid: Number(actualPaid), paymentMethod, bankName: paymentMethod === 'BANK_TRANSFER' ? bankName?.trim() : undefined, transactionRef: paymentMethod === 'BANK_TRANSFER' ? transactionRef?.trim() : undefined });
        setOrders(prev => prev.map(o => o.id === partialOrder.id ? { ...o, paidAmount: Number(actualPaid), paymentStatus: 'PAID', status: 'COMPLETED' } : o));
        toast(`Đã bỏ số lẻ ${formatPrice(Number(partialOrder.finalAmount) - Number(actualPaid))} — đơn hoàn thành`, 'success');
      } else {
        await accountantApi.recordPartialPayment(partialOrder.id, paidAmount, debtDays);
        const newPaid = Number(partialOrder.paidAmount || 0) + paidAmount; const isFullPaid = newPaid >= Number(partialOrder.finalAmount || 0);
        setOrders(prev => prev.map(o => o.id === partialOrder.id ? { ...o, paidAmount: newPaid, paymentStatus: isFullPaid ? 'PAID' : 'PARTIAL', status: isFullPaid ? 'COMPLETED' : 'PENDING_PAYMENT' } : o));
        toast(isFullPaid ? 'Đã thanh toán đủ — đơn hoàn thành' : `Đã ghi nhận ${formatPrice(paidAmount)}`, 'success');
      }
      setPartialOrder(null);
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi ghi nhận thanh toán', 'error'); } finally { setPartialLoading(false); }
  };

  const handleUpdatePaymentMethod = async (orderId, paymentMethod) => {
    setActionLoading(orderId);
    try {
      const res = await accountantApi.updatePaymentMethod(orderId, paymentMethod); if (res?.data?.success === false) { toast(res.data.message || 'Không thể cập nhật', 'error'); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentMethod } : o)); toast('Đã cập nhật phương thức thanh toán', 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi cập nhật', 'error'); } finally { setActionLoading(null); }
  };

  const handleCancelConfirm = async (reason) => {
    if (!cancelTarget) return; setCancelLoading(true);
    try {
      await accountantApi.cancelOrder(cancelTarget.id, reason);
      setOrders(prev => prev.map(o => o.id === cancelTarget.id ? { ...o, status: 'CANCELLED' } : o));
      setCancelTarget(null); toast('Đã hủy đơn hàng thành công', 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi hủy đơn', 'error'); }
    finally { setCancelLoading(false); }
  };

  // Mobile detail handler
  const handleMobileDetail = async (orderId) => {
    setDetailLoading(orderId);
    try {
      const [dr, lr] = await Promise.all([accountantApi.getOrderDetail(orderId), accountantApi.getOrderLogs(orderId)]);
      setSelectedOrder({ ...(dr.data?.data || orders.find(o => o.id === orderId)), logs: lr.data?.data || [] });
    } catch { setSelectedOrder(orders.find(o => o.id === orderId)); }
    finally { setDetailLoading(null); }
  };

  /**
   * Đơn có được chọn để thao tác hàng loạt không.
   *
   * <p>Chỉ ĐANG CHUẨN BỊ và ĐANG GIAO. Đơn đã giao (chờ thanh toán / thanh toán một
   * phần), đã hoàn thành, hoặc đã huỷ thì không huỷ được nữa — hàng đã ra khỏi kho và
   * công nợ đã ghi nhận, huỷ ở đây sẽ để lại tồn kho và sổ sách lệch nhau.
   */
  const isBulkSelectable = (o) =>
    o.status === 'PREPARING' || o.status === 'DELIVERING';

  const selectableOrders = useMemo(
    () => orders.filter(isBulkSelectable), [orders]);

  // Bỏ đơn không hợp lệ khỏi vùng chọn khi danh sách đổi (lọc, sang trang), tránh
  // trường hợp bấm huỷ trên một đơn đã kịp chuyển trạng thái ở tab khác.
  useEffect(() => {
    setSelectedIds(prev => {
      const ok = new Set(selectableOrders.map(o => o.id));
      const next = new Set([...prev].filter(id => ok.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [selectableOrders]);

  const executeBulkCancel = async () => {
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      // Huỷ tuần tự và đếm kết quả: API huỷ nhận từng đơn, và một đơn hỏng không nên
      // làm dừng cả lô.
      let ok = 0, failed = 0;
      for (const id of ids) {
        try { await orderApi.cancelOrder(id, bulkCancelReason.trim()); ok++; } catch { failed++; }
      }
      toast(failed === 0
        ? `Đã huỷ ${ok} đơn`
        : `Đã huỷ ${ok} đơn, ${failed} đơn thất bại`, failed === 0 ? 'success' : 'error');
      setSelectedIds(new Set());
      setBulkCancelReason('');
      fetchOrders(page);
    } catch { toast('Lỗi huỷ đơn hàng loạt', 'error'); }
    finally { setBulkLoading(false); }
  };

  const executeBulkComplete = async (mode) => {
    setBulkLoading(true);
    try {
      const res = await accountantApi.bulkComplete({ orderIds: Array.from(selectedIds), mode });
      const result = res.data?.data; const successCount = result?.success || 0; const errors = result?.errors || [];
      if (errors.length === 0) toast(`✅ Đã cập nhật thành công ${successCount} đơn`, 'success');
      else if (successCount === 0) toast(`❌ Không cập nhật được đơn nào`, 'error');
      else toast(`⚠️ ${successCount} đơn thành công, ${errors.length} đơn lỗi`, 'warning');
      setSelectedIds(new Set()); fetchOrders(page);
    } catch { toast('Lỗi bulk update', 'error'); } finally { setBulkLoading(false); }
  };

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Override calendar dropdown trên mobile — căn giữa màn hình */}
      <style>{`
        @media (max-width: 639px) {
          #mobile-date-picker-seller > div > div.absolute {
            right: auto !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            max-width: calc(100vw - 32px) !important;
          }
        }
      `}</style>

      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-surface border-b border-line-soft">

        {/* ── Desktop header (sm+) — unchanged ── */}
        <div className="hidden sm:flex items-center gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-ink">Đơn hàng</h1>
            <p className="text-[10px] sm:text-xs text-muted">{total} đơn hàng</p>
          </div>
          {/* Đơn nháp đã gỡ khỏi menu — qua lại bằng công tắc này. Trang đích bọc
              SubPageShell nên có nút quay lại và hiệu ứng trượt. */}
          <PageToggle
            current="/seller/orders"
            options={[
              { to: '/seller/orders', label: 'Đơn hàng', icon: ClipboardCheck },
              { to: '/seller/drafts', label: 'Đơn nháp', icon: FileClock },
            ]}
          />
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="text" placeholder="Tìm đơn, khách hàng..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="border border-line rounded-xl pl-9 pr-4 py-2 text-sm bg-surface focus:outline-none focus:border-gold w-48 lg:w-56" />
          </div>
          <div className="flex items-center gap-1.5">
            <DateRangePicker align="right" from={dateRange.from} to={dateRange.to} onChange={r => { setDateRange(r); setPage(0); }} placeholder="Khoảng ngày" />
          </div>
          <button onClick={() => fetchOrders(0)} className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3 transition-colors shrink-0">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowExportPicker(true)} disabled={exporting} title="Xuất Excel đơn hàng"
            className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:bg-emerald-500/18 transition-colors disabled:opacity-60 shrink-0">
            {exporting ? <BtnSpinner size={14} colorClass="border-emerald-400 !border-t-emerald-600 dark:border-t-emerald-500/40" /> : <Download size={14} />}
          </button>
          {canSeeReport && (
            <button onClick={() => setShowReportModal(true)} title="Xuất báo cáo"
              className="p-2 rounded-xl bg-gold/10 text-gold hover:bg-gold/20 transition-colors shrink-0">
              <FileBarChart size={14} />
            </button>
          )}
        </div>

        {/* ── Mobile header (< sm) — 2 rows ── */}
        <div className="sm:hidden mb-3 space-y-2">
          {/* Row 1: title + date picker + refresh + export */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-ink leading-tight">Đơn hàng</h1>
              <p className="text-[10px] text-muted">{total} đơn hàng</p>
            </div>

            {/* Nút chọn ngày — dropdown mở trực tiếp, căn giữa màn hình */}
            <div id="mobile-date-picker-seller" className="relative shrink-0">
              <DateRangePicker
                from={dateRange.from}
                to={dateRange.to}
                onChange={r => { setDateRange(r); setPage(0); }}
                placeholder={todayLabel}
                align="right"
              />
            </div>

            {/* Nút xóa filter ngày */}
            {hasDateFilter && (
              <button
                onClick={() => { setDateRange({ from: null, to: null }); setPage(0); }}
                className="p-1.5 rounded-lg border border-red-200 dark:border-red-500/28 bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-100 dark:bg-red-500/18 transition-colors shrink-0"
                title="Xóa bộ lọc ngày">
                <X size={13} />
              </button>
            )}

            <button onClick={() => fetchOrders(0)} className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3 transition-colors shrink-0">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => setShowExportPicker(true)} disabled={exporting} title="Xuất Excel"
              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:bg-emerald-500/18 transition-colors disabled:opacity-60 shrink-0">
              {exporting ? <BtnSpinner size={14} colorClass="border-emerald-400 !border-t-emerald-600 dark:border-t-emerald-500/40" /> : <Download size={14} />}
            </button>
            {canSeeReport && (
              <button onClick={() => setShowReportModal(true)} title="Xuất báo cáo"
                className="p-2 rounded-xl bg-gold/10 text-gold hover:bg-gold/20 transition-colors shrink-0">
                <FileBarChart size={14} />
              </button>
            )}
          </div>

          {/* Row 2: full-width search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Tìm đơn, khách hàng..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full border border-line rounded-xl pl-9 pr-8 py-2 text-sm bg-surface focus:outline-none focus:border-gold"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {FILTER_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${statusFilter === tab.value ? 'bg-gold text-white' : 'bg-surface-2 text-muted hover:bg-surface-3'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        {loading && orders.length === 0
          ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>
          : orders.length === 0
            ? <div className="flex flex-col items-center justify-center py-16 text-muted gap-2"><Search size={32} strokeWidth={1} /><p className="text-sm">Không có đơn hàng nào</p></div>
            : (<>
              {/* Desktop table — unchanged */}
              <div className="hidden md:block bg-surface rounded-2xl border border-line-soft overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-canvas border-b border-line-soft">
                      <tr>
                        <th className="px-3 py-3"><input type="checkbox" className="w-3.5 h-3.5 accent-gold"
                          checked={selectableOrders.length > 0 && selectedIds.size === selectableOrders.length}
                          onChange={e => setSelectedIds(e.target.checked ? new Set(selectableOrders.map(o => o.id)) : new Set())} /></th>
                        {[t('order', 'order_code'), 'Thời gian', t('customer', 'customer'), 'Kho', t('common', 'status'), 'PT Thanh toán', 'Tổng tiền / Đã thu', 'Người đặt hàng', 'Người tạo', 'Chứng từ', 'Hóa đơn', t('common', 'actions')]
                          .map(h => <th key={h} className="text-left text-[10px] font-bold text-muted uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(o => {
                        const isCompleted = o.status === 'COMPLETED' || o.status === 'CANCELLED';
                        const isActioning = actionLoading === o.id; const isThisInvoice = invoiceLoadingId === o.id;
                        const paidAmount = Number(o.paidAmount || 0);
                        return (
                          <tr key={o.id} className={`border-b border-line-soft last:border-0 transition-colors ${getRowBg(o)} ${isThisInvoice ? 'opacity-80' : ''} ${isActioning ? 'opacity-60' : ''}`}>
                            <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                              {/* Chỉ đơn chưa rời khỏi vòng giao hàng mới huỷ được. Đơn đã
                                  giao / còn nợ / hoàn thành / đã huỷ mà cho chọn thì người
                                  dùng sẽ bấm huỷ rồi nhận lỗi từ server cho từng đơn một. */}
                              <input type="checkbox" className="w-3.5 h-3.5 accent-gold disabled:opacity-30"
                                disabled={!isBulkSelectable(o)}
                                title={isBulkSelectable(o) ? '' : 'Chỉ chọn được đơn đang chuẩn bị hoặc đang giao'}
                                checked={selectedIds.has(o.id)}
                                onChange={e => { const next = new Set(selectedIds); e.target.checked ? next.add(o.id) : next.delete(o.id); setSelectedIds(next); }} /></td>
                            <td className="px-4 py-3 whitespace-nowrap"><div className="flex items-center gap-1.5"><span className="font-mono text-xs font-bold text-gold">{o.orderCode}</span>{detailLoading === o.id && <div className="w-3 h-3 border border-gold border-t-transparent rounded-full animate-spin" />}</div></td>
                            <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{formatDate(o.createdAt)}</td>
                            <td className="px-4 py-3 max-w-[160px]"><p className="text-xs font-medium text-ink break-words leading-snug">{o.customerName}</p><p className="text-[10px] text-muted">{o.customerPhone}</p></td>
                            <td className="px-4 py-3"><WarehouseBadge name={o.warehouseName} /></td>
                            <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                            <td className="px-4 py-3"><PaymentMethodCell value={o.paymentMethod} onSave={val => handleUpdatePaymentMethod(o.id, val)} disabled={isCompleted || isActioning || !!invoiceLoadingId} /></td>
                            <td className="px-4 py-3">
                              <p className="text-xs font-bold text-ink whitespace-nowrap">{formatPrice(o.finalAmount)}</p>
                              {o.status === 'COMPLETED' && o.paymentStatus === 'PAID'
                                ? (paidAmount > 0 && paidAmount !== Number(o.finalAmount) && <p className="text-[10px] text-sky-600 dark:text-sky-300 font-medium whitespace-nowrap">TT Thực tế: {formatPrice(paidAmount)}</p>)
                                : (<>{paidAmount > 0 && <p className="text-[10px] text-emerald-600 dark:text-emerald-300 font-medium whitespace-nowrap">Đã thu: {formatPrice(paidAmount)}</p>}{paidAmount > 0 && paidAmount < Number(o.finalAmount) && <p className="text-[10px] text-orange-500 font-medium whitespace-nowrap">Còn: {formatPrice(Number(o.finalAmount) - paidAmount)}</p>}</>)}
                            </td>
                            <td className="px-4 py-3"><CreatedByBadge name={o.orderedByName} /></td>
                            <td className="px-4 py-3"><SellerBadge name={o.createdByName} /></td>
                            <td className="px-4 py-3">
                              {o.receiptFileUrl
                                ? <a href={getImageUrl(o.receiptFileUrl)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/28 whitespace-nowrap hover:bg-emerald-100 dark:bg-emerald-500/18">📄 Chứng từ</a>
                                : <span className="text-[10px] text-faint">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <InvoiceButton order={o} invoiceLoadingId={invoiceLoadingId} onInvoice={handleInvoice} />
                                <button onClick={async e => {
                                  e.stopPropagation(); setDetailLoading(o.id);
                                  try {
                                    const [dr, lr] = await Promise.all([accountantApi.getOrderDetail(o.id), accountantApi.getOrderLogs(o.id)]);
                                    setSelectedOrder({ ...(dr.data?.data || o), logs: lr.data?.data || [] });
                                  } catch { setSelectedOrder(o); }
                                  finally { setDetailLoading(null); }
                                }} className="relative p-1.5 rounded-lg border bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300 border-transparent hover:bg-sky-100 dark:bg-sky-500/18 hover:scale-105 active:scale-95 transition-all duration-200">
                                  {detailLoading === o.id ? <BtnSpinner size={13} colorClass="border-sky-400 !border-t-transparent" /> : <Search size={13} />}
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <StatusActionButtons order={o} onCancel={() => setCancelTarget(o)} onEdit={() => setEditTarget(o)} onVoucher={() => setVoucherOrder(o)} loading={isActioning} disabled={!canActOnOrder(o)} isSuperSeller={isSuperSeller} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {orders.map(o => {
                  const isCompleted = o.status === 'COMPLETED' || o.status === 'CANCELLED';
                  const isActioning = actionLoading === o.id;
                  const isThisDetail = detailLoading === o.id;
                  return (
                    <div key={o.id}
                      className={`rounded-2xl border p-4 space-y-3 transition-all ${invoiceLoadingId === o.id ? 'bg-gold/5 border-gold/40' : 'bg-surface border-line-soft'} ${isActioning ? 'opacity-60' : ''}`}>
                      {/* Top: mã đơn + tiền */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs font-bold text-gold">{o.orderCode}</p>
                          <p className="text-xs font-semibold text-ink mt-0.5">{o.customerName}</p>
                          <p className="text-[10px] text-muted">{o.customerPhone}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-ink">{formatPrice(o.finalAmount)}</p>
                          <p className="text-[10px] text-muted mt-0.5">{formatDateShort(o.createdAt)}</p>
                        </div>
                      </div>
                      {/* Badges */}
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-line-soft">
                        <StatusBadge status={o.status} />
                        <WarehouseBadge name={o.warehouseName} />
                      </div>
                      {/* Actions */}
                      <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                        <CreatedByBadge name={o.orderedByName} />
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {/* Nút kính lúp — chi tiết đơn */}
                          <button
                            onClick={() => handleMobileDetail(o.id)}
                            disabled={!!detailLoading}
                            title="Chi tiết đơn"
                            className={`relative p-1.5 rounded-lg border transition-all duration-200
                              ${isThisDetail
                                ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-400 border-sky-200 dark:border-sky-500/28 cursor-wait'
                                : detailLoading
                                  ? 'bg-surface-2 text-faint border-line-soft opacity-40 cursor-not-allowed'
                                  : 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300 border-transparent hover:bg-sky-100 dark:bg-sky-500/18 hover:scale-105 active:scale-95'}`}>
                            {isThisDetail
                              ? <BtnSpinner size={13} colorClass="border-sky-400 !border-t-transparent" />
                              : <Search size={13} />}
                          </button>
                          <InvoiceButton order={o} invoiceLoadingId={invoiceLoadingId} onInvoice={handleInvoice} />
                          <PaymentMethodCell value={o.paymentMethod} onSave={val => handleUpdatePaymentMethod(o.id, val)} disabled={isCompleted || isActioning || !!invoiceLoadingId} />
                          <StatusActionButtons order={o} onCancel={() => setCancelTarget(o)} onEdit={() => setEditTarget(o)} onVoucher={() => setVoucherOrder(o)} loading={isActioning} disabled={!canActOnOrder(o)} isSuperSeller={isSuperSeller} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>)}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => fetchOrders(page - 1)} disabled={page === 0 || loading} className="p-2 rounded-xl bg-surface border border-line text-muted hover:border-gold disabled:opacity-40 transition-colors"><ChevronLeft size={15} /></button>
            <span className="text-sm text-muted px-3">{page + 1} / {totalPages}</span>
            <button onClick={() => fetchOrders(page + 1)} disabled={page >= totalPages - 1 || loading} className="p-2 rounded-xl bg-surface border border-line text-muted hover:border-gold disabled:opacity-40 transition-colors"><ChevronRight size={15} /></button>
          </div>
        )}
      </div>

      {partialOrder && <PartialPaymentModal order={partialOrder} onClose={() => setPartialOrder(null)} onConfirm={handlePartialPayment} loading={partialLoading} />}

      {voucherOrder && (
        <VoucherPaymentModal
          order={voucherOrder}
          onClose={() => setVoucherOrder(null)}
          onSuccess={() => { setVoucherOrder(null); fetchOrders(page); }}
        />
      )}

      {selectedIds.size > 0 && (() => {
        const totalSelected = orders.filter(o => selectedIds.has(o.id)).reduce((s, o) => s + Number(o.finalAmount || 0), 0);
        return (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-surface border border-line rounded-2xl shadow-xl px-4 py-2.5">
            <div className="flex flex-col mr-2"><span className="text-xs font-semibold text-ink-2">{selectedIds.size} đơn đã chọn</span><span className="text-[11px] font-bold text-gold">{new Intl.NumberFormat('vi-VN').format(Math.round(totalSelected))} đ</span></div>
            {/* Kinh doanh KHÔNG đánh dấu đã giao / hoàn thành hàng loạt nữa: hai trạng
                thái đó thuộc về kho và kế toán, và đánh dấu hàng loạt từ đây sẽ đóng đơn
                mà chưa ai thực sự giao hoặc thu tiền. Thao tác hàng loạt duy nhất còn
                lại là HUỶ đơn. */}
            <button onClick={() => setBulkConfirm({ mode: 'CANCEL' })}
              className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/28 text-xs font-semibold hover:bg-red-100 dark:bg-red-500/18">
              ✕ Huỷ {selectedIds.size} đơn
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-1 p-1.5 rounded-lg text-muted hover:bg-surface-2"><X size={13} /></button>
          </div>
        );
      })()}

      {bulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBulkConfirm(null)} />
          <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-ink">Xác nhận huỷ đơn</h2>
            <p className="text-sm text-muted">{selectedIds.size} đơn đã chọn</p>
            {/* Lý do huỷ là bắt buộc ở API huỷ đơn lẻ, nên hàng loạt cũng phải có —
                nếu không mọi đơn trong lô sẽ bị server từ chối. */}
            <textarea value={bulkCancelReason} onChange={e => setBulkCancelReason(e.target.value)}
              rows={2} placeholder="Lý do huỷ (áp dụng cho tất cả đơn đã chọn)"
              className="w-full rounded-xl border border-line px-3 py-2 text-sm bg-surface text-ink focus:outline-none focus:border-gold resize-none" />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setBulkConfirm(null)} className="flex-1 py-2 rounded-xl border border-line text-sm text-muted hover:bg-surface-2">Huỷ</button>
              <button disabled={bulkLoading || !bulkCancelReason.trim()} onClick={async () => { const c = bulkConfirm; setBulkConfirm(null); if (c.mode === 'CANCEL') await executeBulkCancel(); else await executeBulkComplete(c.mode); }} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50">{bulkLoading ? 'Đang xử lý...' : 'Huỷ các đơn đã chọn'}</button>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onRefresh={fetchOrders} />}

      {/* Modal chọn ngày Export đơn hàng */}
      {showExportPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowExportPicker(false)} />
          <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">Xuất báo cáo</h2>
              <button onClick={() => setShowExportPicker(false)} className="p-1.5 rounded-lg text-muted hover:bg-surface-2"><X size={16} /></button>
            </div>

            {/* Chọn loại báo cáo */}
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1.5">Loại báo cáo</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'ORDER', label: '🧾 Đơn hàng', active: 'bg-emerald-500 text-white border-emerald-500', hover: 'hover:border-emerald-300 dark:border-emerald-500/35' },
                  { key: 'PRODUCT', label: '📦 Sản phẩm', active: 'bg-gold text-white border-gold', hover: 'hover:border-gold/50' },
                ].map(r => (
                  <button key={r.key} onClick={() => setExportType(r.key)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${exportType === r.key ? r.active : `border-line text-ink-2 ${r.hover}`}`}>
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted mt-1.5">
                {exportType === 'ORDER'
                  ? 'Báo cáo đơn hàng — file Excel như hiện tại.'
                  : 'Báo cáo chi tiết sản phẩm theo từng đơn — file PDF khổ A4 để in.'}
              </p>
            </div>

            <p className="text-xs text-muted">
              {exportType === 'PRODUCT'
                ? 'Chỉ gồm đơn: Đang chuẩn bị, Đang giao hàng, Đã giao hàng, Hoàn thành.'
                : 'Đơn hủy sẽ tự động bị loại khỏi báo cáo.'}
            </p>
            <DateRangePicker from={exportDateRange.from} to={exportDateRange.to} onChange={r => setExportDateRange(r)} placeholder="Chọn khoảng ngày" />

            {/* Filter danh mục — chỉ áp dụng cho báo cáo Sản phẩm */}
            {exportType === 'PRODUCT' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-ink-2">Danh mục sản phẩm</label>
                  {exportCategories.length > 0 && (
                    <button onClick={toggleAllExportCategories}
                      className="text-[11px] font-medium text-gold hover:underline">
                      {allCategoriesSelected ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                    </button>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-line divide-y divide-line-soft">
                  {exportCategories.length === 0 ? (
                    <p className="px-3 py-2.5 text-xs text-muted">Đang tải danh mục…</p>
                  ) : exportCategories.map(c => (
                    <label key={c.id}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink cursor-pointer hover:bg-canvas">
                      <input type="checkbox" checked={exportCategoryIds.includes(c.id)}
                        onChange={() => toggleExportCategory(c.id)}
                        className="w-4 h-4 accent-gold flex-shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-muted mt-1">
                  {exportCategoryIds.length === 0 || allCategoriesSelected
                    ? 'Không chọn hoặc chọn hết = xuất tất cả danh mục.'
                    : `Đã chọn ${exportCategoryIds.length} danh mục — chỉ báo cáo sản phẩm thuộc các danh mục này.`}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowExportPicker(false)} className="flex-1 py-2.5 rounded-xl border border-line text-sm text-muted hover:bg-surface-2">Huỷ</button>
              <button onClick={handleExport} disabled={exporting || !exportDateRange.from || !exportDateRange.to}
                className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 ${exportType === 'PRODUCT' ? 'bg-gold hover:bg-gold-strong' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                {exporting
                  ? <BtnSpinner size={14} colorClass="border-white/40 !border-t-white" />
                  : <><Download size={14} /> {exportType === 'PRODUCT' ? 'Xuất PDF' : 'Xuất Excel'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal báo cáo tổng hợp */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowReportModal(false)} />
          <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider">Xuất báo cáo</p>
                <h2 className="font-bold text-ink">Chọn loại báo cáo</h2>
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-1.5 rounded-lg text-muted hover:bg-surface-2"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'INGREDIENT', label: '📦 Nguyên liệu', active: 'bg-violet-500 text-white border-violet-500', hover: 'hover:border-violet-300 dark:border-violet-500/35' },
                { key: 'CUSTOMER_PRODUCT', label: '👥 KH × Sản phẩm', active: 'bg-rose-500 text-white border-rose-500', hover: 'hover:border-rose-300 dark:border-rose-500/35' },
                { key: 'DELIVERY', label: '🚚 Giao hàng', active: 'bg-blue-500 text-white border-blue-500', hover: 'hover:border-blue-300 dark:border-blue-500/35' },
              ].map(r => (
                <button key={r.key} onClick={() => setReportType(r.key)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${reportType === r.key ? r.active : `border-line text-ink-2 ${r.hover}`}`}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="pt-2">
              <p className="text-xs text-muted mb-2">
                {reportType === 'INGREDIENT' && 'Tổng hợp nguyên liệu từ tất cả đơn hàng (không tính đơn hủy).'}
                {reportType === 'CUSTOMER_PRODUCT' && 'Tổng hợp sản lượng và doanh thu theo từng khách hàng.'}
                {reportType === 'DELIVERY' && 'Báo cáo giao hàng theo tài xế, thời gian giao hàng thực tế.'}
              </p>
              <DateRangePicker from={reportDateRange.from} to={reportDateRange.to} onChange={r => setReportDateRange(r)} placeholder="Chọn khoảng ngày (mặc định: hôm nay)" />
              {reportType === 'CUSTOMER_PRODUCT' && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-ink-2 mb-1">Danh mục sản phẩm</label>
                  <select
                    value={reportCategoryId}
                    onChange={e => setReportCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-surface focus:outline-none focus:border-gold">
                    <option value="">-- Danh mục mặc định --</option>
                    {reportCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="text-[11px] text-muted mt-1">Để trống sẽ dùng danh mục mặc định (kem).</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setShowReportModal(false); setReportDateRange({ from: null, to: null }); }}
                className="flex-1 py-2.5 rounded-xl border border-line text-sm text-muted hover:bg-surface-2">Huỷ</button>
              <button onClick={handleReportExport} disabled={exportingReport || !reportDateRange.from || !reportDateRange.to}
                className="flex-1 py-2.5 rounded-xl bg-gold text-white text-sm font-semibold hover:bg-gold-strong disabled:opacity-50 flex items-center justify-center gap-2">
                {exportingReport ? <BtnSpinner size={14} colorClass="border-white/40 !border-t-white" /> : <><Download size={14} /> Xuất báo cáo</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        isSuperSeller ? (
          <SuperSellerCancelOrderModal order={cancelTarget} onClose={() => setCancelTarget(null)}
            onCancelled={() => { setCancelTarget(null); fetchOrders(); }} />
        ) : (
          <CancelOrderModal order={cancelTarget} onClose={() => setCancelTarget(null)} onConfirm={handleCancelConfirm} loading={cancelLoading} />
        )
      )}

      <EditOrderModal
        open={!!editTarget}
        orderId={editTarget?.id}
        onClose={() => setEditTarget(null)}
        onSaved={() => { setEditTarget(null); fetchOrders(); }}
        isSuperSeller={isSuperSeller}
      />
    </div>
  );
}