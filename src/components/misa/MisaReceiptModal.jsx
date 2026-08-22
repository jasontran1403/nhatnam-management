// src/components/misa/MisaReceiptModal.jsx
import { useState, useEffect } from 'react';
import { X, Plus, DollarSign, CheckCircle } from 'lucide-react';
import { accountantApi } from '../../api/services';
import { useToast } from '../common/Toast';
import { formatPrice } from '../../utils/formatPrice';

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Modal tạo / xem phiếu thu Misa.
 *
 * Props:
 *   order      — đơn hàng gốc
 *   onClose    — đóng modal
 *   onSuccess  — callback sau khi tạo thành công
 */
export default function MisaReceiptModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form tạo phiếu thu mới
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [bankRef, setBankRef] = useState('');
  const [note, setNote] = useState('');

  const [showOverpayWarning, setShowOverpayWarning] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(null);

  const loadReceipts = () => {
    setLoading(true);
    accountantApi.getMisaReceipts(order.id)
      .then(r => setReceipts(r.data?.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReceipts(); }, [order.id]);

  const totalPaid = receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const remaining = Number(order.finalAmount || 0) - totalPaid;
  const isFullyPaid = totalPaid >= Number(order.finalAmount || 0);

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmount(raw ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : '');
  };

  const handleCreate = async (force = false) => {
    const paidNum = Number((amount || '').replace(/[^0-9]/g, ''));
    if (!paidNum || paidNum <= 0) return toast('Nhập số tiền', 'error');
    if (paymentMethod === 'BANK_TRANSFER' && !bankRef.trim())
      return toast('Nhập mã giao dịch ngân hàng', 'error');

    if (!force && paidNum > remaining && remaining > 0) {
      setPendingCreate(paidNum);
      setShowOverpayWarning(true);
      return;
    }

    setCreating(true);
    setShowOverpayWarning(false);
    setPendingCreate(null);
    try {
      await accountantApi.createMisaReceipt(order.id, {
        amount: paidNum,
        paymentMethod,
        bankTransactionRef: paymentMethod === 'BANK_TRANSFER' ? bankRef.trim() : null,
        note: note.trim() || null,
      });
      toast('Tạo phiếu thu Misa thành công', 'success');
      setShowForm(false);
      setAmount('');
      setBankRef('');
      setNote('');
      loadReceipts();
      onSuccess?.();
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi tạo phiếu thu', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft flex-shrink-0">
          <div>
            <p className="text-[10px] text-muted uppercase tracking-wider">Phiếu thu Misa</p>
            <h3 className="font-bold text-ink font-mono text-sm">{order?.orderCode}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowForm(v => !v)}
              disabled={isFullyPaid}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border
    ${isFullyPaid
                  ? 'bg-surface-2 text-faint border-line-soft cursor-not-allowed opacity-50'
                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 border-emerald-200 dark:border-emerald-500/28'}`}>
              <Plus size={12} /> Tạo phiếu thu
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 text-muted">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Form tạo mới */}
        {showForm && (
          <div className="px-5 py-4 border-b border-line-soft bg-canvas space-y-3 flex-shrink-0">
            <p className="text-xs font-semibold text-ink">Tạo phiếu thu Misa mới</p>

            <div>
              <label className="text-[10px] text-muted mb-1 block">Số tiền *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">₫</span>
                <input type="text" inputMode="numeric" value={amount} onChange={handleAmountChange}
                  placeholder="0"
                  className="w-full pl-7 pr-4 py-2 border border-line rounded-xl text-sm font-bold focus:outline-none focus:border-gold" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted mb-1 block">Phương thức thanh toán</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'CASH', label: '💵 Tiền mặt' },
                  { value: 'BANK_TRANSFER', label: '🏦 Chuyển khoản' },
                ].map(m => (
                  <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all
                      ${paymentMethod === m.value ? 'bg-gold text-white border-gold' : 'border-line text-ink-2 hover:border-gold'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'BANK_TRANSFER' && (
              <div>
                <label className="text-[10px] text-muted mb-1 block">Mã giao dịch ngân hàng *</label>
                <input value={bankRef} onChange={e => setBankRef(e.target.value)}
                  placeholder="VD: FT23161234567"
                  className="w-full px-3 py-2 border border-line rounded-xl text-sm focus:outline-none focus:border-gold" />
              </div>
            )}

            <div>
              <label className="text-[10px] text-muted mb-1 block">Ghi chú</label>
              <input value={note} onChange={e => setNote(e.target.value)}
                placeholder="Tuỳ chọn"
                className="w-full px-3 py-2 border border-line rounded-xl text-sm focus:outline-none focus:border-gold" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl border border-line text-xs text-muted hover:bg-surface-2">Huỷ</button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {creating
                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <DollarSign size={12} />}
                {creating ? 'Đang tạo...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        )}

        {/* Thông tin thu */}
        <div className="px-5 pt-4 flex-shrink-0 space-y-2">
          <div className="flex justify-between text-xs bg-canvas rounded-xl px-4 py-2.5 border border-line-soft">
            <span className="text-muted">Tổng tiền đơn</span>
            <span className="font-bold text-ink">{formatPrice(order.finalAmount)}</span>
          </div>
          <div className="flex justify-between text-xs bg-canvas rounded-xl px-4 py-2.5 border border-line-soft">
            <span className="text-muted">Đã thu ({receipts.length} phiếu)</span>
            <span className="font-bold text-emerald-600">{formatPrice(totalPaid)}</span>
          </div>
          <div className={`flex justify-between text-xs rounded-xl px-4 py-2.5 border
            ${remaining <= 0
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200'
              : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200'}`}>
            <span className="text-muted">Còn lại</span>
            <span className={`font-bold ${remaining <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {remaining <= 0 ? 'Đã thu đủ' : formatPrice(remaining)}
            </span>
          </div>
        </div>

        {/* Overpay warning */}
        {showOverpayWarning && (
          <div className="mx-5 mt-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-3 flex-shrink-0">
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              ⚠️ Số tiền thu ({formatPrice(pendingCreate)}) lớn hơn số tiền còn lại ({formatPrice(remaining)}).
              Bạn có chắc muốn tạo phiếu thu này?
            </p>
            <div className="flex gap-2">
              <button onClick={() => { setShowOverpayWarning(false); setPendingCreate(null); }}
                className="flex-1 py-2 rounded-xl border border-line text-xs text-muted hover:bg-surface-2">Huỷ</button>
              <button onClick={() => handleCreate(true)}
                className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600">
                Xác nhận thu vượt
              </button>
            </div>
          </div>
        )}

        {/* Danh sách phiếu thu */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted gap-2">
              <DollarSign size={28} className="opacity-30" />
              <p className="text-sm">Chưa có phiếu thu Misa nào</p>
            </div>
          ) : (
            receipts.map((r, i) => (
              <div key={r.id} className="bg-canvas rounded-xl border border-line-soft p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300">{i + 1}</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-300">{r.misaReceiptCode}</span>
                  </div>
                  <span className="text-sm font-bold text-ink">{formatPrice(r.amount)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted">
                  <span>
                    {r.paymentMethod === 'CASH' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}
                    {r.bankTransactionRef && ` — ${r.bankTransactionRef}`}
                  </span>
                  <span>{formatDate(r.createdAt)}</span>
                </div>
                {r.note && <p className="text-[10px] text-muted italic">{r.note}</p>}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-line text-sm text-muted hover:bg-surface-2">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}