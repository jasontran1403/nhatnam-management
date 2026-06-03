// src/pages/accountant/AccountantOrdersPage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import { accountantApi, incomeApi, getImageUrl, downloadBlob } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import CancelOrderModal from '../../components/common/CancelOrderModal';
import OrderDetailModal from '../../components/seller/OrderDetailModal';
import DateRangePicker from '../../components/ui/DateRangePicker';
import { formatPrice } from '../../utils/formatPrice';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Filter,
  Clock, CheckCircle, XCircle, Truck, Package, CreditCard,
  ChevronDown, DollarSign, X, AlertCircle, Calendar,
  Download, FileText, Paperclip, List, Ban,
} from 'lucide-react';

const CANCELLABLE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERING']);

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatDateShort(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function parseVND(str) { return Number(str.replace(/[^0-9]/g, '')); }

function BtnSpinner({ size = 13, colorClass = 'border-current' }) {
  return <div style={{ width: size, height: size }} className={`border-2 ${colorClass} border-t-transparent rounded-full animate-spin flex-shrink-0`} />;
}

function StatusBadge({ status }) {
  const { t } = useLang();
  const STATUS_MAP = {
    PENDING: { label: t('status', 'pending'), bg: 'bg-amber-50   text-amber-600   border-amber-200', icon: Clock },
    CONFIRMED: { label: t('status', 'confirmed'), bg: 'bg-sky-50     text-sky-600     border-sky-200', icon: CheckCircle },
    PREPARING: { label: t('status', 'preparing'), bg: 'bg-blue-50    text-blue-600    border-blue-200', icon: Package },
    READY: { label: t('status', 'ready'), bg: 'bg-indigo-50  text-indigo-600  border-indigo-200', icon: CheckCircle },
    DELIVERING: { label: t('status', 'delivering_short'), bg: 'bg-purple-50  text-purple-600  border-purple-200', icon: Truck },
    PENDING_PAYMENT: { label: t('status', 'pending_payment'), bg: 'bg-orange-50  text-orange-600  border-orange-200', icon: CreditCard },
    COMPLETED: { label: t('status', 'completed'), bg: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: CheckCircle },
    CANCELLED: { label: t('status', 'cancelled'), bg: 'bg-red-50     text-red-500     border-red-200', icon: XCircle },
    FAILED: { label: t('status', 'rejected_short'), bg: 'bg-red-50     text-red-700     border-red-300', icon: XCircle },
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
    CASH: { label: t('payment', 'cash_icon'), bg: 'bg-green-50  text-green-700  border-green-200' },
    BANK_TRANSFER: { label: t('payment', 'bank_transfer_icon'), bg: 'bg-blue-50   text-blue-700   border-blue-200' },
    DEBT: { label: t('payment', 'debt_icon'), bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  };
  const cfg = PAYMENT_METHOD_MAP[method];
  if (!cfg) return <span className="text-xs text-[#8E8878]">{method || '—'}</span>;
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function WarehouseBadge({ name }) {
  if (!name) return <span className="text-xs text-[#8E8878]">—</span>;
  return <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200 whitespace-nowrap">🏭 {name}</span>;
}

function CreatedByBadge({ name }) {
  if (!name) return <span className="text-xs text-[#8E8878]">—</span>;
  return <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#F0EBE3] text-[#8E8878] border-[#E8DDD0] whitespace-nowrap">👤 {name}</span>;
}

function PaymentMethodCell({ value, onSave, disabled }) {
  const { t } = useLang();
  const PAYMENT_METHODS = [
    { value: 'CASH', label: t('payment', 'cash_icon') },
    { value: 'BANK_TRANSFER', label: t('payment', 'bank_transfer_icon') },
    { value: 'DEBT', label: t('payment', 'debt_icon') },
  ];
  const [open, setOpen] = useState(false);
  const handleSelect = (val) => { setOpen(false); if (val !== value) onSave(val); };
  if (disabled) return <PaymentMethodBadge method={value} />;
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 group" title={t('payment', 'change_method_hint')}>
        <PaymentMethodBadge method={value} />
        <ChevronDown size={10} className="text-[#C9A84C] opacity-70 group-hover:opacity-100 transition-opacity" />
      </button>
      {open && (<>
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#E8DDD0] rounded-xl shadow-lg py-1 min-w-[160px]">
          {PAYMENT_METHODS.map(m => (
            <button key={m.value} onClick={() => handleSelect(m.value)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[#FAF7F2] transition-colors ${m.value === value ? 'font-bold text-[#C9A84C]' : 'text-[#1C1C1E]'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </>)}
    </div>
  );
}

// ── PartialPaymentModal ───────────────────────────────────────────────────────
function PartialPaymentModal({ order, onClose, onConfirm, loading }) {
  const { t } = useLang();
  const PAYMENT_METHODS = [
    { value: 'CASH', label: t('payment', 'cash_icon') },
    { value: 'BANK_TRANSFER', label: t('payment', 'bank_transfer_icon') },
    { value: 'DEBT', label: t('payment', 'debt_icon') },
  ];
  const finalAmount = Number(order?.finalAmount || 0);
  const alreadyPaid = Number(order?.paidAmount || 0);
  const remaining = finalAmount - alreadyPaid;
  const [amountInput, setAmountInput] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDays, setDeadlineDays] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(order?.paymentMethod || 'CASH');
  const [bankName, setBankName] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [error, setError] = useState('');
  const [txHistory, setTxHistory] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [waiveConfirm, setWaiveConfirm] = useState(false);

  useEffect(() => {
    import('../../api/services').then(({ paymentApi }) => {
      paymentApi.getTransactions(order.id)
        .then(r => setTxHistory(r.data?.data || []))
        .catch(() => { })
        .finally(() => setTxLoading(false));
    });
  }, [order.id]);

  const paidNum = parseVND(amountInput);
  const newRemaining = remaining - paidNum;
  const totalWouldPay = alreadyPaid + paidNum;
  const shortfall = finalAmount - totalWouldPay;
  const isFullPayment = paidNum === remaining && paidNum > 0;
  const canWaive = paidNum > 0 && shortfall > 0 && shortfall < 50000;
  const isBankTransfer = paymentMethod === 'BANK_TRANSFER';

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmountInput(raw ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : '');
    setError('');
  };

  const handleConfirm = () => {
    if (!paidNum || paidNum <= 0) { setError(t('payment', 'enter_paid_amount_required')); return; }
    if (paidNum > remaining) { setError(`${t('payment', 'enter_amount_collected')}: ${formatPrice(remaining)}`); return; }
    if (hasDeadline && (!deadlineDays || Number(deadlineDays) <= 0)) { setError(t('payment', 'invalid_days')); return; }
    if (paymentMethod === 'BANK_TRANSFER' && !bankName.trim()) { setError(t('payment', 'bank_name_required')); return; }
    onConfirm({
      paidAmount: paidNum, debtDays: hasDeadline ? Number(deadlineDays) : 0, paymentMethod,
      bankName: isBankTransfer ? bankName.trim() : undefined,
      transactionRef: isBankTransfer ? transactionRef.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3] flex-shrink-0">
          <div>
            <p className="text-[10px] text-[#8E8878] uppercase tracking-wider">{t('payment', 'record_payment')}</p>
            <h2 className="font-bold text-[#1C1C1E] font-mono text-sm">{order?.orderCode}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs"><span className="text-[#8E8878]">{t('order', 'total_amount')}</span><span className="font-semibold text-[#1C1C1E]">{formatPrice(finalAmount)}</span></div>
            {alreadyPaid > 0 && <div className="flex justify-between text-xs"><span className="text-[#8E8878]">{t('payment', 'collected')}</span><span className="font-semibold text-emerald-600">−{formatPrice(alreadyPaid)}</span></div>}
            <div className="flex justify-between text-xs pt-1 border-t border-[#E8DDD0]"><span className="font-bold text-[#1C1C1E]">{t('payment', 'remaining')}</span><span className="font-bold text-orange-600">{formatPrice(remaining)}</span></div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1C1C1E]">{t('payment', 'enter_amount_collected')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878] text-xs font-medium">₫</span>
              <input type="text" inputMode="numeric" value={amountInput} onChange={handleAmountChange} placeholder="0" autoFocus
                className="w-full pl-7 pr-28 py-3 border border-[#E8DDD0] rounded-xl text-sm font-bold text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/20" />
              <button onClick={() => setAmountInput(new Intl.NumberFormat('vi-VN').format(remaining))}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-semibold hover:bg-[#C9A84C]/20 transition-colors">
                {t('common', 'all')}
              </button>
            </div>
            {paidNum > 0 && paidNum <= remaining && (
              <div className={`flex flex-col gap-1.5 px-3 py-2 rounded-lg text-xs ${isFullPayment ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                <div className="flex items-center gap-1.5">
                  {isFullPayment
                    ? <><CheckCircle size={12} /> {t('payment', 'paid_full_done')} — {t('order', 'complete_order')}</>
                    : <><AlertCircle size={12} /> {t('payment', 'remaining')}: <strong>{formatPrice(newRemaining)}</strong></>}
                </div>
                {canWaive && !waiveConfirm && (
                  <button onClick={() => setWaiveConfirm(true)} className="self-start mt-0.5 px-2.5 py-1 rounded-lg bg-amber-600/15 text-amber-800 text-[10px] font-semibold hover:bg-amber-600/25 transition-colors">
                    {t('payment', 'collect_partial')} {formatPrice(shortfall)}
                  </button>
                )}
                {canWaive && waiveConfirm && (
                  <div className="flex flex-col gap-1.5 p-2 bg-amber-100 rounded-lg border border-amber-300">
                    <p className="text-[10px] font-semibold text-amber-900">⚠️ {t('misc', 'confirm_payment')} {formatPrice(shortfall)}?</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => setWaiveConfirm(false)} className="flex-1 py-1 rounded-lg border border-amber-300 text-[10px] text-amber-700 hover:bg-amber-50">{t('common', 'no')}</button>
                      <button onClick={() => onConfirm({ paidAmount: paidNum, debtDays: 0, paymentMethod, bankName: isBankTransfer ? bankName.trim() : undefined, transactionRef: isBankTransfer ? transactionRef.trim() : undefined, waiveRemainder: true, actualPaid: totalWouldPay })}
                        className="flex-1 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-semibold hover:bg-amber-700">{t('common', 'confirm')}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1C1C1E]">{t('payment', 'payment_method')}</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${paymentMethod === m.value ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'border-[#E8DDD0] text-[#5C5C5C] hover:border-[#C9A84C]'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {isBankTransfer && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs font-semibold text-blue-700">{t('payment', 'bank_transfer')}</p>
              <div>
                <label className="block text-[10px] font-medium text-blue-600 mb-1">{t('payment', 'bank_name')} *</label>
                <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="VD: Vietcombank, BIDV..." className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-blue-600 mb-1">{t('payment', 'reference_code')}</label>
                <input value={transactionRef} onChange={e => setTransactionRef(e.target.value)} placeholder="VD: FT23161234567" className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          )}
          {!isFullPayment && paidNum > 0 && paidNum < remaining && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setHasDeadline(v => !v)} className={`w-9 h-5 rounded-full transition-colors relative ${hasDeadline ? 'bg-[#C9A84C]' : 'bg-[#E8DDD0]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasDeadline ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs font-medium text-[#1C1C1E]">{t('payment', 'extend_debt_hint')}</span>
              </label>
              {hasDeadline && (
                <div className="flex items-center gap-2 pl-11">
                  <Calendar size={13} className="text-[#8E8878] shrink-0" />
                  <input type="number" min="1" max="365" value={deadlineDays} onChange={e => { setDeadlineDays(e.target.value); setError(''); }} placeholder={t('payment', 'debt_days')}
                    className="w-24 px-3 py-1.5 border border-[#E8DDD0] rounded-lg text-xs focus:outline-none focus:border-[#C9A84C] text-center font-bold" />
                  <span className="text-xs text-[#8E8878]">{t('payment', 'days_range')}</span>
                </div>
              )}
            </div>
          )}
          {error && <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs"><AlertCircle size={12} /> {error}</div>}
          {!txLoading && txHistory.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#5C5C5C] mb-2">{t('payment', 'payment')} ({txHistory.length})</p>
              <div className="space-y-2">
                {txHistory.map((tx, i) => (
                  <div key={tx.id} className="flex items-start gap-3 p-3 bg-[#FAF7F2] rounded-xl border border-[#F0EBE3]">
                    <div className="w-5 h-5 rounded-full bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-[9px] font-bold text-[#C9A84C]">{i + 1}</span></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1C1C1E]">{formatPrice(tx.amount)}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tx.paymentMethod === 'BANK_TRANSFER' ? 'bg-blue-50 text-blue-700' : tx.paymentMethod === 'DEBT' ? 'bg-orange-50 text-orange-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {tx.paymentMethod === 'CASH' ? '💵 TM' : tx.paymentMethod === 'BANK_TRANSFER' ? '🏦 CK' : tx.paymentMethod === 'DEBT' ? '📋 Nợ' : tx.paymentMethod}
                        </span>
                      </div>
                      {tx.bankName && <p className="text-[10px] text-[#5C5C5C] mt-0.5">{tx.bankName}{tx.transactionRef ? ` — ${tx.transactionRef}` : ''}</p>}
                      <p className="text-[10px] text-[#8E8878]">{tx.collectedBy} · {formatDateShort(tx.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-[#F0EBE3] flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#8E8878] hover:bg-[#F0EBE3] transition-colors font-medium">{t('common', 'cancel')}</button>
          <button onClick={handleConfirm} disabled={loading || !paidNum || paidNum <= 0}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#B8963E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? <BtnSpinner size={14} colorClass="border-white/40 !border-t-white" /> : <><DollarSign size={14} /> {t('misc', 'confirm_payment')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── StatusActionButtons ───────────────────────────────────────────────────────
function StatusActionButtons({ order, onComplete, onPartialPayment, loading }) {
  const { t } = useLang();
  const { status } = order;
  const locked = status === 'COMPLETED' || status === 'CANCELLED' || status === 'FAILED';
  if (locked) return <span className="text-[10px] text-[#C4B9A8]">—</span>;

  const canComplete = status === 'DELIVERING' || status === 'PENDING_PAYMENT';
  const canPartial = status === 'DELIVERING' || status === 'PENDING_PAYMENT';

  if (!canComplete && !canPartial) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {canPartial && (
        <button onClick={e => { e.stopPropagation(); onPartialPayment(); }} disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors text-[10px] font-semibold disabled:opacity-50 whitespace-nowrap">
          {loading ? <BtnSpinner size={10} colorClass="border-blue-400 !border-t-blue-600" /> : <><DollarSign size={10} /> {t('payment', 'collect_partial2')}</>}
        </button>
      )}
      {canComplete && (
        <button onClick={e => { e.stopPropagation(); onComplete(); }} disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors text-[10px] font-semibold disabled:opacity-50 whitespace-nowrap">
          {loading ? <BtnSpinner size={10} colorClass="border-emerald-400 !border-t-emerald-600" /> : <><CheckCircle size={10} /> {t('status', 'completed')}</>}
        </button>
      )}
    </div>
  );
}

function InvoiceButton({ order, invoiceLoadingId, onInvoice }) {
  const { t } = useLang();
  const isThisLoading = invoiceLoadingId === order.id;
  const isOtherLoading = !!invoiceLoadingId && !isThisLoading;
  return (
    <button onClick={e => { e.stopPropagation(); onInvoice(order.id, e); }} disabled={!!invoiceLoadingId}
      title={isThisLoading ? t('common', 'processing') : isOtherLoading ? t('status', 'pending_other') : t('document', 'invoice')}
      className={`relative p-1.5 rounded-lg border transition-all duration-200
        ${isThisLoading ? 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/40 cursor-wait ring-2 ring-[#C9A84C]/30 ring-offset-1'
          : isOtherLoading ? 'bg-[#F0EBE3] text-[#C4B9A8] border-[#F0EBE3] cursor-not-allowed opacity-40'
            : 'bg-[#C9A84C]/10 text-[#C9A84C] border-transparent hover:bg-[#C9A84C]/20 hover:scale-105 active:scale-95'}`}>
      {isThisLoading ? <BtnSpinner size={13} colorClass="border-[#C9A84C] !border-t-transparent" /> : <FileText size={13} />}
      {isThisLoading && <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium bg-[#1C1C1E] text-white px-2 py-0.5 rounded-md pointer-events-none z-10">{t('common', 'processing')}</span>}
    </button>
  );
}

// ── OrderCard mobile ──────────────────────────────────────────────────────────
function OrderCard({ o, actionLoading, invoiceLoadingId, onComplete, onPartialPayment, onUpdatePaymentMethod, onInvoice, onUploadReceipt }) {
  const { t } = useLang();
  const isCompleted = o.status === 'COMPLETED' || o.status === 'CANCELLED';
  const isActioning = actionLoading === o.id;
  const isThisInvoice = invoiceLoadingId === o.id;

  return (
    <div className={`rounded-2xl border p-4 space-y-3 transition-all
      ${isThisInvoice ? 'bg-[#C9A84C]/5 border-[#C9A84C]/40' : 'bg-white border-[#F0EBE3]'}
      ${isActioning ? 'opacity-60' : ''}`}>

      {/* Top: mã đơn + tổng tiền */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</p>
            {isThisInvoice && (
              <span className="flex gap-0.5 items-center">
                {[0, 1, 2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-[#C9A84C] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[#1C1C1E] mt-0.5">{o.customerName}</p>
          {o.customerPhone && <p className="text-[10px] text-[#8E8878]">{o.customerPhone}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-[#1C1C1E]">{formatPrice(o.finalAmount)}</p>
          {o.paidAmount > 0 && (
            <p className="text-[10px] text-emerald-600 font-medium">{t('payment', 'collected')}: {formatPrice(o.paidAmount)}</p>
          )}
          <p className="text-[10px] text-[#8E8878] mt-0.5">{formatDateShort(o.createdAt)}</p>
        </div>
      </div>

      {/* Badges: status + warehouse */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#F0EBE3]">
        <StatusBadge status={o.status} />
        <WarehouseBadge name={o.warehouseName} />
        <CreatedByBadge name={o.orderedByName} />
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        {/* Chứng từ */}
        {o.receiptFileUrl ? (
          <a href={getImageUrl(o.receiptFileUrl)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            📄 {t('document', 'document')}
          </a>
        ) : o.status === 'PENDING_PAYMENT' ? (
          <button onClick={() => onUploadReceipt(o.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-red-50 text-red-500 border border-red-200 hover:bg-red-100">
            <Paperclip size={10} /> {t('common', 'update')}
          </button>
        ) : null}

        {/* Phương thức thanh toán */}
        <PaymentMethodCell
          value={o.paymentMethod}
          onSave={val => onUpdatePaymentMethod(o.id, val)}
          disabled={isCompleted || isActioning || !!invoiceLoadingId}
        />

        {/* Invoice */}
        <InvoiceButton order={o} invoiceLoadingId={invoiceLoadingId} onInvoice={onInvoice} />

        {/* Thu tiền / Hoàn thành */}
        <StatusActionButtons
          order={o}
          onComplete={() => onComplete(o.id)}
          onPartialPayment={() => onPartialPayment(o)}
          loading={isActioning}
        />
      </div>

      {isThisInvoice && (
        <div className="flex items-center gap-2 bg-[#C9A84C]/10 rounded-lg px-3 py-2">
          <BtnSpinner size={11} colorClass="border-[#C9A84C] !border-t-transparent" />
          <span className="text-[11px] font-medium text-[#C9A84C]">{t('common', 'processing')}...</span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountantOrdersPage() {
  const { t } = useLang();
  const toast = useToast();

  const FILTER_TABS = [
    { value: 'ALL', label: t('common', 'all') },
    { value: 'PREPARING', label: t('status', 'preparing') },
    { value: 'DELIVERING', label: t('status', 'delivering_short') },
    { value: 'PENDING_PAYMENT', label: t('status', 'pending_payment') },
    { value: 'COMPLETED', label: t('status', 'completed') },
    { value: 'CANCELLED', label: t('status', 'cancelled') },
  ];

  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useMinLoading();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [productFilter, setProductFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [products, setProducts] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
  const [partialOrder, setPartialOrder] = useState(null);
  const [partialLoading, setPartialLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [uploadingReceiptId, setUploadingReceiptId] = useState(null);
  const receiptInputRef = useRef(null);
  const [sortNoReceipt, setSortNoReceipt] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const fetchOrders = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = { page: p, size: pageSize };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (dateRange.from) params.from = new Date(dateRange.from).setHours(0, 0, 0, 0);
      if (dateRange.to) params.to = new Date(dateRange.to).setHours(23, 59, 59, 999);
      if (productFilter) params.productId = productFilter;
      if (customerFilter) params.customerId = customerFilter;
      const res = await accountantApi.getOrders(params);
      let content = res.data?.data?.content || [];
      if (search.trim()) {
        const q = search.toLowerCase();
        content = content.filter(o => o.orderCode?.toLowerCase().includes(q) || o.customerName?.toLowerCase().includes(q) || o.customerPhone?.includes(q));
      }
      setOrders(content); setTotal(res.data?.data?.totalItems || 0); setPage(p);
    } catch { toast(t('common', 'error_retry'), 'error'); }
    finally { setLoading(false); }
  }, [statusFilter, dateRange, search, productFilter, customerFilter, pageSize]);

  useEffect(() => { fetchOrders(0); }, [fetchOrders]);
  useEffect(() => {
    import('../../api/services').then(({ accountantApi: api }) => {
      api.getProducts && api.getProducts().then(r => setProducts(r.data?.data || [])).catch(() => { });
    });
  }, []);
  useEffect(() => { const timer = setTimeout(() => setSearch(searchInput), 500); return () => clearTimeout(timer); }, [searchInput]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (dateRange.from) params.from = new Date(dateRange.from).setHours(0, 0, 0, 0);
      if (dateRange.to) params.to = new Date(dateRange.to).setHours(23, 59, 59, 999);
      if (productFilter) params.productId = productFilter;
      if (customerFilter) params.customerId = customerFilter;
      const res = await accountantApi.exportOrders(params);
      downloadBlob(res.data, `don-hang-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`);
    } catch { toast(t('common', 'error_retry'), 'error'); }
    finally { setExporting(false); }
  };

  const handleInvoice = async (orderId, e) => {
    if (e) e.stopPropagation(); if (invoiceLoadingId) return;
    setInvoiceLoadingId(orderId);
    try {
      const res = await accountantApi.getInvoice(orderId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch { toast(t('common', 'error_retry'), 'error'); }
    finally { setInvoiceLoadingId(null); }
  };

  const handlePendingPayment = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await accountantApi.markPendingPayment(orderId);
      if (res?.data?.success === false) { toast(res.data.message || t('common', 'error'), 'error'); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PENDING_PAYMENT' } : o));
      toast(t('status', 'changed_to_delivering'), 'success');
    } catch (e) { toast(e?.response?.data?.message || t('common', 'error'), 'error'); }
    finally { setActionLoading(null); }
  };

  const handleComplete = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await accountantApi.markCompleted(orderId);
      if (res?.data?.success === false) { toast(res.data.message || t('common', 'error'), 'error'); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'COMPLETED', paymentStatus: 'PAID', paidAmount: o.finalAmount } : o));
      toast(t('order', 'complete_success'), 'success');
    } catch (e) { toast(e?.response?.data?.message || t('common', 'error'), 'error'); }
    finally { setActionLoading(null); }
  };

  const handlePartialPayment = async (payload) => {
    if (!partialOrder) return;
    const { paidAmount, debtDays = 0, paymentMethod, bankName, transactionRef, waiveRemainder, actualPaid } = payload;
    setPartialLoading(true);
    try {
      if (waiveRemainder) {
        await accountantApi.waiveRemainder(partialOrder.id, { actualPaid: Number(actualPaid), paymentMethod, bankName: paymentMethod === 'BANK_TRANSFER' ? bankName?.trim() : undefined, transactionRef: paymentMethod === 'BANK_TRANSFER' ? transactionRef?.trim() : undefined });
        setOrders(prev => prev.map(o => o.id === partialOrder.id ? { ...o, paidAmount: Number(actualPaid), paymentStatus: 'PAID', status: 'COMPLETED' } : o));
        toast(t('order', 'complete_success'), 'success');
      } else {
        await accountantApi.recordPartialPayment(partialOrder.id, paidAmount, debtDays);
        const newPaid = Number(partialOrder.paidAmount || 0) + paidAmount;
        const isFullPaid = newPaid >= Number(partialOrder.finalAmount || 0);
        setOrders(prev => prev.map(o => o.id === partialOrder.id ? { ...o, paidAmount: newPaid, paymentStatus: isFullPaid ? 'PAID' : 'PARTIAL', status: isFullPaid ? 'COMPLETED' : 'PENDING_PAYMENT' } : o));
        toast(isFullPaid ? t('order', 'order_completed_paid') : `${t('payment', 'record_payment_success2')} ${formatPrice(paidAmount)}`, 'success');
      }
      setPartialOrder(null);
    } catch (e) { toast(e?.response?.data?.message || e?.message || t('payment', 'record_payment_error2'), 'error'); }
    finally { setPartialLoading(false); }
  };

  const handleUpdatePaymentMethod = async (orderId, paymentMethod) => {
    setActionLoading(orderId);
    try {
      const res = await accountantApi.updatePaymentMethod(orderId, paymentMethod);
      if (res?.data?.success === false) { toast(res.data.message || t('common', 'error'), 'error'); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentMethod } : o));
      toast(t('payment', 'change_method_success'), 'success');
    } catch (e) { toast(e?.response?.data?.message || t('payment', 'change_method_error'), 'error'); }
    finally { setActionLoading(null); }
  };

  const handleCancelConfirm = async (reason) => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await accountantApi.cancelOrder(cancelTarget.id, reason);
      setOrders(prev => prev.map(o => o.id === cancelTarget.id ? { ...o, status: 'CANCELLED' } : o));
      setCancelTarget(null);
      toast(t('order', 'cancel_success'), 'success');
    } catch (e) { toast(e?.response?.data?.message || t('order', 'cancel_error_action'), 'error'); }
    finally { setCancelLoading(false); }
  };

  const handleUploadReceipt = (orderId) => { setUploadingReceiptId(orderId); receiptInputRef.current?.click(); };
  const handleReceiptFileChange = async (e) => {
    const file = e.target.files?.[0]; if (!file || !uploadingReceiptId) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await accountantApi.uploadReceiptFile(uploadingReceiptId, fd);
      const url = res.data?.data?.receiptFileUrl;
      setOrders(prev => prev.map(o => o.id === uploadingReceiptId ? { ...o, receiptFileUrl: url } : o));
      toast(t('common', 'success'), 'success');
    } catch { toast(t('common', 'error'), 'error'); }
    finally { setUploadingReceiptId(null); e.target.value = ''; }
  };

  const executeBulkComplete = async (mode, isFinalPartial) => {
    setBulkLoading(true);
    try {
      const res = await accountantApi.bulkComplete({ orderIds: Array.from(selectedIds), mode, finalPartialPayment: isFinalPartial });
      const result = res.data?.data; const successCount = result?.success || 0; const errors = result?.errors || [];
      if (errors.length === 0) toast(`✅ ${t('order', 'update_success')} ${successCount}`, 'success');
      else if (successCount === 0) toast(t('order', 'no_orders_updated'), 'error');
      else toast(`⚠️ ${successCount} ${t('common', 'success')}, ${errors.length} ${t('common', 'error')}`, 'warning');
      setSelectedIds(new Set()); fetchOrders(page);
    } catch { toast(t('common', 'error'), 'error'); }
    finally { setBulkLoading(false); }
  };

  const getRowBg = (o) => {
    if (o.status === 'COMPLETED') return 'bg-emerald-50/70';
    if (o.status === 'DELIVERING' || o.status === 'PENDING_PAYMENT') {
      if (o.debtDays > 0 && o.pendingPaymentAt) { const dl = o.pendingPaymentAt + o.debtDays * 86400000; if (dl - Date.now() < 3 * 86400000) return 'bg-red-50/70'; }
      return 'bg-orange-50/50';
    }
    return '';
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF7F2]">
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#1C1C1E]">{t('order', 'orders')}</h1>
            <p className="text-[10px] sm:text-xs text-[#8E8878]">{total} {t('order', 'orders').toLowerCase()}</p>
          </div>
          <div className="relative hidden sm:block">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
            <input type="text" placeholder={t('common', 'search')} value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="border border-[#E8DDD0] rounded-xl pl-9 pr-4 py-2 text-sm bg-white focus:outline-none focus:border-[#C9A84C] w-48 lg:w-56" />
          </div>
          <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
            <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={r => { setDateRange(r); setPage(0); }} />
            {productFilter && <button onClick={() => setProductFilter('')} className="flex items-center gap-1 px-2 py-1 bg-[#C9A84C]/10 text-[#C9A84C] rounded-lg text-xs font-medium">{t('common', 'deselect')} <X size={10} /></button>}
            {customerFilter && <button onClick={() => setCustomerFilter('')} className="flex items-center gap-1 px-2 py-1 bg-sky-50 text-sky-600 rounded-lg text-xs font-medium">{t('common', 'deselect')} <X size={10} /></button>}
          </div>
          <div className="flex sm:hidden items-center gap-1.5">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input type="text" placeholder={t('common', 'search')} value={searchInput} onChange={e => setSearchInput(e.target.value)} className="border border-[#E8DDD0] rounded-xl pl-8 pr-3 py-2 text-sm bg-white focus:outline-none focus:border-[#C9A84C] w-28" />
            </div>
            <button onClick={() => setShowFilter(f => !f)} className={`p-2 rounded-xl border transition-colors ${showFilter ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-[#E8DDD0] text-[#8E8878]'}`}><Filter size={15} /></button>
          </div>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); fetchOrders(0); }} className="border border-[#E8DDD0] rounded-xl px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#C9A84C] hidden sm:block">
            {[20, 50, 100].map(n => <option key={n} value={n}>{n}/{t('common', 'date').toLowerCase()}</option>)}
          </select>
          <button onClick={() => setSortNoReceipt(v => !v)} className={`p-2 rounded-xl border transition-colors hidden sm:flex items-center ${sortNoReceipt ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-[#E8DDD0] text-[#8E8878]'}`}><List size={14} /></button>
          <button onClick={() => fetchOrders(0)} className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] transition-colors shrink-0"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={handleExport} disabled={exporting} className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-60 shrink-0" title={t('common', 'export')}>
            {exporting ? <BtnSpinner size={14} colorClass="border-emerald-400 !border-t-emerald-600" /> : <Download size={14} />}
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {FILTER_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${statusFilter === tab.value ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8E8878] gap-2"><Search size={32} strokeWidth={1} /><p className="text-sm">{t('order', 'no_orders')}</p></div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#FAF7F2] border-b border-[#F0EBE3]">
                    <tr>
                      <th className="px-3 py-3">
                        <input type="checkbox" className="w-3.5 h-3.5 accent-[#C9A84C]"
                          checked={selectedIds.size === orders.length && orders.length > 0}
                          onChange={e => setSelectedIds(e.target.checked ? new Set(orders.map(o => o.id)) : new Set())} />
                      </th>
                      {[t('order', 'order_code'), t('common', 'date'), t('customer', 'customer'), t('warehouse', 'warehouse'), t('common', 'status'), t('payment', 'payment_method'), t('order', 'total_paid'), t('order', 'orderer'), t('document', 'document'), t('document', 'invoice'), t('common', 'actions')].map(h => (
                        <th key={h} className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      const isCompleted = o.status === 'COMPLETED' || o.status === 'CANCELLED';
                      const isActioning = actionLoading === o.id;
                      const isThisInvoice = invoiceLoadingId === o.id;
                      const paidAmount = Number(o.paidAmount || 0);
                      return (
                        <tr key={o.id} className={`border-b border-[#F0EBE3] last:border-0 transition-colors ${getRowBg(o)} ${isThisInvoice ? 'opacity-80' : ''} ${isActioning ? 'opacity-60' : ''}`}>
                          <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" className="w-3.5 h-3.5 accent-[#C9A84C]" checked={selectedIds.has(o.id)}
                              onChange={e => { const next = new Set(selectedIds); e.target.checked ? next.add(o.id) : next.delete(o.id); setSelectedIds(next); }} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</span>
                              {detailLoading === o.id && <div className="w-3 h-3 border border-[#C9A84C] border-t-transparent rounded-full animate-spin" />}
                              {isThisInvoice && <span className="flex gap-0.5 items-center">{[0, 1, 2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-[#C9A84C] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#8E8878] whitespace-nowrap">{formatDate(o.createdAt)}</td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-[#1C1C1E] whitespace-nowrap">{o.customerName}</p>
                            <p className="text-[10px] text-[#8E8878]">{o.customerPhone}</p>
                          </td>
                          <td className="px-4 py-3"><WarehouseBadge name={o.warehouseName} /></td>
                          <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                          <td className="px-4 py-3">
                            <PaymentMethodCell value={o.paymentMethod} onSave={val => handleUpdatePaymentMethod(o.id, val)} disabled={isCompleted || isActioning || !!invoiceLoadingId} />
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-[#1C1C1E] whitespace-nowrap">{formatPrice(o.finalAmount)}</p>
                            {o.status === 'COMPLETED' && o.paymentStatus === 'PAID' ? (
                              paidAmount > 0 && paidAmount !== Number(o.finalAmount) && <p className="text-[10px] text-sky-600 font-medium whitespace-nowrap">{t('payment', 'paid')}: {formatPrice(paidAmount)}</p>
                            ) : (<>
                              {paidAmount > 0 && <p className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">{t('payment', 'collected')}: {formatPrice(paidAmount)}</p>}
                              {paidAmount > 0 && paidAmount < Number(o.finalAmount) && <p className="text-[10px] text-orange-500 font-medium whitespace-nowrap">{t('payment', 'remaining')}: {formatPrice(Number(o.finalAmount) - paidAmount)}</p>}
                            </>)}
                          </td>
                          <td className="px-4 py-3"><CreatedByBadge name={o.orderedByName} /></td>
                          <td className="px-4 py-3">
                            {o.receiptFileUrl ? (
                              <a href={getImageUrl(o.receiptFileUrl)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap hover:bg-emerald-100">
                                📄 {t('document', 'document')}
                              </a>
                            ) : o.status === 'PENDING_PAYMENT' ? (
                              <button onClick={e => { e.stopPropagation(); handleUploadReceipt(o.id); }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-500 border border-red-200 whitespace-nowrap hover:bg-red-100">
                                <Paperclip size={9} /> {t('common', 'update')}
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#C4B9A8]">—</span>
                            )}
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
                              }} className="relative p-1.5 rounded-lg border bg-sky-50 text-sky-600 border-transparent hover:bg-sky-100 hover:scale-105 active:scale-95 transition-all duration-200">
                                {detailLoading === o.id ? <BtnSpinner size={13} colorClass="border-sky-400 !border-t-transparent" /> : <Search size={13} />}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusActionButtons order={o}
                              onComplete={() => handleComplete(o.id)}
                              onPartialPayment={() => setPartialOrder(o)}
                              loading={isActioning} />
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
              {orders.map(o => (
                <OrderCard key={o.id} o={o}
                  actionLoading={actionLoading}
                  invoiceLoadingId={invoiceLoadingId}
                  onComplete={handleComplete}
                  onPartialPayment={setPartialOrder}
                  onUpdatePaymentMethod={handleUpdatePaymentMethod}
                  onInvoice={handleInvoice}
                  onUploadReceipt={handleUploadReceipt}
                />
              ))}
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => fetchOrders(page - 1)} disabled={page === 0 || loading} className="p-2 rounded-xl bg-white border border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={15} /></button>
            <span className="text-sm text-[#8E8878] px-3">{page + 1} / {totalPages}</span>
            <button onClick={() => fetchOrders(page + 1)} disabled={page >= totalPages - 1 || loading} className="p-2 rounded-xl bg-white border border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronRight size={15} /></button>
          </div>
        )}
      </div>

      {partialOrder && <PartialPaymentModal order={partialOrder} onClose={() => setPartialOrder(null)} onConfirm={handlePartialPayment} loading={partialLoading} />}

      {selectedIds.size > 0 && (() => {
        const selectedOrders = orders.filter(o => selectedIds.has(o.id));
        const totalSelected = selectedOrders.reduce((s, o) => s + Number(o.finalAmount || 0), 0);
        const formatP = n => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
        return (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white border border-[#E8DDD0] rounded-2xl shadow-xl px-4 py-2.5">
            <div className="flex flex-col mr-2">
              <span className="text-xs font-semibold text-[#5C5C5C]">{selectedIds.size} {t('order', 'orders').toLowerCase()} {t('common', 'selected').toLowerCase()}</span>
              <span className="text-[11px] font-bold text-[#C9A84C]">{formatP(totalSelected)}</span>
            </div>
            <button onClick={() => setBulkConfirm({ mode: 'DELIVERED_UNPAID', isFinalPartial: false })} className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold hover:bg-orange-100">🚚 {t('status', 'delivered')}</button>
            <button onClick={() => setBulkConfirm({ mode: 'DELIVERED_PAID', isFinalPartial: false })} className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100">✅ {t('order', 'complete_order_full')}</button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-1 p-1.5 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]"><X size={13} /></button>
          </div>
        );
      })()}

      {bulkConfirm && (() => {
        const selectedOrders = orders.filter(o => selectedIds.has(o.id));
        const totalSelected = selectedOrders.reduce((s, o) => s + Number(o.finalAmount || 0), 0);
        const formatP = n => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBulkConfirm(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <h2 className="font-bold text-[#1C1C1E]">{t('misc', 'confirm_icon')} {bulkConfirm.mode === 'DELIVERED_PAID' ? t('order', 'complete_order_full') : t('status', 'delivered')}</h2>
              <div className="bg-[#FAF7F2] rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-xs text-[#8E8878]">{selectedIds.size} {t('order', 'orders').toLowerCase()}</span>
                <span className="text-sm font-bold text-[#C9A84C]">{formatP(totalSelected)}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setBulkConfirm(null)} className="flex-1 py-2 rounded-xl border border-[#E8DDD0] text-sm text-[#8E8878] hover:bg-[#F0EBE3]">{t('common', 'cancel')}</button>
                <button disabled={bulkLoading} onClick={async () => { const c = bulkConfirm; setBulkConfirm(null); await executeBulkComplete(c.mode, false); }}
                  className="flex-1 py-2 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold disabled:opacity-50">
                  {bulkLoading ? t('common', 'processing') : t('common', 'confirm')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <input type="file" ref={receiptInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleReceiptFileChange} />
      {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onRefresh={fetchOrders} />}

      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancelConfirm}
          loading={cancelLoading}
        />
      )}
    </div>
  );
}