import { useState } from 'react';
import { X, Receipt, FileText, Eye, CreditCard, CheckCircle, Clock } from 'lucide-react';

/**
 * Modal xác nhận đặt hàng từ đơn SCHEDULED.
 * Cho phép:
 *  - Chọn phương thức thanh toán
 *  - Đánh dấu đã thanh toán chưa
 *  - Nhập tên người nhận (nếu chưa có)
 *  - Thay đổi hiển thị giá
 *  - Tạo phiếu đặt hàng (invoice từ draft)
 *  - Xác nhận đặt đơn thật
 */
export default function ScheduledOrderModal({ draft, onConfirm, onClose, onPreviewInvoice, previewLoading }) {
  const [paymentMethod, setPaymentMethod]         = useState(draft.paymentMethod || 'CASH');
  const [isPaid, setIsPaid]                       = useState(false);
  const [receiverName, setReceiverName]           = useState(draft.receiverName || '');
  const [priceDisplayOption, setPriceDisplayOption] = useState(() => {
    if (draft.hideAllPrices) return 'hide_all';
    if (!draft.showPrices)   return 'hide_prices';
    return 'show';
  });
  const [submitting, setSubmitting] = useState(false);

  const getShowPrices    = () => priceDisplayOption === 'show';
  const getHideAllPrices = () => priceDisplayOption === 'hide_all';

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm({
        paymentMethod,
        isPaid,
        receiverName:  receiverName.trim() || null,
        showPrices:    getShowPrices(),
        hideAllPrices: getHideAllPrices(),
        // deliveryDatetime = scheduledAt (đã được backend dùng)
        deliveryDatetime: draft.scheduledAt,
        orderedByName: draft.orderedByName,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const PAYMENT_OPTIONS = [
    { value: 'CASH',          label: '💵 Tiền mặt' },
    { value: 'BANK_TRANSFER', label: '🏦 Chuyển khoản' },
    { value: 'DEBT',          label: '📋 Công nợ' },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn overflow-hidden max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gold to-gold-strong px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Xác nhận đơn hẹn giờ</p>
            <h3 className="text-white font-bold text-base mt-0.5">Tạo đơn hàng</h3>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Thông tin đơn */}
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Đơn hẹn giờ · {draft.draftCode}
              </span>
            </div>
            <p className="text-[11px] text-amber-600 dark:text-amber-300 pl-5">
              Hẹn giao: <strong>{formatTime(draft.scheduledAt)}</strong>
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-300 pl-5">
              Khách: <strong>{draft.customerName}</strong>
            </p>
          </div>

          {/* Phương thức thanh toán */}
          <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <CreditCard size={11} /> Thanh toán
              </span>
            </label>
            <div className="flex gap-1.5">
              {PAYMENT_OPTIONS.map(({ value, label }) => (
                <button key={value} onClick={() => setPaymentMethod(value)}
                  className={`flex-1 text-[10px] py-2 rounded-lg border font-medium transition-colors
                    ${paymentMethod === value
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-line text-muted hover:border-gold'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Đã thanh toán chưa */}
          <button
            onClick={() => setIsPaid(v => !v)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all
              ${isPaid
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                : 'border-line hover:border-emerald-300 dark:border-emerald-500/35'}`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
              ${isPaid ? 'border-emerald-500 bg-emerald-500' : 'border-faint'}`}>
              {isPaid && <CheckCircle size={12} className="text-white" />}
            </div>
            <div className="text-left">
              <p className={`text-sm font-semibold ${isPaid ? 'text-emerald-700 dark:text-emerald-300' : 'text-ink-2'}`}>
                {isPaid ? '✓ Đã thanh toán' : 'Chưa thanh toán'}
              </p>
              <p className="text-[10px] text-muted">Đánh dấu trạng thái thanh toán đơn</p>
            </div>
          </button>

          {/* Người nhận */}
          <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
              📦 Tên người nhận hàng
            </label>
            <input
              type="text" value={receiverName}
              onChange={e => setReceiverName(e.target.value)}
              placeholder="Nhập tên người nhận..."
              className="w-full rounded-xl border-2 border-line px-4 py-2.5 text-sm
                         focus:outline-none focus:border-gold bg-surface"
            />
          </div>

          {/* Hiển thị giá */}
          <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
              💰 Hiển thị giá trên phiếu
            </label>
            <select
              value={priceDisplayOption}
              onChange={e => setPriceDisplayOption(e.target.value)}
              className="w-full rounded-xl border-2 border-line px-4 py-2.5 text-sm
                         focus:outline-none focus:border-gold bg-surface"
            >
              <option value="show">Hiển thị đầy đủ giá</option>
              <option value="hide_prices">Che giá (ẩn đơn giá, chỉ hiện tổng)</option>
              <option value="hide_all">Che toàn bộ (ẩn tất cả số tiền)</option>
            </select>
            <p className="text-[10px] text-muted mt-1">
              {priceDisplayOption === 'show'        && '✓ Hiển thị tất cả giá trên phiếu in'}
              {priceDisplayOption === 'hide_prices' && '✓ Ẩn giá từng sản phẩm, vẫn hiện tổng tiền'}
              {priceDisplayOption === 'hide_all'    && '✓ Ẩn toàn bộ số tiền (chỉ tên và số lượng)'}
            </p>
          </div>

          {/* Tạo phiếu trước khi đặt */}
          <button
            onClick={() => onPreviewInvoice(draft.id)}
            disabled={previewLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                       border-2 border-ink-2 text-ink-2 text-sm font-semibold
                       hover:bg-surface-2 disabled:opacity-40 transition-colors"
          >
            {previewLoading
              ? <><div className="w-3.5 h-3.5 border-2 border-[var(--c-ink-2)] border-t-transparent rounded-full animate-spin" /> Đang tạo phiếu...</>
              : <><FileText size={14} /> Xem phiếu đặt hàng</>
            }
          </button>
        </div>

        {/* Footer actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-line text-muted text-sm font-semibold hover:bg-surface-2">
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl btn-gold text-sm font-bold
                       flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {submitting
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang xử lý...</>
              : <><Receipt size={14} /> Tạo đơn hàng</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}