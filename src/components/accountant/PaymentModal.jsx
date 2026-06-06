// src/components/accountant/PaymentModal.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect } from 'react';
import {
  X, DollarSign, CreditCard, Banknote, ClipboardList,
  Loader2, CheckCircle, Clock, ChevronDown,
} from 'lucide-react';
import { accountantApi, paymentApi } from '../../api/services';
import { useToast } from '../common/Toast';

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
function formatVND(str) {
  const n = Number(String(str).replace(/[^0-9]/g, ''));
  if (isNaN(n) || n === 0) return '';
  return new Intl.NumberFormat('vi-VN').format(n);
}
function parseVND(str) {
  return Number(String(str).replace(/[^0-9]/g, '')) || 0;
}

function getPaymentMethods(t) {
  return [
    { value: 'CASH', label: t('payment', 'cash_icon'), needsBank: false },
    { value: 'BANK_TRANSFER', label: t('payment', 'bank_transfer_icon'), needsBank: true },
    { value: 'DEBT', label: t('payment', 'debt_icon'), needsBank: false },
  ];
}

function getTxMethodLabel(t) {
  return {
    CASH: t('payment', 'cash_icon'),
    BANK_TRANSFER: t('payment', 'bank_transfer_icon'),
    DEBT: t('payment', 'debt_icon'),
  };
}

export default function PaymentModal({ order, onClose, onSuccess }) {
  const { t } = useLang();
  const toast = useToast();
  const PAYMENT_METHODS = getPaymentMethods(t);
  const TX_METHOD_LABEL = getTxMethodLabel(t);
  const [amount, setAmount] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [method, setMethod] = useState('CASH');
  const [bankName, setBankName] = useState('');
  const [txRef, setTxRef] = useState('');
  const [debtDays, setDebtDays] = useState(order?.debtDays || 0);
  const [submitting, setSubmitting] = useState(false);
  const [txHistory, setTxHistory] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const remaining = (order?.finalAmount || 0) - (order?.paidAmount || 0);
  const needsBank = PAYMENT_METHODS.find(m => m.value === method)?.needsBank;

  useEffect(() => {
    loadHistory();
  }, [order?.id]);

  const loadHistory = async () => {
    try {
      setTxLoading(true);
      const res = await paymentApi.getTransactions(order.id);
      setTxHistory(res.data?.data || []);
    } catch {
      // OK if no transactions yet
    } finally {
      setTxLoading(false);
    }
  };

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmount(raw);
    setAmountDisplay(raw ? formatVND(raw) : '');
  };

  const fillRemaining = () => {
    const rounded = Math.round(remaining);
    setAmount(String(rounded));
    setAmountDisplay(formatVND(String(rounded))); // ← dùng số đã làm tròn
  };

  const handleSubmit = async () => {
    const paidAmount = parseVND(amount);
    if (!paidAmount || paidAmount <= 0) { toast(t('payment', 'enter_paid_amount_required'), 'warning'); return; }
    if (paidAmount > remaining + 1) {
      toast(`${t('payment', 'enter_amount_collected')}: ${formatPrice(remaining)}`, 'warning');
      return;
    }
    if (needsBank && !bankName.trim()) {
      toast(t('payment', 'bank_name_required'), 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await accountantApi.recordPartialPayment(
        order.id,
        paidAmount,
        method === 'DEBT' ? debtDays : 0,
        method,
        needsBank ? bankName.trim() : undefined,
        needsBank ? txRef.trim() : undefined,
      );
      toast(t('payment', 'record_success'), 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      toast(e.response?.data?.message || t('payment', 'record_error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3]">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-[#C9A84C]" />
            <h2 className="text-sm font-bold text-[#1C1C1E]">{t('payment', 'record_payment')}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-xl flex items-center justify-center text-[#8E8878] hover:bg-[#F0EBE3]">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Order summary */}
          <div className="bg-[#FAF7F2] rounded-xl px-4 py-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[#8E8878]">{t('order', 'order')}</p>
              <p className="font-bold text-[#1C1C1E]">{order?.orderCode}</p>
            </div>
            <div>
              <p className="text-[#8E8878]">{t('order', 'total_amount')}</p>
              <p className="font-bold text-[#1C1C1E]">{formatPrice(order?.finalAmount)}</p>
            </div>
            <div>
              <p className="text-[#8E8878]">{t('payment', 'collected')}</p>
              <p className="font-semibold text-emerald-600">{formatPrice(order?.paidAmount || 0)}</p>
            </div>
            <div>
              <p className="text-[#8E8878]">{t('payment', 'remaining')}</p>
              <p className="font-bold text-orange-600">{formatPrice(remaining)}</p>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-xs font-semibold text-[#1C1C1E] mb-1.5 block">
              {t('payment', 'enter_amount_collected')} *
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text" inputMode="numeric"
                  placeholder="0"
                  value={amountDisplay}
                  onChange={handleAmountChange}
                  className="w-full text-sm border-2 border-[#E8DDD0] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] pr-8 text-right font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8E8878]">đ</span>
              </div>
              <button
                onClick={fillRemaining}
                className="px-3 py-2 text-xs border border-[#E8DDD0] rounded-xl text-[#C9A84C] font-semibold hover:bg-[#C9A84C]/5 transition-colors whitespace-nowrap"
              >
                Thu hết
              </button>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs font-semibold text-[#1C1C1E] mb-1.5 block">
              Phương thức thanh toán *
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-semibold border-2 transition-all text-center ${method === m.value
                      ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#8B6914]'
                      : 'border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]/50'
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bank info — only for BANK_TRANSFER */}
          {needsBank && (
            <div className="space-y-2.5 border border-blue-100 rounded-xl px-3 py-3 bg-blue-50/30">
              <p className="text-[10px] font-semibold text-blue-700 flex items-center gap-1">
                <CreditCard size={11} /> Thông tin chuyển khoản
              </p>
              <div>
                <label className="text-[10px] text-[#8E8878] mb-1 block">Tên ngân hàng *</label>
                <input
                  type="text"
                  placeholder="VD: Vietcombank, Techcombank..."
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full text-xs border border-[#E8DDD0] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8E8878] mb-1 block">Mã giao dịch (tuỳ chọn)</label>
                <input
                  type="text"
                  placeholder="Mã tham chiếu giao dịch..."
                  value={txRef}
                  onChange={e => setTxRef(e.target.value)}
                  className="w-full text-xs border border-[#E8DDD0] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
            </div>
          )}

          {/* Debt days */}
          {method === 'DEBT' && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-[#1C1C1E] whitespace-nowrap">Số ngày công nợ:</label>
              <input
                type="number" min={0} max={365}
                value={debtDays}
                onChange={e => setDebtDays(Math.max(0, Math.min(365, Number(e.target.value))))}
                className="w-20 text-xs border border-[#E8DDD0] rounded-xl px-2 py-1.5 text-center focus:outline-none focus:border-[#C9A84C]"
              />
              <span className="text-xs text-[#8E8878]">ngày</span>
            </div>
          )}

          {/* Payment history */}
          {txHistory.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#8E8878] hover:text-[#1C1C1E] transition-colors mb-2"
              >
                <Clock size={12} />
                Lịch sử thanh toán ({txHistory.length} lần)
                <ChevronDown size={12} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>

              {showHistory && (
                <div className="border border-[#F0EBE3] rounded-xl overflow-hidden">
                  {txHistory.map((tx, i) => (
                    <div key={tx.id}
                      className={`flex items-start gap-3 px-3 py-2.5 text-xs ${i < txHistory.length - 1 ? 'border-b border-[#F0EBE3]' : ''}`}>
                      <CheckCircle size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#1C1C1E]">{formatPrice(tx.amount)}</span>
                          <span className="text-[10px] text-[#8E8878]">{formatDate(tx.createdAt)}</span>
                        </div>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-[#8E8878]">
                            {TX_METHOD_LABEL[tx.paymentMethod] || tx.paymentMethod}
                          </span>
                          {tx.bankName && (
                            <span className="text-[10px] text-blue-600">🏦 {tx.bankName}</span>
                          )}
                          {tx.transactionRef && (
                            <span className="text-[10px] text-[#8E8878]">Ref: {tx.transactionRef}</span>
                          )}
                          {tx.collectedBy && (
                            <span className="text-[10px] text-[#8E8878]">👤 {tx.collectedBy}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 border-2 border-[#E8DDD0] rounded-xl text-sm font-medium text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
            {t('common', 'cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !amount}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#C9A84C] text-white rounded-xl text-sm font-semibold hover:bg-[#A07830] transition-colors disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />}
            {submitting ? t('common', 'processing') : t('common', 'confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
