import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Trash2, ShoppingCart, FileText, Calendar,
  User, Package, AlertTriangle, ChevronRight, Save,
} from 'lucide-react';
import { draftApi, orderApi } from '../../api/services';
import { useToast } from '../../components/common/Toast';
import ScheduledOrderModal from '../../components/seller/ScheduledOrderModal';

// ── Countdown hook ────────────────────────────────────────────────────────
function useCountdowns(drafts) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const hasScheduled = drafts.some(d => d.type === 'SCHEDULED' && d.scheduledAt);
    if (!hasScheduled) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [drafts]);
  return now;
}

// ── Countdown display ──────────────────────────────────────────────────────
function CountdownBadge({ scheduledAt, now }) {
  if (!scheduledAt) return null;
  const diffMs   = scheduledAt - now;
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
  const hours    = Math.floor(diffSecs / 3600);
  const mins     = Math.floor((diffSecs % 3600) / 60);
  const secs     = diffSecs % 60;

  const isExpired  = diffMs <= 0;
  const isCritical = !isExpired && diffMs < 15 * 60 * 1000;     // < 15 phút
  const isWarning  = !isExpired && !isCritical && diffMs < 60 * 60 * 1000; // < 1 giờ

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                       bg-gray-100 text-gray-400 border border-gray-200">
        <Clock size={10} /> Đã hết giờ
      </span>
    );
  }

  const timeStr = hours > 0
    ? `${hours}h ${String(mins).padStart(2,'0')}m`
    : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

  if (isCritical) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                       bg-red-100 text-red-600 border border-red-300 animate-pulse">
        <AlertTriangle size={10} /> {timeStr}
      </span>
    );
  }
  if (isWarning) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                       bg-amber-100 text-amber-600 border border-amber-300">
        <Clock size={10} /> {timeStr}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                     bg-blue-50 text-blue-600 border border-blue-200">
      <Clock size={10} /> {timeStr}
    </span>
  );
}

// ── Card border / bg theo urgency ─────────────────────────────────────────
function getScheduledStyle(scheduledAt, now) {
  if (!scheduledAt) return '';
  const diffMs = scheduledAt - now;
  if (diffMs <= 0)                   return 'border-gray-200 bg-gray-50/50';
  if (diffMs < 15 * 60 * 1000)      return 'border-red-300 bg-red-50/40 shadow-red-100';
  if (diffMs < 60 * 60 * 1000)      return 'border-amber-300 bg-amber-50/40 shadow-amber-100';
  return 'border-amber-200 bg-amber-50/20';
}

// ── Format date ───────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function fmtPrice(n) {
  return new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';
}

function calcDraftTotal(draft) {
  if (!draft.items?.length) return 0;
  const subtotal = draft.items
    .filter(i => !i.isPromo)
    .reduce((s, i) => s + Number(i.unitPrice || 0) * Number(i.quantity || 0), 0);
  const discAmt = Number(draft.discountAmount || 0) > 0
    ? Number(draft.discountAmount)
    : subtotal * (Number(draft.discountRate || 0) / 100);
  const surcharge = Number(draft.surcharge || 0);
  return Math.max(0, subtotal - discAmt + surcharge);
}

// ══════════════════════════════════════════════════════════════════════════
export default function DraftsPage() {
  const toast    = useToast();
  const navigate = useNavigate();

  const [drafts, setDrafts]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [deletingId, setDeletingId]   = useState(null);
  const [scheduledModal, setScheduledModal] = useState(null); // draft object
  const [previewLoading, setPreviewLoading] = useState(false);

  const now = useCountdowns(drafts);

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await draftApi.getAll();
      setDrafts(res.data?.data || []);
    } catch {
      toast('Không thể tải đơn nháp', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const handleDelete = async (id) => {
    if (!confirm('Xóa đơn nháp này?')) return;
    setDeletingId(id);
    try {
      await draftApi.delete(id);
      setDrafts(prev => prev.filter(d => d.id !== id));
      toast('Đã xóa đơn nháp', 'success');
    } catch {
      toast('Lỗi khi xóa đơn nháp', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoadToPOS = (draft) => {
    navigate('/seller/pos', { state: { draft } });
  };

  // Tạo phiếu từ draft (mở PDF tab mới)
  const handlePreviewInvoice = async (draftId) => {
    setPreviewLoading(true);
    try {
      const token = localStorage.getItem('token');
      const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
      const res = await fetch(`${BASE_URL}/api/seller/drafts/${draftId}/invoice`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Lỗi tạo phiếu');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast('Lỗi khi tạo phiếu đặt hàng', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Xác nhận tạo đơn thật từ SCHEDULED
  const handleConfirmScheduled = async (draft, opts) => {
    try {
      const payload = {
        customerId:       draft.customerId,
        customerName:     draft.customerName,
        customerPhone:    draft.customerPhone,
        shippingAddress:  draft.shippingAddress,
        receiverName:     opts.receiverName || draft.receiverName,
        receiverPhone:    draft.receiverPhone,
        receiverAddress:  draft.receiverAddress,
        notes:            draft.notes,
        paymentMethod:    opts.paymentMethod,
        discountRate:     draft.discountAmount ? 0 : draft.discountRate,
        discountAmount:   draft.discountAmount || undefined,
        surchargeItems:   draft.surchargeItems?.filter(i => Number(i.amount) > 0) || [],
        warehouseId:      draft.warehouseId,
        deliveryDatetime: draft.scheduledAt,    // ← thời gian hẹn = giao hàng
        orderedByName:    draft.orderedByName,
        showPrices:       opts.showPrices,
        hideAllPrices:    opts.hideAllPrices,
        items: draft.items.map(i => ({
          productId:       i.productId,
          tierId:          (i.isPromo || i.priceMode !== 'TIER') ? undefined : i.tierId,
          quantity:        i.quantity,
          sentUnitPrice:   i.isPromo ? 0 : (
            i.saleType === 'BOX' && i.unitsPerBox > 0
              ? Number(i.unitPrice) / i.unitsPerBox
              : Number(i.unitPrice)
          ),
          priceMode:       i.isPromo ? 'BASE' : (i.priceMode || 'BASE'),
          discountPercent: (!i.isPromo && (i.itemDiscountRate || 0) > 0) ? i.itemDiscountRate : undefined,
          isManualPrice:   i.isPromo ? true : Boolean(i.isManualPrice),
          saleType:        i.saleType || 'RETAIL',
          notes:           i.isPromo
            ? `[KM]${i.promoNote ? ' ' + i.promoNote : ''}`
            : (i.notes || undefined),
          vatRate:         i.vatRate,
          vatMode:         i.vatMode,
        })),
      };

      const res  = await orderApi.create(payload);
      const body = res.data;
      if (!body?.success) {
        toast(body?.message || 'Lỗi khi tạo đơn hàng', 'error');
        return;
      }

      // Xóa draft sau khi đặt thành công
      await draftApi.delete(draft.id).catch(() => {});
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
      setScheduledModal(null);
      toast(`Tạo đơn thành công: ${body?.data?.orderCode || ''}`, 'success');
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi tạo đơn hàng', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const scheduledDrafts = drafts.filter(d => d.type === 'SCHEDULED');
  const normalDrafts    = drafts.filter(d => d.type !== 'SCHEDULED');

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1C1C1E]">Đơn nháp</h1>
        <span className="text-xs text-[#8E8878] bg-[#F0EBE3] px-3 py-1.5 rounded-full">
          {drafts.length} đơn
        </span>
      </div>

      {drafts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-[#C4B9A8] gap-3">
          <Save size={40} strokeWidth={1} />
          <p className="text-sm">Chưa có đơn nháp nào</p>
        </div>
      )}

      {/* ── Đơn hẹn giờ ───────────────────────────────────────────────────── */}
      {scheduledDrafts.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Clock size={12} className="text-amber-500" /> Đơn hẹn giờ ({scheduledDrafts.length})
          </h2>
          <div className="space-y-3">
            {scheduledDrafts.map(draft => {
              const style = getScheduledStyle(draft.scheduledAt, now);
              return (
                <div key={draft.id}
                  className={`rounded-2xl border-2 shadow-sm p-4 transition-all ${style}`}>
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-[#1C1C1E]">{draft.draftCode}</span>
                        <CountdownBadge scheduledAt={draft.scheduledAt} now={now} />
                      </div>
                      <p className="text-[10px] text-[#8E8878] mt-0.5">
                        Hẹn: {fmtDate(draft.scheduledAt)}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(draft.id)} disabled={deletingId === draft.id}
                      className="text-[#C4B9A8] hover:text-red-400 shrink-0 p-1">
                      {deletingId === draft.id
                        ? <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>

                  {/* Khách hàng */}
                  {draft.customerName && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <User size={11} className="text-[#8E8878] shrink-0" />
                      <span className="text-xs text-[#5C4E3D] font-medium truncate">
                        {draft.customerName}
                        {draft.customerPhone && <span className="text-[#8E8878]"> · {draft.customerPhone}</span>}
                      </span>
                    </div>
                  )}

                  {/* Items */}
                  <div className="text-[11px] text-[#8E8878] mb-2">
                    {draft.items?.length > 0 && (
                      <span>{draft.items.length} món · {fmtPrice(calcDraftTotal(draft))}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handlePreviewInvoice(draft.id)}
                      disabled={previewLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                                 border border-[#E8DDD0] text-[#5C4E3D] text-[11px] font-semibold
                                 hover:bg-[#F0EBE3] disabled:opacity-40 transition-colors"
                    >
                      <FileText size={12} /> Phiếu đặt hàng
                    </button>
                    <button
                      onClick={() => setScheduledModal(draft)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                                 bg-[#C9A84C] text-white text-[11px] font-bold hover:bg-[#b8963d] transition-colors"
                    >
                      <ChevronRight size={12} /> Tạo đơn hàng
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Đơn nháp thường ───────────────────────────────────────────────── */}
      {normalDrafts.length > 0 && (
        <section>
          {scheduledDrafts.length > 0 && (
            <h2 className="text-xs font-bold text-[#8E8878] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Save size={12} /> Đơn nháp ({normalDrafts.length})
            </h2>
          )}
          <div className="space-y-3">
            {normalDrafts.map(draft => (
              <div key={draft.id}
                className="rounded-2xl border border-[#E8DDD0] bg-white shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-xs font-bold text-[#1C1C1E]">{draft.draftCode}</p>
                    <p className="text-[10px] text-[#8E8878]">{fmtDate(draft.updatedAt)}</p>
                  </div>
                  <button onClick={() => handleDelete(draft.id)} disabled={deletingId === draft.id}
                    className="text-[#C4B9A8] hover:text-red-400 p-1">
                    {deletingId === draft.id
                      ? <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                </div>

                {draft.customerName && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <User size={11} className="text-[#8E8878] shrink-0" />
                    <span className="text-xs text-[#5C4E3D] truncate">{draft.customerName}</span>
                  </div>
                )}

                <div className="text-[11px] text-[#8E8878] mb-3">
                  {draft.items?.length > 0 && (
                    <span>{draft.items.length} món · {fmtPrice(calcDraftTotal(draft))}</span>
                  )}
                </div>

                <button
                  onClick={() => handleLoadToPOS(draft)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl
                             border border-[#C9A84C] text-[#C9A84C] text-xs font-semibold
                             hover:bg-[#FDF8ED] transition-colors"
                >
                  <ShoppingCart size={13} /> Mở trong POS
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal xác nhận đơn SCHEDULED */}
      {scheduledModal && (
        <ScheduledOrderModal
          draft={scheduledModal}
          onClose={() => setScheduledModal(null)}
          onConfirm={(opts) => handleConfirmScheduled(scheduledModal, opts)}
          onPreviewInvoice={handlePreviewInvoice}
          previewLoading={previewLoading}
        />
      )}
    </div>
  );
}