// src/components/seller/ReturnOrderModal.jsx
// Modal trả hàng do feedback xấu — trường hợp 1: trả phần chưa sử dụng.
import { useState } from 'react';
import { X, RotateCcw, AlertTriangle } from 'lucide-react';
import { orderApi } from '../../api/services';
import { useToast } from '../common/Toast';
import { formatPrice } from '../../utils/formatPrice';

export default function ReturnOrderModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [items, setItems] = useState(() =>
    (order.items || []).map(item => ({
      orderItemId: item.id,
      productName: item.productName,
      unit: item.unit || '',
      originalQty: Number(item.quantity),
      usedQty: '',
      returnQty: '',
      selected: false,
    }))
  );

  const toggleItem = (idx) => {
    setItems(prev => prev.map((it, i) =>
      i === idx ? { ...it, selected: !it.selected } : it
    ));
  };

  const updateUsedQty = (idx, val) => {
    const digits = val.replace(/[^0-9.]/g, '');
    const used = Number(digits) || 0;
    const orig = items[idx].originalQty;
    const ret = Math.max(0, orig - used);
    setItems(prev => prev.map((it, i) =>
      i === idx ? { ...it, usedQty: digits, returnQty: String(ret) } : it
    ));
  };

  const selectedItems = items.filter(it => it.selected && Number(it.returnQty) > 0);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast('Vui lòng nhập lý do trả hàng', 'error');
      return;
    }
    if (selectedItems.length === 0) {
      toast('Vui lòng chọn ít nhất 1 sản phẩm để trả', 'error');
      return;
    }

    for (const it of selectedItems) {
      const used = Number(it.usedQty) || 0;
      const ret = Number(it.returnQty) || 0;
      if (used + ret > it.originalQty) {
        toast(`Tổng (đã dùng + trả) vượt quá số lượng đơn cho ${it.productName}`, 'error');
        return;
      }
      if (ret <= 0) {
        toast(`Số lượng trả phải lớn hơn 0 cho ${it.productName}`, 'error');
        return;
      }
    }

    setLoading(true);
    try {
      await orderApi.returnItems(order.id, {
        reason: reason.trim(),
        items: selectedItems.map(it => ({
          orderItemId: it.orderItemId,
          usedQuantity: Number(it.usedQty) || 0,
          returnQuantity: Number(it.returnQty) || 0,
        })),
      });
      toast('Trả hàng thành công!', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast(err?.response?.data?.message || 'Không thể trả hàng', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line-soft shrink-0">
          <div className="flex items-center gap-2">
            <RotateCcw size={18} className="text-orange-500" />
            <div>
              <h3 className="font-bold text-ink text-sm">Trả hàng — Feedback xấu</h3>
              <p className="text-xs text-muted">Đơn <span className="font-mono font-bold text-gold">{order.orderCode}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-muted"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Lý do */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Lý do trả hàng *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="VD: Khách phản hồi sản phẩm mặn, không đạt yêu cầu..."
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-line text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface resize-none"
            />
          </div>

          {/* Info */}
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/28 rounded-xl p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle size={13} />
              Phần đã sử dụng sẽ được giữ trong đơn với ghi chú "Tặng khách hàng" (0đ).
              Phần trả lại sẽ được hoàn vào kho.
            </p>
          </div>

          {/* Danh sách sản phẩm */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Chọn sản phẩm trả</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.orderItemId}
                  className={`rounded-xl border p-3 transition-colors ${item.selected
                    ? 'border-gold bg-gold/5' : 'border-line-soft bg-canvas'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleItem(idx)}
                      className="w-4 h-4 rounded accent-gold"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{item.productName}</p>
                      <p className="text-xs text-muted">
                        Số lượng đơn: <span className="font-bold">{item.originalQty} {item.unit}</span>
                      </p>
                    </div>
                  </label>

                  {item.selected && (
                    <div className="mt-3 pl-7 grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted mb-1 block">Đã dùng ({item.unit})</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.usedQty}
                          onChange={e => updateUsedQty(idx, e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 bg-surface"
                        />
                        <p className="text-[10px] text-muted mt-0.5">Tặng khách, 0đ</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted mb-1 block">Trả lại kho ({item.unit})</label>
                        <input
                          type="text"
                          value={item.returnQty}
                          readOnly
                          className="w-full px-3 py-2 rounded-lg border border-line text-sm bg-canvas text-ink font-semibold"
                        />
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-300 mt-0.5">Hoàn kho</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-line-soft flex gap-2 shrink-0">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-line-soft text-sm text-muted hover:bg-surface-2 disabled:opacity-50">
            Huỷ
          </button>
          <button onClick={handleSubmit} disabled={loading || selectedItems.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {loading
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <RotateCcw size={14} />}
            {loading ? 'Đang xử lý...' : 'Xác nhận trả hàng'}
          </button>
        </div>
      </div>
    </div>
  );
}
