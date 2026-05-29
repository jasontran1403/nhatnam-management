// src/components/common/CancelOrderModal.jsx
import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useLang } from '../../context/LangContext';

export default function CancelOrderModal({ order, onClose, onConfirm, loading }) {
  const { t } = useLang();
  const [reason, setReason] = useState('');
  const [error,  setError]  = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) { setError(t('order', 'cancel_reason_required')); return; }
    onConfirm(reason.trim());
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EBE3]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-[#8E8878]">{t('order', 'cancel_order')}</p>
              <p className="font-bold text-[#1C1C1E] font-mono text-sm">{order.orderCode}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#8E8878] hover:bg-[#F0EBE3]">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-[#5C5C5C]">
            {t('common', 'actions')} <strong className="text-red-500">{t('misc', 'not_required')}</strong>.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1C1C1E]">
              {t('order', 'cancel_reason')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setError(''); }}
              placeholder={t('order', 'cancel_reason_placeholder')}
              rows={3} autoFocus
              className="w-full px-3 py-2.5 border border-[#E8DDD0] rounded-xl text-sm text-[#1C1C1E]
                focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20 resize-none"
            />
            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle size={11} /> {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-sm text-[#8E8878]
              hover:bg-[#F0EBE3] transition-colors font-medium">
            {t('common', 'cancel')}
          </button>
          <button onClick={handleConfirm} disabled={loading || !reason.trim()}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold
              hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2">
            {loading
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : t('misc', 'confirm_cancel')
            }
          </button>
        </div>
      </div>
    </div>
  );
}
