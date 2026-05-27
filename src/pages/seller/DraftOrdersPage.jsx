// src/pages/seller/DraftOrdersPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import { draftApi, orderApi } from '../../api/services';
import api from '../../api/axios';
import CustomerSearchModal from '../../components/seller/CustomerSearchModal';
import DateTimePicker from '../../components/ui/DateTimePicker';
import {
  FileText, Trash2, AlertTriangle, RefreshCw, Package, X,
  User, Clock, ShoppingCart,
  Warehouse, Receipt, ArrowRight, Timer,
} from 'lucide-react';

const PRICE_CHANGED_CODE = 950;
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const HOLD_TIMEOUT_MS = 10 * 60 * 1000; // 10 phút

const cartHoldApi = {
  update: (warehouseId, items) =>
    api.post('/api/seller/cart-hold/update', { warehouseId, items }),
  release: () => api.post('/api/seller/cart-hold/release'),
};

function formatPrice(n) {
  if (!n || Number(n) === 0) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n))) + ' đ';
}
function fmt(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + ' đ';
}
function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts), now = new Date();
  const diffMin = Math.floor((now - d) / 60000), diffH = Math.floor(diffMin / 60);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffH < 24) return `${diffH} giờ trước`;
  return d.toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
const pad = (n) => String(n).padStart(2,'0');
const toInputDatetime = (d) => {
  const yyyy = d.getFullYear(), mo = pad(d.getMonth()+1), dd = pad(d.getDate()),
        hh = pad(d.getHours()), mm = pad(d.getMinutes());
  return `${yyyy}-${mo}-${dd}T${hh}:${mm}`;
};

// ─── Countdown timer ─────────────────────────────────────────────────────────
function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!expiresAt) { setRemaining(null); return; }
    const tick = () => {
      const left = expiresAt - Date.now();
      setRemaining(left > 0 ? left : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (remaining === null) return null;
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return `${pad(m)}:${pad(s)}`;
}

// ─── Warning modal ────────────────────────────────────────────────────────────
function WarningModal({ open, type, items, onClose }) {
  if (!open) return null;
  const isStock = type === 'stock';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`px-5 py-4 flex items-center gap-3 border-b ${isStock ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isStock ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle size={16} className={isStock ? 'text-red-500' : 'text-amber-500'} />
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-sm ${isStock ? 'text-red-700' : 'text-amber-700'}`}>
              {isStock ? 'Không đủ tồn kho' : 'Giá sản phẩm thay đổi'}
            </h3>
            <p className={`text-xs mt-0.5 ${isStock ? 'text-red-500' : 'text-amber-500'}`}>
              {isStock ? 'Cần điều chỉnh đơn nháp' : 'Xem lại giá trước khi đặt'}
            </p>
          </div>
          <button onClick={onClose} className={`${isStock ? 'text-red-400 hover:text-red-600' : 'text-amber-400 hover:text-amber-600'} transition-colors`}>
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 max-h-64 overflow-y-auto">
          {items.map((item, idx) => (
            <div key={idx} className={`rounded-xl border p-3 ${isStock ? 'border-red-100 bg-red-50/40' : 'border-amber-100 bg-amber-50/40'}`}>
              <p className={`font-semibold text-sm ${isStock ? 'text-red-700' : 'text-amber-700'}`}>
                {isStock ? item.ingredientName : item.productName}
              </p>
              {isStock ? (
                <div className="flex gap-4 mt-1">
                  <span className="text-xs text-red-400">Cần: <b className="text-red-600">{Number(item.needed).toFixed(2)}</b></span>
                  <span className="text-xs text-red-400">Còn: <b className="text-red-600">{Number(item.available).toFixed(2)}</b></span>
                </div>
              ) : (
                <div className="flex gap-4 mt-1">
                  <span className="text-xs text-amber-500">Cũ: <b>{fmt(item.oldPrice)}</b></span>
                  <span className="text-xs text-amber-500">Mới: <b>{fmt(item.newPrice)}</b></span>
                </div>
              )}
              {isStock && item.affectedProducts?.length > 0 && (
                <p className="text-[11px] text-[#8E8878] mt-1">Ảnh hưởng: {item.affectedProducts.join(', ')}</p>
              )}
            </div>
          ))}
        </div>
        <div className="px-5 pb-4">
          <button onClick={onClose}
            className={`w-full py-2.5 rounded-xl text-white font-semibold text-sm transition-colors ${isStock ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order info modal (with customer select) ──────────────────────────────────
function OrderInfoModal({ open, draft, onClose, onConfirm }) {
  const now = new Date();
  const defaultDelivery = (() => {
    const d = new Date(now); d.setSeconds(0,0); d.setHours(d.getHours()+1); d.setMinutes(0); return d;
  })();

  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date(); d.setHours(d.getHours()+1, 0, 0, 0); return d;
  });
  const [orderedBy, setOrderedBy] = useState('');
  const [showPrices, setShowPrices] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOrderedBy(draft?.orderedByName || '');
    setDeliveryDate(draft?.deliveryDatetime
      ? new Date(draft.deliveryDatetime)
      : (() => { const d = new Date(); d.setHours(d.getHours()+1, 0, 0, 0); return d; })());
    if (draft?.customerId) {
      setCustomer({ id: draft.customerId, name: draft.customerName, phone: draft.customerPhone, contactName: draft.customerName });
    } else {
      setCustomer(null);
    }
  }, [open, draft]);

  if (!open) return null;

  const handleConfirm = () => {
    const ts = deliveryDate ? deliveryDate.getTime() : null;
    onConfirm(ts, orderedBy.trim() || null, showPrices, customer);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#C9A84C] to-[#b8963d] px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Xác nhận đặt hàng</p>
              <h3 className="text-white font-bold text-base mt-0.5">Thông tin giao hàng</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
              <X size={15} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Customer select */}
            <div>
              <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">👤 Khách hàng</label>
              {customer ? (
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[#C9A84C]/40 bg-[#FDF8ED]">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#1C1C1E] truncate">{customer.contactName || customer.name}</p>
                    {customer.phone && <p className="text-xs text-[#8E8878]">{customer.phone}</p>}
                  </div>
                  <button onClick={() => setCustomer(null)} className="text-[#C4B9A8] hover:text-red-400 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setCustomerModalOpen(true)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl border-2 border-dashed border-[#E8DDD0] text-[#8E8878] text-sm hover:border-[#C9A84C] hover:text-[#C9A84C] transition-all">
                  <User size={14} /> Chọn khách hàng (tuỳ chọn)
                </button>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">✍️ Tên người đặt hàng</label>
              <input type="text" value={orderedBy} onChange={e => setOrderedBy(e.target.value)}
                placeholder="Nhập tên người đặt..."
                className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C] transition-colors bg-[#FAFAF8] placeholder:text-[#C4B9A8]" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">🕐 Ngày & giờ giao hàng</label>
              <DateTimePicker
                value={deliveryDate}
                onChange={setDeliveryDate}
                minDate={new Date()}
                placeholder="Chọn ngày & giờ giao hàng"
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div onClick={() => setShowPrices(v => !v)}
                className={`w-9 h-5 rounded-full relative flex-shrink-0 transition-colors ${showPrices ? 'bg-[#C9A84C]' : 'bg-[#D0C9BE]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${showPrices ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-sm text-[#5C4E3D]">Hiển thị giá trên hóa đơn</span>
            </label>
          </div>

          <div className="px-5 pb-5">
            <button onClick={handleConfirm}
              className="w-full py-3 rounded-xl bg-[#C9A84C] text-white font-bold text-sm hover:bg-[#b8963d] transition-colors flex items-center justify-center gap-2">
              <Receipt size={15} /> Xác nhận đặt hàng
            </button>
          </div>
        </div>
      </div>

      {customerModalOpen && (
        <CustomerSearchModal
          open={customerModalOpen}
          onClose={() => setCustomerModalOpen(false)}
          onSelect={(c) => { setCustomer(c); setCustomerModalOpen(false); }}
        />
      )}
    </>
  );
}

// ─── Hold timeout overlay (shown when draft is being transferred to POS) ──────
function HoldOverlay({ draftId, expiresAt, onExpired, onCancel }) {
  const countdown = useCountdown(expiresAt);
  const isExpired = countdown === '00:00';

  useEffect(() => {
    if (isExpired) onExpired?.();
  }, [isExpired]);

  if (!expiresAt) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center overflow-hidden">
        <div className="bg-gradient-to-r from-[#C9A84C] to-[#b8963d] px-5 py-5">
          <Timer size={28} className="text-white mx-auto mb-2" />
          <p className="text-white font-bold text-lg">Đang giữ tồn kho</p>
          <p className="text-white/70 text-xs mt-1">Chuyển sang trang bán hàng để xử lý đơn</p>
        </div>
        <div className="px-5 py-6">
          <div className="text-5xl font-bold text-[#C9A84C] font-mono mb-2">{countdown}</div>
          <p className="text-sm text-[#8E8878] mb-5">Tồn kho sẽ được giải phóng khi hết giờ</p>
          <button onClick={onCancel}
            className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors">
            Hủy & Giải phóng tồn kho
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Draft table row ──────────────────────────────────────────────────────────
function DraftRow({ draft, onDelete, onContinue, onOrder, processingId, orderingId, expandedId, onToggle }) {
  const expanded = expandedId === draft.id;
  const items = draft.items || [];
  const totalSubtotal = items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const hasCustomer = !!draft.customerName;
  const isProcessing = processingId === draft.id;
  const isOrdering = orderingId === draft.id;
  const busy = isProcessing || isOrdering;

  return (
    <>
      <tr className="border-b border-[#F0EBE3] hover:bg-[#FAFAF8] transition-colors cursor-pointer select-none" onClick={() => onToggle(draft.id)}>
        {/* Mã nháp */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-[#C9A84C]">{draft.draftCode}</span>
            <span className="text-[10px] text-[#B0A090] flex items-center gap-0.5">
              <Clock size={10} />{formatDate(draft.updatedAt)}
            </span>
          </div>
        </td>

        {/* Khách hàng */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <User size={13} className={hasCustomer ? 'text-[#C9A84C]' : 'text-[#C4B9A8]'} />
            <span className={`text-sm truncate max-w-[140px] ${hasCustomer ? 'font-semibold text-[#1C1C1E]' : 'text-[#C4B9A8] italic text-xs'}`}>
              {hasCustomer ? draft.customerName : 'Chưa chọn'}
            </span>
          </div>
          {draft.customerPhone && <p className="text-[11px] text-[#8E8878] ml-5">{draft.customerPhone}</p>}
        </td>

        {/* Kho */}
        <td className="px-4 py-3">
          {draft.warehouseName
            ? <span className="text-xs text-[#5C4E3D] flex items-center gap-1"><Warehouse size={11} className="text-[#8E8878]" />{draft.warehouseName}</span>
            : <span className="text-xs text-[#C4B9A8]">—</span>}
        </td>

        {/* Sản phẩm + Tổng */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#5C4E3D] font-medium">{items.length} món</span>
            {totalSubtotal > 0 && (
              <span className="text-xs font-bold text-[#C9A84C]">{formatPrice(totalSubtotal)}</span>
            )}
          </div>
          {(draft.discountRate > 0 || Number(draft.discountAmount) > 0) && (
            <p className="text-[11px] text-emerald-600 mt-0.5">
              {draft.discountRate > 0 ? `Giảm ${draft.discountRate}%` : `Giảm ${formatPrice(draft.discountAmount)}`}
            </p>
          )}
        </td>

        {/* Thao tác */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); onContinue(draft); }} disabled={busy}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F0EBE3] text-[#5C4E3D] text-xs font-semibold hover:bg-[#E8DDD0] transition-colors disabled:opacity-50"
              title="Tiếp tục xử lý trên trang bán hàng">
              {isProcessing ? <div className="w-3 h-3 border-2 border-[#5C4E3D] border-t-transparent rounded-full animate-spin" /> : <ArrowRight size={12} />}
              Tiếp tục
            </button>
            <button onClick={(e) => { e.stopPropagation(); onOrder(draft); }} disabled={busy}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#C9A84C] text-white text-xs font-bold hover:bg-[#b8973d] transition-colors disabled:opacity-50 shadow-sm"
              title="Đặt hàng trực tiếp từ đơn nháp">
              {isOrdering ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Receipt size={12} />}
              Đặt hàng
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(draft.id); }} disabled={busy}
              className="p-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50" title="Xóa">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded items */}
      {expanded && items.length > 0 && (
        <tr className="bg-[#FAFAF8] border-b border-[#F0EBE3]">
          <td colSpan={5} className="px-6 py-3">
            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs text-[#5C4E3D]">
                  {item.productImageUrl
                    ? <img src={item.productImageUrl} alt={item.productName} className="w-7 h-7 rounded-lg object-cover shrink-0 border border-[#F0EBE3]" />
                    : <div className="w-7 h-7 rounded-lg bg-[#F0EBE3] shrink-0" />}
                  <span className="flex-1 font-medium truncate">{item.productName}</span>
                  <span className="text-[#8E8878]">SL: {item.quantity} {item.unit}</span>
                  <span className="text-[#8E8878]">{new Intl.NumberFormat('vi-VN').format(Math.round(item.unitPrice||0))} đ/{item.unit}</span>
                  <span className="font-bold text-[#1C1C1E]">{formatPrice(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DraftOrdersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null); // "Tiếp tục" → POS
  const [orderingId, setOrderingId] = useState(null);     // "Đặt hàng" trực tiếp
  const [expandedId, setExpandedId] = useState(null);     // Row đang expand

  const handleToggle = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  // Hold overlay state (when draft transferred to POS, hold for 10min)
  const [holdState, setHoldState] = useState(null); // { draftId, expiresAt, draft }

  const [warning, setWarning] = useState({ open: false, type: 'stock', items: [] });
  const [orderInfoModal, setOrderInfoModal] = useState({ open: false, draft: null });

  // WS for realtime stock update after direct order
  const wsRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await draftApi.getAll();
      setDrafts(res.data?.data || res.data || []);
    } catch { toast('Không thể tải danh sách đơn nháp', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Connect WS for stock updates (so POSPage gets realtime update)
  const connectWs = useCallback((warehouseId) => {
    if (!warehouseId) return;
    const loadAndConnect = async () => {
      if (!window.SockJS) await new Promise(res => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.6.1/sockjs.min.js'; s.onload = res; document.head.appendChild(s); });
      if (!window.Stomp) await new Promise(res => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js'; s.onload = res; document.head.appendChild(s); });
      const token = localStorage.getItem('token');
      const sock = new window.SockJS(`${BASE_URL}/ws`);
      const client = window.Stomp.over(sock);
      client.debug = null;
      client.connect({ Authorization: `Bearer ${token}` }, () => { wsRef.current = client; });
    };
    loadAndConnect();
  }, []);

  useEffect(() => {
    return () => { try { wsRef.current?.disconnect?.(); } catch (_) {} };
  }, []);

  const handleDelete = async (draftId) => {
    if (!window.confirm('Xóa đơn nháp này?')) return;
    try {
      await draftApi.delete(draftId);
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      toast('Đã xóa đơn nháp', 'success');
    } catch { toast('Không thể xóa đơn nháp', 'error'); }
  };

  // ── "Tiếp tục" → kiểm tra kho → hold → navigate POS với countdown ─────────
  const handleContinue = async (draft) => {
    setProcessingId(draft.id);
    try {
      // 1. Kiểm tra tồn kho
      const stockRes = await draftApi.checkStock(draft.id);
      const stockBody = stockRes.data?.data || stockRes.data;
      if (!stockBody?.sufficient) {
        setWarning({ open: true, type: 'stock', items: stockBody?.outOfStockItems || [] });
        return;
      }

      // 2. Hold tồn kho (gọi cartHold update với items từ draft)
      if (draft.warehouseId && draft.items?.length > 0) {
        // Lấy ingredient data từ products để tính hold
        // Đơn giản: dùng API hold với productId+qty
        // Backend cart-hold/update nhận warehouseId + items([ingredientId, qty])
        // Gọi trực tiếp với items placeholder — backend tự resolve từ productId nếu cần
        // Vì không có ingredient map ở đây, dùng workaround: navigate trước, POSPage tự hold
        const expiresAt = Date.now() + HOLD_TIMEOUT_MS;
        connectWs(draft.warehouseId);

        // Show hold overlay briefly then navigate
        // Navigate to POS with draft state — POSPage sẽ tự load cart và hold
        navigate('/seller/pos', {
          state: {
            draft,
            fromDraftHold: true,
            expiresAt,
          },
        });
      } else {
        navigate('/seller/pos', { state: { draft } });
      }
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi kiểm tra tồn kho', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // ── "Đặt hàng" trực tiếp ──────────────────────────────────────────────────
  const handleOrder = async (draft) => {
    // Check stock first
    setOrderingId(draft.id);
    try {
      const stockRes = await draftApi.checkStock(draft.id);
      const stockBody = stockRes.data?.data || stockRes.data;
      if (!stockBody?.sufficient) {
        setWarning({ open: true, type: 'stock', items: stockBody?.outOfStockItems || [] });
        setOrderingId(null);
        return;
      }
    } catch (e) {
      toast(e?.response?.data?.message || 'Lỗi kiểm tra tồn kho', 'error');
      setOrderingId(null);
      return;
    }
    setOrderingId(null);

    // Nếu thiếu thông tin → mở modal
    const needsInfo = !draft.orderedByName || !draft.deliveryDatetime;
    if (needsInfo || !draft.customerId) {
      setOrderInfoModal({ open: true, draft });
    } else {
      await submitOrder(draft, draft.deliveryDatetime, draft.orderedByName, draft.showPrices ?? true, null);
    }
  };

  const submitOrder = async (draft, deliveryDatetime, orderedByName, showPrices, selectedCustomer) => {
    setOrderingId(draft.id);
    try {
      // Re-check stock at time of order
      const stockRes = await draftApi.checkStock(draft.id);
      const stockBody = stockRes.data?.data || stockRes.data;
      if (!stockBody?.sufficient) {
        setWarning({ open: true, type: 'stock', items: stockBody?.outOfStockItems || [] });
        setOrderInfoModal({ open: false, draft: null });
        return;
      }

      const effectiveCustomer = selectedCustomer || (draft.customerId ? { id: draft.customerId, name: draft.customerName, phone: draft.customerPhone } : null);

      const payload = {
        customerId: effectiveCustomer?.id || null,
        customerName: effectiveCustomer?.contactName || effectiveCustomer?.name || draft.customerName || null,
        customerPhone: effectiveCustomer?.selectedReceiver?.receiverPhone || effectiveCustomer?.phone || draft.customerPhone || null,
        shippingAddress: effectiveCustomer?.selectedReceiver?.receiverAddress || draft.shippingAddress || draft.receiverAddress || '',
        receiverName: effectiveCustomer?.selectedReceiver?.receiverName || effectiveCustomer?.contactName || effectiveCustomer?.name || draft.receiverName || draft.customerName || null,
        receiverPhone: effectiveCustomer?.selectedReceiver?.receiverPhone || effectiveCustomer?.phone || draft.receiverPhone || draft.customerPhone || null,
        receiverAddress: effectiveCustomer?.selectedReceiver?.receiverAddress || draft.receiverAddress || draft.shippingAddress || '',
        notes: draft.notes,
        paymentMethod: draft.paymentMethod || 'CASH',
        discountRate: draft.discountRate || 0,
        discountAmount: Number(draft.discountAmount) > 0 ? draft.discountAmount : undefined,
        surcharge: draft.surcharge || 0,
        warehouseId: draft.warehouseId,
        deliveryDatetime: deliveryDatetime ?? null,
        orderedByName: orderedByName || undefined,
        showPrices,
        items: (draft.items || []).map(i => ({
          productId: i.productId,
          tierId: i.isPromo ? undefined : i.tierId,
          quantity: i.quantity,
          sentUnitPrice: i.isPromo ? 0 : ((i.saleType === 'BOX' && i.unitsPerBox > 0) ? i.unitPrice / i.unitsPerBox : i.unitPrice),
          priceMode: i.isPromo ? 'BASE' : ((i.itemDiscountRate > 0) ? 'DISCOUNT_PERCENT' : (i.priceMode || 'BASE')),
          discountPercent: (!i.isPromo && i.itemDiscountRate > 0) ? i.itemDiscountRate : undefined,
          isManualPrice: i.isManualPrice === true,
          saleType: i.saleType || 'RETAIL',
          notes: i.isPromo ? `[KM]${i.promoNote ? ' ' + i.promoNote : ''}` : (i.notes || undefined),
        })),
      };

      const res = await orderApi.create(payload);
      const body = res.data;

      if (body?.code === PRICE_CHANGED_CODE) {
        setWarning({ open: true, type: 'price', items: [{ productName: body.message, oldPrice: 0, newPrice: 0 }] });
        return;
      }
      if (!body?.success) { toast(body?.message || 'Lỗi khi tạo đơn hàng', 'error'); return; }

      // Đặt thành công → xóa draft, WS sẽ broadcast stock update đến POSPage
      await draftApi.delete(draft.id).catch(() => {});
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
      toast(`Đặt hàng thành công: ${body?.data?.orderCode || ''}`, 'success');
      setOrderInfoModal({ open: false, draft: null });
    } catch (err) {
      const body = err?.response?.data;
      if (body?.code === PRICE_CHANGED_CODE) {
        setWarning({ open: true, type: 'price', items: [{ productName: body.message, oldPrice: 0, newPrice: 0 }] });
        return;
      }
      toast(body?.message || err?.message || 'Lỗi khi đặt hàng', 'error');
    } finally {
      setOrderingId(null);
    }
  };

  const handleHoldExpired = async () => {
    if (!holdState) return;
    await cartHoldApi.release().catch(() => {});
    setHoldState(null);
    toast('Hết giờ giữ tồn kho. Đơn nháp vẫn được lưu.', 'warning');
  };

  const handleHoldCancel = async () => {
    await cartHoldApi.release().catch(() => {});
    setHoldState(null);
    toast('Đã hủy giữ tồn kho', 'info');
  };

  const totalItems = drafts.reduce((s, d) => s + (d.items?.length || 0), 0);

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <div className="bg-white border-b border-[#F0EBE3] px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FDF8ED] border border-[#C9A84C]/20 flex items-center justify-center">
            <FileText size={16} className="text-[#C9A84C]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1C1C1E]">Đơn nháp</h1>
            {drafts.length > 0 && (
              <p className="text-[11px] text-[#8E8878]">{drafts.length} đơn · {totalItems} sản phẩm</p>
            )}
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="w-9 h-9 rounded-xl border border-[#E8DDD0] flex items-center justify-center text-[#8E8878] hover:bg-[#F0EBE3] transition-colors">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden">
            {[1,2,3,4].map(i => (
              <div key={i} className="px-4 py-3 border-b border-[#F8F4EE] last:border-0 flex gap-4">
                <div className="h-4 w-24 bg-[#F0EBE3] rounded animate-pulse" />
                <div className="h-4 w-32 bg-[#F0EBE3] rounded animate-pulse" />
                <div className="h-4 w-20 bg-[#F0EBE3] rounded animate-pulse" />
                <div className="h-4 w-28 bg-[#F0EBE3] rounded animate-pulse flex-1" />
                <div className="h-7 w-40 bg-[#F0EBE3] rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F0EBE3] flex items-center justify-center mb-4">
              <Package size={28} className="text-[#C4B9A8]" strokeWidth={1.5} />
            </div>
            <p className="text-base font-semibold text-[#5C4E3D] mb-1">Chưa có đơn nháp</p>
            <p className="text-sm text-[#B0A090] mb-6 max-w-xs">Lưu đơn nháp từ trang bán hàng để tiếp tục xử lý sau</p>
            <button onClick={() => navigate('/seller/pos')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#b8973d] transition-colors shadow-sm">
              <ShoppingCart size={15} /> Đi đến bán hàng
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#F0EBE3] overflow-hidden shadow-sm">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-[#F0EBE3] bg-[#FAFAF8]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8E8878] uppercase tracking-wider w-[200px]">Mã nháp</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8E8878] uppercase tracking-wider w-[220px]">Khách hàng</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8E8878] uppercase tracking-wider w-[160px]">Kho</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8E8878] uppercase tracking-wider">Sản phẩm / Tổng</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8E8878] uppercase tracking-wider w-[260px]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map(draft => (
                  <DraftRow
                    key={draft.id}
                    draft={draft}
                    onDelete={handleDelete}
                    onContinue={handleContinue}
                    onOrder={handleOrder}
                    processingId={processingId}
                    orderingId={orderingId}
                    expandedId={expandedId}
                    onToggle={handleToggle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <WarningModal
        open={warning.open}
        type={warning.type}
        items={warning.items}
        onClose={() => setWarning({ open: false, type: 'stock', items: [] })}
      />

      <OrderInfoModal
        open={orderInfoModal.open}
        draft={orderInfoModal.draft}
        onClose={() => setOrderInfoModal({ open: false, draft: null })}
        onConfirm={(ts, name, show, customer) =>
          submitOrder(orderInfoModal.draft, ts, name, show, customer)}
      />

      {holdState && (
        <HoldOverlay
          draftId={holdState.draftId}
          expiresAt={holdState.expiresAt}
          onExpired={handleHoldExpired}
          onCancel={handleHoldCancel}
        />
      )}
    </div>
  );
}