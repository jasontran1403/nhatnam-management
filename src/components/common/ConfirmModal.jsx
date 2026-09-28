// src/components/common/ConfirmModal.jsx
//
// MODAL XÁC NHẬN — thay thế `window.confirm()` mặc định của browser.
//
// UI/UX cùng phong cách với hệ thống toast (viền, bo góc, màu nền theo variant)
// để giữ nhất quán thị giác. Sử dụng:
//
//   const [confirming, setConfirming] = useState(null);
//   ...
//   <button onClick={() => setConfirming({
//     title: 'Xác nhận đặt hàng?',
//     message: 'Sau khi đặt, toàn bộ phiếu yêu cầu sẽ bị RESET về 0.',
//     confirmLabel: 'Đặt hàng',
//     variant: 'primary',
//     onConfirm: doPlaceOrder,
//   })}>Đặt hàng</button>
//   ...
//   {confirming && (
//     <ConfirmModal
//       {...confirming}
//       onClose={() => setConfirming(null)}
//     />
//   )}
//
// Variant:
//   · 'primary' (mặc định) — nút xác nhận màu gold
//   · 'danger'             — nút xác nhận màu đỏ (dùng cho Xoá)
//
// Được thiết kế uncontrolled cho onConfirm: hàm truyền vào có thể async, modal
// sẽ show loading state trong khi await. Nếu onConfirm throw, modal vẫn đóng để
// caller tự xử lý toast lỗi (không nuốt exception).
import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  title = 'Xác nhận?',
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Huỷ',
  variant = 'primary', // 'primary' | 'danger'
  onConfirm,
  onClose,
}) {
  const [busy, setBusy] = useState(false);

  // Đóng bằng Esc — thân thiện hơn phải chuột
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      // Đóng dù onConfirm thành công hay lỗi — caller đã có toast báo lỗi.
      setBusy(false);
      onClose();
    }
  };

  const confirmClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-gold hover:bg-gold-deep text-white';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4
      animate-[fadeIn_0.15s_ease]"
      onClick={busy ? undefined : onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden
        animate-[popIn_0.18s_cubic-bezier(0.34,1.56,0.64,1)]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
            ${variant === 'danger' ? 'bg-red-50 text-red-500' : 'bg-gold/15 text-gold'}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-bold text-ink text-base leading-tight">{title}</h3>
            {message && (
              <p className="text-sm text-muted mt-1.5 leading-relaxed whitespace-pre-line">
                {message}
              </p>
            )}
          </div>
          <button onClick={onClose} disabled={busy}
            className="w-7 h-7 rounded-full bg-canvas hover:bg-hairline flex items-center
              justify-center shrink-0 disabled:opacity-40">
            <X size={14} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-hairline mt-2">
          <button onClick={onClose} disabled={busy}
            className="flex-1 px-3.5 py-2 rounded-xl bg-surface border border-hairline-2
              text-sm font-semibold text-ink-2 hover:border-gold hover:text-gold
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {cancelLabel}
          </button>
          <button onClick={handleConfirm} disabled={busy}
            className={`flex-1 px-3.5 py-2 rounded-xl text-sm font-semibold shadow-sm
              transition-colors active:scale-[0.98] disabled:opacity-60
              disabled:cursor-not-allowed ${confirmClass}`}>
            {busy ? 'Đang xử lý…' : confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn  { from { opacity: 0; transform: scale(0.95); }
                            to   { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}