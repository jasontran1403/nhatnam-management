// src/pages/accountant/AccountantOrdersPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { accountantApi, getImageUrl, downloadBlob } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import OrderDetailModal from '../../components/seller/OrderDetailModal';
import DateRangePicker from '../../components/common/DateRangePicker';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Filter,
  Clock, CheckCircle, XCircle, Truck, Package, CreditCard,
  ChevronDown, DollarSign, X, AlertCircle, Calendar,
  Download, FileText,
} from 'lucide-react';

// ── Formatters ────────────────────────────────────────────────────────────────
function formatPrice(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + ' đ';
}
function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function formatDateShort(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
function parseVND(str) {
  return Number(str.replace(/[^0-9]/g, ''));
}
function formatVNDInput(val) {
  if (!val) return '';
  const n = Number(String(val).replace(/[^0-9]/g, ''));
  if (isNaN(n)) return '';
  return new Intl.NumberFormat('vi-VN').format(n);
}

// ── Config ────────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  PENDING:         { label: 'Chờ xử lý',      bg: 'bg-amber-50   text-amber-600   border-amber-200',   icon: Clock },
  CONFIRMED:       { label: 'Đã xác nhận',     bg: 'bg-sky-50     text-sky-600     border-sky-200',     icon: CheckCircle },
  PREPARING:       { label: 'Đang chuẩn bị',   bg: 'bg-blue-50    text-blue-600    border-blue-200',    icon: Package },
  READY:           { label: 'Sẵn sàng',         bg: 'bg-indigo-50  text-indigo-600  border-indigo-200',  icon: CheckCircle },
  DELIVERING:      { label: 'Đang giao',        bg: 'bg-purple-50  text-purple-600  border-purple-200',  icon: Truck },
  PENDING_PAYMENT: { label: 'Chờ thanh toán',  bg: 'bg-orange-50  text-orange-600  border-orange-200',  icon: CreditCard },
  COMPLETED:       { label: 'Hoàn thành',       bg: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: CheckCircle },
  CANCELLED:       { label: 'Đã huỷ',           bg: 'bg-red-50     text-red-500     border-red-200',     icon: XCircle },
  FAILED:          { label: 'Thất bại',          bg: 'bg-red-50     text-red-700     border-red-300',     icon: XCircle },
};

const PAYMENT_METHOD_MAP = {
  CASH:          { label: '💵 Tiền mặt',     bg: 'bg-green-50  text-green-700  border-green-200' },
  BANK_TRANSFER: { label: '🏦 Chuyển khoản', bg: 'bg-blue-50   text-blue-700   border-blue-200' },
  DEBT:          { label: '📋 Công nợ',      bg: 'bg-orange-50 text-orange-700 border-orange-200' },
};

const PAYMENT_METHODS = [
  { value: 'CASH',          label: '💵 Tiền mặt' },
  { value: 'BANK_TRANSFER', label: '🏦 Chuyển khoản' },
  { value: 'DEBT',          label: '📋 Công nợ' },
];

const FILTER_TABS = [
  { value: 'ALL',             label: 'Tất cả' },
  { value: 'DELIVERING',      label: 'Đang giao' },
  { value: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
  { value: 'COMPLETED',       label: 'Hoàn thành' },
  { value: 'PENDING',         label: 'Chờ xử lý' },
  { value: 'PREPARING',       label: 'Đang chuẩn bị' },
  { value: 'CANCELLED',       label: 'Đã huỷ' },
];

// ── Spinner nhỏ dùng trong nút ────────────────────────────────────────────────
function BtnSpinner({ size = 13, colorClass = 'border-current' }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`border-2 ${colorClass} border-t-transparent rounded-full animate-spin flex-shrink-0`}
    />
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] || STATUS_MAP.PENDING;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cfg.bg}`}>
      <Icon size={9} /> {cfg.label}
    </span>
  );
}

function PaymentMethodBadge({ method }) {
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
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200 whitespace-nowrap">
      🏭 {name}
    </span>
  );
}

function CreatedByBadge({ name }) {
  if (!name) return <span className="text-xs text-[#8E8878]">—</span>;
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#F0EBE3] text-[#8E8878] border-[#E8DDD0] whitespace-nowrap">
      👤 {name}
    </span>
  );
}

// ── Dropdown phương thức thanh toán ───────────────────────────────────────────
function PaymentMethodCell({ value, onSave, disabled }) {
  const [open, setOpen] = useState(false);
  const handleSelect = (val) => { setOpen(false); if (val !== value) onSave(val); };
  if (disabled) return <PaymentMethodBadge method={value} />;
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 group"
        title="Click để thay đổi phương thức thanh toán">
        <PaymentMethodBadge method={value} />
        <ChevronDown size={10} className="text-[#C9A84C] opacity-70 group-hover:opacity-100 transition-opacity" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#E8DDD0] rounded-xl shadow-lg py-1 min-w-[160px]">
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} onClick={() => handleSelect(m.value)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-[#FAF7F2] transition-colors
                  ${m.value === value ? 'font-bold text-[#C9A84C]' : 'text-[#1C1C1E]'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Modal thanh toán một phần ─────────────────────────────────────────────────
function PartialPaymentModal({ order, onClose, onConfirm, loading }) {
  const finalAmount = Number(order?.finalAmount || 0);
  const alreadyPaid = Number(order?.paidAmount || 0);
  const remaining   = finalAmount - alreadyPaid;

  const [amountInput, setAmountInput]   = useState('');
  const [hasDeadline, setHasDeadline]   = useState(false);
  const [deadlineDays, setDeadlineDays] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(order?.paymentMethod || 'CASH');
  const [bankName, setBankName]           = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [error, setError]               = useState('');
  const [txHistory, setTxHistory]       = useState([]);
  const [txLoading, setTxLoading]       = useState(true);

  // Load payment transaction history
  useEffect(() => {
    import('../../api/services').then(({ paymentApi }) => {
      paymentApi.getTransactions(order.id)
        .then(r => setTxHistory(r.data?.data || []))
        .catch(() => {})
        .finally(() => setTxLoading(false));
    });
  }, [order.id]);

  const paidNum      = parseVND(amountInput);
  const newRemaining = remaining - paidNum;

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmountInput(raw ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : '');
    setError('');
  };

  const handleFillRemaining = () => {
    setAmountInput(new Intl.NumberFormat('vi-VN').format(remaining));
    setError('');
  };

  const handleConfirm = () => {
    if (!paidNum || paidNum <= 0) { setError('Vui lòng nhập số tiền đã thanh toán'); return; }
    if (paidNum > remaining) { setError(`Số tiền không được vượt quá số còn lại (${formatPrice(remaining)})`); return; }
    if (hasDeadline && (!deadlineDays || Number(deadlineDays) <= 0)) {
      setError('Vui lòng nhập số ngày hạn thanh toán hợp lệ'); return;
    }
    if (paymentMethod === 'BANK_TRANSFER' && !bankName.trim()) {
      setError('Vui lòng nhập tên ngân hàng'); return;
    }
    onConfirm({
      paidAmount: paidNum,
      debtDays: hasDeadline ? Number(deadlineDays) : 0,
      paymentMethod,
      bankName: paymentMethod === 'BANK_TRANSFER' ? bankName.trim() : undefined,
      transactionRef: paymentMethod === 'BANK_TRANSFER' ? transactionRef.trim() : undefined,
    });
  };

  const isFullPayment = paidNum === remaining && paidNum > 0;
  const isBankTransfer = paymentMethod === 'BANK_TRANSFER';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3] flex-shrink-0">
          <div>
            <p className="text-[10px] text-[#8E8878] uppercase tracking-wider">Ghi nhận thanh toán</p>
            <h2 className="font-bold text-[#1C1C1E] font-mono text-sm">{order?.orderCode}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Summary */}
          <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#8E8878]">Tổng đơn hàng</span>
              <span className="font-semibold text-[#1C1C1E]">{formatPrice(finalAmount)}</span>
            </div>
            {alreadyPaid > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#8E8878]">Đã thanh toán trước</span>
                <span className="font-semibold text-emerald-600">−{formatPrice(alreadyPaid)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs pt-1 border-t border-[#E8DDD0]">
              <span className="font-bold text-[#1C1C1E]">Còn lại cần thu</span>
              <span className="font-bold text-orange-600">{formatPrice(remaining)}</span>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1C1C1E]">Số tiền thu được lần này</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878] text-xs font-medium">₫</span>
              <input type="text" inputMode="numeric" value={amountInput} onChange={handleAmountChange}
                placeholder="0" autoFocus
                className="w-full pl-7 pr-28 py-3 border border-[#E8DDD0] rounded-xl text-sm font-bold text-[#1C1C1E]
                  focus:outline-none focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C]/20" />
              <button onClick={handleFillRemaining}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg
                  bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-semibold hover:bg-[#C9A84C]/20 transition-colors">
                Tất cả
              </button>
            </div>
            {paidNum > 0 && paidNum <= remaining && (
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs
                ${isFullPayment ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {isFullPayment
                  ? <><CheckCircle size={12} /> Thanh toán đủ — đơn sẽ chuyển sang <strong>Hoàn thành</strong></>
                  : <><AlertCircle size={12} /> Còn lại: <strong>{formatPrice(newRemaining)}</strong> — đơn sẽ là <strong>Còn nợ</strong></>
                }
              </div>
            )}
          </div>

          {/* Payment method selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1C1C1E]">Phương thức thanh toán lần này</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all
                    ${paymentMethod === m.value
                      ? 'bg-[#C9A84C] text-white border-[#C9A84C]'
                      : 'border-[#E8DDD0] text-[#5C5C5C] hover:border-[#C9A84C]'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bank transfer fields */}
          {isBankTransfer && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs font-semibold text-blue-700">Thông tin chuyển khoản</p>
              <div>
                <label className="block text-[10px] font-medium text-blue-600 mb-1">Tên ngân hàng *</label>
                <input value={bankName} onChange={e => setBankName(e.target.value)}
                  placeholder="VD: Vietcombank, BIDV, Techcombank..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-blue-600 mb-1">Mã giao dịch / Số tham chiếu</label>
                <input value={transactionRef} onChange={e => setTransactionRef(e.target.value)}
                  placeholder="VD: FT23161234567"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:border-blue-400" />
              </div>
            </div>
          )}

          {/* Deadline for partial */}
          {!isFullPayment && paidNum > 0 && paidNum < remaining && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setHasDeadline(v => !v)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${hasDeadline ? 'bg-[#C9A84C]' : 'bg-[#E8DDD0]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                    ${hasDeadline ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs font-medium text-[#1C1C1E]">Đặt hạn cho phần còn nợ</span>
              </label>
              {hasDeadline && (
                <div className="flex items-center gap-2 pl-11">
                  <Calendar size={13} className="text-[#8E8878] shrink-0" />
                  <input type="number" min="1" max="365" value={deadlineDays}
                    onChange={e => { setDeadlineDays(e.target.value); setError(''); }}
                    placeholder="Số ngày"
                    className="w-24 px-3 py-1.5 border border-[#E8DDD0] rounded-lg text-xs
                      focus:outline-none focus:border-[#C9A84C] text-center font-bold" />
                  <span className="text-xs text-[#8E8878]">ngày kể từ hôm nay</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs">
              <AlertCircle size={12} /> {error}
            </div>
          )}

          {/* Transaction history */}
          {!txLoading && txHistory.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#5C5C5C] mb-2">Lịch sử thanh toán ({txHistory.length} lần)</p>
              <div className="space-y-2">
                {txHistory.map((tx, i) => (
                  <div key={tx.id} className="flex items-start gap-3 p-3 bg-[#FAF7F2] rounded-xl border border-[#F0EBE3]">
                    <div className="w-5 h-5 rounded-full bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-[#C9A84C]">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1C1C1E]">{formatPrice(tx.amount)}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium
                          ${tx.paymentMethod === 'BANK_TRANSFER' ? 'bg-blue-50 text-blue-700' :
                            tx.paymentMethod === 'DEBT' ? 'bg-orange-50 text-orange-700' :
                            'bg-emerald-50 text-emerald-700'}`}>
                          {tx.paymentMethod === 'CASH' ? '💵 TM' :
                           tx.paymentMethod === 'BANK_TRANSFER' ? '🏦 CK' :
                           tx.paymentMethod === 'DEBT' ? '📋 Nợ' : tx.paymentMethod}
                        </span>
                      </div>
                      {tx.bankName && (
                        <p className="text-[10px] text-[#5C5C5C] mt-0.5">
                          {tx.bankName}{tx.transactionRef ? ` — ${tx.transactionRef}` : ''}
                        </p>
                      )}
                      <p className="text-[10px] text-[#8E8878]">
                        {tx.collectedBy} · {formatDateShort(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-[#F0EBE3] flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#8E8878]
              hover:bg-[#F0EBE3] transition-colors font-medium">
            Huỷ
          </button>
          <button onClick={handleConfirm} disabled={loading || !paidNum || paidNum <= 0}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold
              hover:bg-[#B8963E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2">
            {loading
              ? <BtnSpinner size={14} colorClass="border-white/40 !border-t-white" />
              : <><DollarSign size={14} /> Xác nhận thu tiền</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
// ── Action buttons ────────────────────────────────────────────────────────────
function StatusActionButtons({ order, onPendingPayment, onComplete, onPartialPayment, loading }) {
  const { status, paymentMethod } = order;
  const locked = status === 'COMPLETED' || status === 'CANCELLED' || status === 'FAILED';
  if (locked) return <span className="text-[10px] text-[#C4B9A8]">—</span>;

  const canPendingPayment = status === 'DELIVERING' && paymentMethod === 'DEBT';
  const canComplete       = status === 'DELIVERING' || status === 'PENDING_PAYMENT';
  const canPartial        = status === 'DELIVERING' || status === 'PENDING_PAYMENT';

  if (!canPendingPayment && !canComplete && !canPartial) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {canPendingPayment && (
        <button onClick={e => { e.stopPropagation(); onPendingPayment(); }} disabled={loading} title="Chuyển sang Chờ thanh toán"
          className="flex items-center gap-1 px-2 py-1 rounded-lg
            bg-orange-50 text-orange-600 border border-orange-200
            hover:bg-orange-100 transition-colors text-[10px] font-semibold disabled:opacity-50 whitespace-nowrap">
          {loading ? <BtnSpinner size={10} colorClass="border-orange-400 !border-t-orange-600" /> : <><CreditCard size={10} /> Chờ TT</>}
        </button>
      )}
      {canPartial && (
        <button onClick={e => { e.stopPropagation(); onPartialPayment(); }} disabled={loading} title="Ghi nhận thanh toán"
          className="flex items-center gap-1 px-2 py-1 rounded-lg
            bg-blue-50 text-blue-600 border border-blue-200
            hover:bg-blue-100 transition-colors text-[10px] font-semibold disabled:opacity-50 whitespace-nowrap">
          {loading ? <BtnSpinner size={10} colorClass="border-blue-400 !border-t-blue-600" /> : <><DollarSign size={10} /> Thu tiền</>}
        </button>
      )}
      {canComplete && (
        <button onClick={e => { e.stopPropagation(); onComplete(); }} disabled={loading} title="Hoàn thành & đánh dấu đã thanh toán"
          className="flex items-center gap-1 px-2 py-1 rounded-lg
            bg-emerald-50 text-emerald-600 border border-emerald-200
            hover:bg-emerald-100 transition-colors text-[10px] font-semibold disabled:opacity-50 whitespace-nowrap">
          {loading ? <BtnSpinner size={10} colorClass="border-emerald-400 !border-t-emerald-600" /> : <><CheckCircle size={10} /> Hoàn thành</>}
        </button>
      )}
    </div>
  );
}

// ── Invoice button — tách riêng để dùng cả desktop lẫn mobile ────────────────
function InvoiceButton({ order, invoiceLoadingId, onInvoice }) {
  const isThisLoading  = invoiceLoadingId === order.id;
  const isOtherLoading = !!invoiceLoadingId && !isThisLoading;

  return (
    <button
      onClick={e => { e.stopPropagation(); onInvoice(order.id, e); }}
      disabled={!!invoiceLoadingId}
      title={
        isThisLoading  ? 'Đang tạo hoá đơn...' :
        isOtherLoading ? 'Chờ đơn khác xong'   : 'Xem hoá đơn PDF'
      }
      className={`
        relative p-1.5 rounded-lg border transition-all duration-200
        ${isThisLoading
          ? 'bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/40 cursor-wait ring-2 ring-[#C9A84C]/30 ring-offset-1'
          : isOtherLoading
          ? 'bg-[#F0EBE3] text-[#C4B9A8] border-[#F0EBE3] cursor-not-allowed opacity-40'
          : 'bg-[#C9A84C]/10 text-[#C9A84C] border-transparent hover:bg-[#C9A84C]/20 hover:scale-105 active:scale-95'
        }
      `}
    >
      {isThisLoading
        ? <BtnSpinner size={13} colorClass="border-[#C9A84C] !border-t-transparent" />
        : <FileText size={13} />
      }
      {isThisLoading && (
        <span className="
          absolute -top-7 left-1/2 -translate-x-1/2
          whitespace-nowrap text-[10px] font-medium
          bg-[#1C1C1E] text-white px-2 py-0.5 rounded-md
          pointer-events-none z-10
        ">
          Đang tạo...
        </span>
      )}
    </button>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────
function OrderCard({
  o, actionLoading, invoiceLoadingId,
  onPendingPayment, onComplete, onPartialPayment,
  onUpdatePaymentMethod, onInvoice,
}) {
  const isCompleted = o.status === 'COMPLETED' || o.status === 'CANCELLED';
  const isActioning = actionLoading === o.id;
  const isThisInvoiceLoading = invoiceLoadingId === o.id;

  return (
    <div className={`
      rounded-2xl border p-4 space-y-3 transition-all
      ${isThisInvoiceLoading
        ? 'bg-[#C9A84C]/5 border-[#C9A84C]/40'
        : 'bg-white border-[#F0EBE3]'
      }
      ${isActioning ? 'opacity-60' : ''}
    `}>
      <div className="flex items-start justify-between gap-2">
        <div>
          {/* Mã đơn + dot loading */}
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</p>
            {isThisInvoiceLoading && (
              <span className="flex gap-0.5 items-center">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1 h-1 rounded-full bg-[#C9A84C] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-[#1C1C1E] mt-0.5">{o.customerName}</p>
          <p className="text-[10px] text-[#8E8878]">{o.customerPhone}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-[#1C1C1E]">{formatPrice(o.finalAmount)}</p>
          {o.paidAmount > 0 && (
            <p className="text-[10px] text-emerald-600 font-medium">Đã thu: {formatPrice(o.paidAmount)}</p>
          )}
          <p className="text-[10px] text-[#8E8878] mt-0.5">{formatDateShort(o.createdAt)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#F0EBE3]">
        <StatusBadge status={o.status} />
        <WarehouseBadge name={o.warehouseName} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <CreatedByBadge name={o.orderedByName} />
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Nút invoice */}
          <InvoiceButton order={o} invoiceLoadingId={invoiceLoadingId} onInvoice={onInvoice} />

          <PaymentMethodCell
            value={o.paymentMethod}
            onSave={val => onUpdatePaymentMethod(o.id, val)}
            disabled={isCompleted || isActioning || !!invoiceLoadingId}
          />
          <StatusActionButtons
            order={o}
            onPendingPayment={() => onPendingPayment(o.id)}
            onComplete={() => onComplete(o.id)}
            onPartialPayment={() => onPartialPayment(o)}
            loading={isActioning}
          />
        </div>
      </div>

      {/* Banner loading ở bottom */}
      {isThisInvoiceLoading && (
        <div className="flex items-center gap-2 bg-[#C9A84C]/10 rounded-lg px-3 py-2">
          <BtnSpinner size={11} colorClass="border-[#C9A84C] !border-t-transparent" />
          <span className="text-[11px] font-medium text-[#C9A84C]">Đang tạo hoá đơn PDF...</span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountantOrdersPage() {
  const toast = useToast();

  const [orders, setOrders]           = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(null);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(0);
  const [loading, setLoading]         = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [productFilter, setProductFilter] = useState('');  // productId
  const [customerFilter, setCustomerFilter] = useState(''); // customerId
  const [products, setProducts]       = useState([]);
  const [customers, setCustomers]     = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [showFilter, setShowFilter]   = useState(false);
  const [exporting, setExporting]     = useState(false);

  // id đơn đang tạo invoice — null khi rảnh
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);

  const [partialOrder, setPartialOrder]     = useState(null);
  const [partialLoading, setPartialLoading] = useState(false);

  const PAGE_SIZE  = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = { page: p, size: PAGE_SIZE };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (dateRange.from) params.from = new Date(dateRange.from).setHours(0,0,0,0);
      if (dateRange.to)   params.to   = new Date(dateRange.to).setHours(23,59,59,999);
      if (productFilter)  params.productId  = productFilter;
      if (customerFilter) params.customerId = customerFilter;

      const res = await accountantApi.getOrders(params);
      let content = res.data?.data?.content || [];

      if (search.trim()) {
        const q = search.toLowerCase();
        content = content.filter(o =>
          o.orderCode?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.customerPhone?.includes(q)
        );
      }
      setOrders(content);
      setTotal(res.data?.data?.totalItems || 0);
      setPage(p);
    } catch {
      toast('Không thể tải danh sách đơn hàng', 'error');
    } finally { setLoading(false); }
  }, [statusFilter, dateRange, search, productFilter, customerFilter]);

  useEffect(() => { fetchOrders(0); }, [fetchOrders]);

  // Load products for filter
  useEffect(() => {
    import('../../api/services').then(({ accountantApi: api }) => {
      api.getProducts && api.getProducts()
        .then(r => setProducts(r.data?.data || []))
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Export Excel ──────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (dateRange.from) params.from = new Date(dateRange.from).setHours(0,0,0,0);
      if (dateRange.to)   params.to   = new Date(dateRange.to).setHours(23,59,59,999);
      if (productFilter)  params.productId  = productFilter;
      if (customerFilter) params.customerId = customerFilter;
      const res = await accountantApi.exportOrders(params);
      downloadBlob(res.data, `don-hang-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`);
    } catch {
      toast('Không thể xuất file Excel', 'error');
    } finally { setExporting(false); }
  };

  // ── Invoice — gọi endpoint riêng của accountant ──────────────────────────
  const handleInvoice = async (orderId, e) => {
    if (e) e.stopPropagation();
    if (invoiceLoadingId) return;
    setInvoiceLoadingId(orderId);
    try {
      const res = await accountantApi.getInvoice(orderId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch {
      toast('Không thể tải hoá đơn', 'error');
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  // ── Status actions ────────────────────────────────────────────────────────
  const handlePendingPayment = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await accountantApi.markPendingPayment(orderId);
      if (res?.data?.success === false) { toast(res.data.message || 'Không thể cập nhật trạng thái', 'error'); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PENDING_PAYMENT' } : o));
      toast('Đã chuyển sang Chờ thanh toán', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi cập nhật trạng thái', 'error');
    } finally { setActionLoading(null); }
  };

  const handleComplete = async (orderId) => {
    setActionLoading(orderId);
    try {
      const res = await accountantApi.markCompleted(orderId);
      if (res?.data?.success === false) { toast(res.data.message || 'Không thể hoàn thành đơn hàng', 'error'); return; }
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, status: 'COMPLETED', paymentStatus: 'PAID', paidAmount: o.finalAmount } : o
      ));
      toast('Đã hoàn thành đơn hàng', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi hoàn thành đơn hàng', 'error');
    } finally { setActionLoading(null); }
  };

  const handlePartialPayment = async ({ paidAmount, debtDays, paymentMethod, bankName, transactionRef }) => {
    if (!partialOrder) return;
    setPartialLoading(true);
    try {
      const res = await accountantApi.recordPartialPayment(partialOrder.id, paidAmount, debtDays);
      const finalAmount = Number(partialOrder.finalAmount || 0);
      const alreadyPaid = Number(partialOrder.paidAmount || 0);
      const newPaid     = alreadyPaid + paidAmount;
      const isFullPaid  = newPaid >= finalAmount;
      setOrders(prev => prev.map(o =>
        o.id === partialOrder.id
          ? { ...o, paidAmount: newPaid, paymentStatus: isFullPaid ? 'PAID' : 'PARTIAL',
              status: isFullPaid ? 'COMPLETED' : 'PENDING_PAYMENT' }
          : o
      ));
      toast(isFullPaid ? 'Đã thanh toán đủ — đơn hoàn thành' : `Đã ghi nhận ${new Intl.NumberFormat('vi-VN').format(paidAmount)} đ`, 'success');
      setPartialOrder(null);
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi ghi nhận thanh toán', 'error');
    } finally { setPartialLoading(false); }
  };

  const handleUpdatePaymentMethod = async (orderId, paymentMethod) => {
    setActionLoading(orderId);
    try {
      const res = await accountantApi.updatePaymentMethod(orderId, paymentMethod);
      if (res?.data?.success === false) { toast(res.data.message || 'Không thể cập nhật phương thức thanh toán', 'error'); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentMethod } : o));
      toast('Đã cập nhật phương thức thanh toán', 'success');
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi khi cập nhật phương thức thanh toán', 'error');
    } finally { setActionLoading(null); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#FAF7F2]">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-[#F0EBE3]">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#1C1C1E]">Đơn hàng</h1>
            <p className="text-[10px] sm:text-xs text-[#8E8878]">{total} đơn hàng</p>
          </div>

          <div className="relative hidden sm:block">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
            <input type="text" placeholder="Tìm đơn, khách hàng..."
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="border border-[#E8DDD0] rounded-xl pl-9 pr-4 py-2 text-sm bg-white
                focus:outline-none focus:border-[#C9A84C] w-48 lg:w-56" />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
            <DateRangePicker
              from={dateRange.from} to={dateRange.to}
              onChange={r => { setDateRange(r); setPage(0); }}
              placeholder="Khoảng ngày" />
            {productFilter && (
              <button onClick={() => setProductFilter('')}
                className="flex items-center gap-1 px-2 py-1 bg-[#C9A84C]/10 text-[#C9A84C] rounded-lg text-xs font-medium">
                Bỏ lọc món <X size={10} />
              </button>
            )}
            {customerFilter && (
              <button onClick={() => setCustomerFilter('')}
                className="flex items-center gap-1 px-2 py-1 bg-sky-50 text-sky-600 rounded-lg text-xs font-medium">
                Bỏ lọc KH <X size={10} />
              </button>
            )}
          </div>

          <div className="flex sm:hidden items-center gap-1.5">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input type="text" placeholder="Tìm..."
                value={searchInput} onChange={e => setSearchInput(e.target.value)}
                className="border border-[#E8DDD0] rounded-xl pl-8 pr-3 py-2 text-sm bg-white
                  focus:outline-none focus:border-[#C9A84C] w-28" />
            </div>
            <button onClick={() => setShowFilter(f => !f)}
              className={`p-2 rounded-xl border transition-colors
                ${showFilter ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-[#E8DDD0] text-[#8E8878]'}`}>
              <Filter size={15} />
            </button>
          </div>

          <button onClick={() => fetchOrders(0)}
            className="p-2 rounded-xl bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] transition-colors shrink-0">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-60 shrink-0"
            title="Xuất Excel">
            {exporting
              ? <BtnSpinner size={14} colorClass="border-emerald-400 !border-t-emerald-600" />
              : <Download size={14} />}
          </button>
        </div>

        {showFilter && (
          <div className="sm:hidden flex items-center gap-1.5 mb-3 flex-wrap">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-[#E8DDD0] rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-[#C9A84C] flex-1" />
            <span className="text-[#8E8878] text-xs">→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-[#E8DDD0] rounded-xl px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-[#C9A84C] flex-1" />
          </div>
        )}

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {FILTER_TABS.map(t => (
            <button key={t.value} onClick={() => setStatusFilter(t.value)}
              className={`shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors
                ${statusFilter === t.value ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8E8878] gap-2">
            <Search size={32} strokeWidth={1} />
            <p className="text-sm">Không có đơn hàng nào</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#FAF7F2] border-b border-[#F0EBE3]">
                    <tr>
                      {['Mã đơn', 'Thời gian', 'Khách hàng', 'Kho',
                        'Trạng thái', 'PT Thanh toán', 'Tổng tiền / Đã thu',
                        'Người tạo', 'Hoá đơn', 'Thao tác'].map(h => (
                        <th key={h}
                          className="text-left text-[10px] font-bold text-[#8E8878] uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      const isCompleted       = o.status === 'COMPLETED' || o.status === 'CANCELLED';
                      const isActioning       = actionLoading === o.id;
                      const isThisInvoice     = invoiceLoadingId === o.id;
                      const paidAmount        = Number(o.paidAmount || 0);

                      return (
                        <tr key={o.id}
                          onClick={async () => {
                            setDetailLoading(o.id);
                            try {
                              const res = await accountantApi.getOrderDetail(o.id);
                              setSelectedOrder(res.data?.data || o);
                            } catch {
                              setSelectedOrder(o);
                            } finally {
                              setDetailLoading(null);
                            }
                          }}
                          className={`
                            border-b border-[#F0EBE3] last:border-0 transition-colors cursor-pointer
                            ${isThisInvoice  ? 'bg-[#C9A84C]/5'   :
                              isActioning    ? 'opacity-60'        : 'hover:bg-[#FAF7F2]'}
                          `}>
                          {/* Mã đơn + dot loading */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-[#C9A84C]">{o.orderCode}</span>
                              {detailLoading === o.id && (
                                <div className="w-3 h-3 border border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                              )}
                              {isThisInvoice && (
                                <span className="flex gap-0.5 items-center">
                                  {[0, 1, 2].map(i => (
                                    <span key={i} className="w-1 h-1 rounded-full bg-[#C9A84C] animate-bounce"
                                      style={{ animationDelay: `${i * 0.15}s` }} />
                                  ))}
                                </span>
                              )}
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
                            <PaymentMethodCell
                              value={o.paymentMethod}
                              onSave={val => handleUpdatePaymentMethod(o.id, val)}
                              disabled={isCompleted || isActioning || !!invoiceLoadingId}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-[#1C1C1E] whitespace-nowrap">{formatPrice(o.finalAmount)}</p>
                            {paidAmount > 0 && (
                              <p className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">
                                Đã thu: {formatPrice(paidAmount)}
                              </p>
                            )}
                            {paidAmount > 0 && paidAmount < Number(o.finalAmount) && (
                              <p className="text-[10px] text-orange-500 font-medium whitespace-nowrap">
                                Còn: {formatPrice(Number(o.finalAmount) - paidAmount)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3"><CreatedByBadge name={o.orderedByName} /></td>

                          {/* Cột Hoá đơn */}
                          <td className="px-4 py-3">
                            <InvoiceButton
                              order={o}
                              invoiceLoadingId={invoiceLoadingId}
                              onInvoice={handleInvoice}
                            />
                          </td>

                          <td className="px-4 py-3">
                            <StatusActionButtons
                              order={o}
                              onPendingPayment={() => handlePendingPayment(o.id)}
                              onComplete={() => handleComplete(o.id)}
                              onPartialPayment={() => setPartialOrder(o)}
                              loading={isActioning}
                            />
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
                <OrderCard
                  key={o.id}
                  o={o}
                  actionLoading={actionLoading}
                  invoiceLoadingId={invoiceLoadingId}
                  onPendingPayment={handlePendingPayment}
                  onComplete={handleComplete}
                  onPartialPayment={setPartialOrder}
                  onUpdatePaymentMethod={handleUpdatePaymentMethod}
                  onInvoice={handleInvoice}
                />
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => fetchOrders(page - 1)} disabled={page === 0 || loading}
              className="p-2 rounded-xl bg-white border border-[#E8DDD0] text-[#8E8878]
                hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm text-[#8E8878] px-3">{page + 1} / {totalPages}</span>
            <button onClick={() => fetchOrders(page + 1)} disabled={page >= totalPages - 1 || loading}
              className="p-2 rounded-xl bg-white border border-[#E8DDD0] text-[#8E8878]
                hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Modal thanh toán 1 phần */}
      {partialOrder && (
        <PartialPaymentModal
          order={partialOrder}
          onClose={() => setPartialOrder(null)}
          onConfirm={handlePartialPayment}
          loading={partialLoading}
        />
      )}

      {/* Chi tiết đơn hàng */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onRefresh={fetchOrders}
        />
      )}
    </div>
  );
}