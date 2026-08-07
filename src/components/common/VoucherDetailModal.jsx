// src/components/common/VoucherDetailModal.jsx
// Component xem chi tiết phiếu chi / phiếu thu — dùng chung cho tất cả role.
import { useLang } from '../../context/LangContext';
import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Receipt, TrendingUp, User, Building2, Calendar, Hash } from 'lucide-react';
import { formatVND } from '../../utils/format.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function imgSrc(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE_URL}/api/auth${url}`;
}


function formatDateTime(ts) {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts));
}

function getStatusCfg(t) {
  return {
    CONFIRMED: { label: t('status', 'confirmed'),  cls: 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300' },
    APPROVED:  { label: t('status', 'approved'),   cls: 'bg-emerald-100 dark:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300' },
    PENDING:   { label: t('status', 'pending'),    cls: 'bg-amber-100 dark:bg-amber-500/18 text-amber-700 dark:text-amber-300'    },
    REJECTED:  { label: t('status', 'rejected'),   cls: 'bg-red-100 dark:bg-red-500/18 text-red-600 dark:text-red-300'         },
  };
}

// ── Lightbox nhỏ gọn ────────────────────────────────────────────────────────
function Lightbox({ images, index, onClose }) {
  const [cur, setCur] = useState(index);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  setCur(i => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setCur(i => (i + 1) % images.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
      >
        <X size={20} />
      </button>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
        {cur + 1} / {images.length}
      </div>
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); setCur(i => (i - 1 + images.length) % images.length); }}
          className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <img
        src={imgSrc(images[cur])}
        alt=""
        className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); setCur(i => (i + 1) % images.length); }}
          className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
        >
          <ChevronRight size={22} />
        </button>
      )}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setCur(i); }}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                i === cur ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={imgSrc(url)} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────
/**
 * Props:
 *   voucher  — object phiếu chi hoặc phiếu thu
 *   type     — 'expense' | 'income'
 *   onClose  — callback đóng modal
 */
export default function VoucherDetailModal({ voucher, type = 'expense', onClose }) {
  const { t } = useLang();
  const [lightboxIdx, setLightboxIdx] = useState(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && lightboxIdx === null) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIdx, onClose]);

  if (!voucher) return null;

  const isExpense = type === 'expense';
  const STATUS_CFG = getStatusCfg(t);
  const status    = STATUS_CFG[voucher.status] || STATUS_CFG.CONFIRMED;
  const images    = voucher.imageUrls || [];
  const items     = voucher.items     || [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal card */}
        <div
          className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
            <div className="flex items-center gap-2.5">
              {isExpense
                ? <Receipt size={18} className="text-gold" />
                : <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-300" />}
              <div>
                <p className="font-bold text-ink text-sm">
                  {isExpense ? t('voucher', 'expense_title') : t('voucher', 'income_title')}
                </p>
                <p className="font-mono text-xs text-gold">{!isExpense ? (voucher.receiptNumber || voucher.voucherCode) : (voucher.paymentNumber || voucher.voucherCode)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${status.cls}`}>
                {status.label}
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-canvas text-muted transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <User size={14} className="text-muted mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted">{t('voucher', 'creator_label')}</p>
                  <p className="text-sm font-semibold text-ink">{voucher.createdByName || '—'}</p>
                </div>
              </div>

              {isExpense && voucher.requestedByName && (
                <div className="flex items-start gap-2">
                  <User size={14} className="text-muted mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted">{t('voucher', 'requester_label')}</p>
                    <p className="text-sm font-semibold text-ink">{voucher.requestedByName}</p>
                  </div>
                </div>
              )}

              {!isExpense && voucher.payerName && (
                <div className="flex items-start gap-2">
                  <User size={14} className="text-muted mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted">{t('voucher', 'payer_label')}</p>
                    <p className="text-sm font-semibold text-ink">{voucher.payerName}</p>
                  </div>
                </div>
              )}

              {isExpense && voucher.vendorName && (
                <div className="flex items-start gap-2">
                  <Building2 size={14} className="text-muted mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted">{t('voucher', 'vendor_label')}</p>
                    <p className="text-sm font-semibold text-ink">{voucher.vendorName}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Calendar size={14} className="text-muted mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted">{t('voucher', 'created_date')}</p>
                  <p className="text-sm font-semibold text-ink">{formatDateTime(voucher.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Lý do */}
            <div className="bg-canvas rounded-xl px-4 py-3">
              <p className="text-xs text-muted mb-1">{isExpense ? t('voucher', 'expense_reason') : t('voucher', 'income_reason')}</p>
              <p className="text-sm text-ink font-medium">{voucher.reason}</p>
            </div>

            {/* Khoản chi/thu */}
            <div>
              <p className="text-xs font-semibold text-muted uppercase mb-2 flex items-center gap-1.5">
                <Hash size={12} /> {isExpense ? t('voucher', 'expense_items') : t('voucher', 'income_items')}
              </p>
              <div className="space-y-1.5">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between items-start py-2 border-b border-line-soft last:border-0">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm text-ink font-medium">{item.itemName}</p>
                      {item.note && <p className="text-xs text-muted mt-0.5">{item.note}</p>}
                    </div>
                    <p className="text-sm font-bold text-gold flex-shrink-0">
                      {formatVND(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 pt-2 border-t-2 border-line">
                <p className="text-sm font-bold text-ink">{t('voucher', 'total_amount')}</p>
                <p className="text-lg font-bold text-gold">{formatVND(voucher.totalAmount)}</p>
              </div>
            </div>

            {/* Lý do từ chối */}
            {voucher.status === 'REJECTED' && voucher.rejectReason && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-red-500 uppercase mb-1">{t('voucher', 'reject_reason_label')}</p>
                <p className="text-sm text-red-700 dark:text-red-300">{voucher.rejectReason}</p>
              </div>
            )}

            {/* Ảnh chứng từ */}
            {images.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted uppercase mb-2">
                  {t('voucher', 'receipt_images')} ({images.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxIdx(i)}
                      className="w-20 h-20 rounded-xl overflow-hidden border border-line hover:border-gold hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-gold"
                    >
                      <img src={imgSrc(url)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-line-soft flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-canvas hover:bg-surface-2 text-ink text-sm font-semibold transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && images.length > 0 && (
        <Lightbox
          images={images}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}