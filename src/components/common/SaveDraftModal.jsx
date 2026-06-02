import { useState, useEffect } from 'react';
import { X, Save, Clock, FileText, Calendar, User, Package, Eye, EyeOff } from 'lucide-react';

/**
 * Modal hiện khi nhấn "Lưu nháp".
 * Cho phép chọn:
 *   - Lưu đơn nháp (DRAFT) — như cũ
 *   - Lưu đơn hẹn giờ (SCHEDULED) — yêu cầu thêm thông tin
 */
export default function SaveDraftModal({ onConfirm, onClose, customer, hasCustomer }) {
  const [mode, setMode] = useState('SCHEDULED'); // null | 'DRAFT' | 'SCHEDULED'

  // Fields cho SCHEDULED
  const defaultScheduled = (() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  })();

  const [scheduledDate, setScheduledDate]         = useState(defaultScheduled);
  const [orderedBy, setOrderedBy]                 = useState('');
  const [recipientName, setRecipientName]         = useState('');
  const [priceDisplayOption, setPriceDisplayOption] = useState('show');
  const [DTPicker, setDTPicker]                   = useState(null);

  useEffect(() => {
    import('../ui/DateTimePicker').then(m => setDTPicker(() => m.default));
  }, []);

  // Pre-fill từ customer
  useEffect(() => {
    if (customer?.selectedReceiver?.receiverName) {
      setRecipientName(customer.selectedReceiver.receiverName);
    }
  }, [customer]);

  const getShowPrices    = () => priceDisplayOption === 'show';
  const getHideAllPrices = () => priceDisplayOption === 'hide_all';

  const handleConfirmScheduled = () => {
    if (!scheduledDate) return;
    onConfirm({
      type:          'SCHEDULED',
      scheduledAt:   scheduledDate.getTime(),
      orderedByName: orderedBy.trim() || null,
      receiverName:  recipientName.trim() || null,
      showPrices:    getShowPrices(),
      hideAllPrices: getHideAllPrices(),
    });
  };

  // ── Step 1: chọn loại ──────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#5C4E3D] to-[#3D3028] px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">Lưu đơn</p>
              <h3 className="text-white font-bold text-base mt-0.5">Chọn hình thức lưu</h3>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
              <X size={15} />
            </button>
          </div>

          {/* Options */}
          <div className="p-5 space-y-3">
            {/* DRAFT */}
            <button
              onClick={() => onConfirm({ type: 'DRAFT' })}
              className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-[#E8DDD0]
                         hover:border-[#C9A84C] hover:bg-[#FDF8ED] transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F0EBE3] flex items-center justify-center shrink-0
                              group-hover:bg-[#C9A84C]/15 transition-colors">
                <Save size={18} className="text-[#8E8878] group-hover:text-[#C9A84C]" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#1C1C1E]">Lưu đơn nháp</p>
                <p className="text-[11px] text-[#8E8878] mt-0.5">
                  Lưu tạm giỏ hàng, tiếp tục chỉnh sửa sau.
                  Không giữ tồn kho.
                </p>
              </div>
            </button>

            {/* SCHEDULED */}
            <button
              onClick={() => setMode('SCHEDULED')}
              className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-[#E8DDD0]
                         hover:border-amber-400 hover:bg-amber-50/60 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0
                              group-hover:bg-amber-100 transition-colors">
                <Clock size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#1C1C1E]">Đặt hàng hẹn giờ</p>
                <p className="text-[11px] text-[#8E8878] mt-0.5">
                  Hẹn thời điểm cần xuất đơn. Hiển thị đếm ngược
                  và cảnh báo khi sắp đến giờ.
                </p>
                {!hasCustomer && (
                  <p className="text-[10px] text-amber-600 mt-1 font-semibold">
                    ⚠ Yêu cầu chọn khách hàng
                  </p>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: form SCHEDULED ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-4 flex items-center justify-between">
          <div>
            <button
              onClick={() => setMode(null)}
              className="flex items-center gap-1.5 text-white/70 text-[10px] hover:text-white mb-1 transition-colors"
            >
              ← Quay lại
            </button>
            <h3 className="text-white font-bold text-base">Đặt hàng hẹn giờ</h3>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Khách hàng (chỉ read-only nếu đã có) */}
          {hasCustomer ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <User size={14} className="text-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#1C1C1E]">
                  {customer?.contactName || customer?.name}
                </p>
                <p className="text-[10px] text-[#8E8878]">{customer?.phone}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
              <User size={14} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-600 font-semibold">
                Vui lòng chọn khách hàng trước khi hẹn giờ
              </p>
            </div>
          )}

          {/* Thời gian hẹn */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">
              <span className="flex items-center gap-1.5">
                <Clock size={11} /> Thời điểm cần xuất đơn *
              </span>
            </label>
            {DTPicker
              ? <DTPicker
                  value={scheduledDate}
                  onChange={setScheduledDate}
                  minDate={new Date()}
                  placeholder="Chọn ngày & giờ hẹn..."
                />
              : <div className="h-11 rounded-xl border-2 border-[#E8DDD0] animate-pulse bg-[#FAFAF8]" />
            }
            <p className="text-[10px] text-[#8E8878] mt-1">
              Đơn sẽ hiển thị đếm ngược đến thời điểm này.
            </p>
          </div>

          {/* Người đặt */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">
              👤 Tên người đặt hàng
            </label>
            <input
              type="text" value={orderedBy}
              onChange={e => setOrderedBy(e.target.value)}
              placeholder="Nhập tên người đặt (nếu có)..."
              className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm
                         focus:outline-none focus:border-amber-400 bg-[#FAFAF8]"
            />
          </div>

          {/* Người nhận */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">
              <span className="flex items-center gap-1.5">
                <Package size={11} /> Tên người nhận hàng
              </span>
            </label>
            <input
              type="text" value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="Nhập tên người nhận..."
              className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm
                         focus:outline-none focus:border-amber-400 bg-[#FAFAF8]"
            />
          </div>

          {/* Hiển thị giá trên phiếu */}
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">
              <span className="flex items-center gap-1.5">
                <Eye size={11} /> Hiển thị giá trên phiếu
              </span>
            </label>
            <select
              value={priceDisplayOption}
              onChange={e => setPriceDisplayOption(e.target.value)}
              className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm
                         focus:outline-none focus:border-amber-400 bg-white"
            >
              <option value="show">Hiển thị đầy đủ giá</option>
              <option value="hide_prices">Che giá (ẩn đơn giá, chỉ hiện tổng)</option>
              <option value="hide_all">Che toàn bộ (ẩn tất cả số tiền)</option>
            </select>
            <p className="text-[10px] text-[#8E8878] mt-1">
              {priceDisplayOption === 'show'        && '✓ Hiển thị tất cả giá trên phiếu in'}
              {priceDisplayOption === 'hide_prices' && '✓ Ẩn giá từng sản phẩm, vẫn hiện tổng tiền'}
              {priceDisplayOption === 'hide_all'    && '✓ Ẩn toàn bộ số tiền (chỉ tên và số lượng)'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={() => setMode(null)}
            className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-[#8E8878] text-sm font-semibold hover:bg-[#F0EBE3]"
          >
            Quay lại
          </button>
          <button
            onClick={handleConfirmScheduled}
            disabled={!scheduledDate || !hasCustomer}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold
                       hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            <Clock size={14} /> Hẹn giờ
          </button>
        </div>
      </div>
    </div>
  );
}