// src/pages/warehouse/WarehouseOrdersPage.jsx
import { useLang } from '../../context/LangContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import useMinLoading from '../../hooks/useMinLoading.js';
import { warehouseApi, getImageUrl } from '../../api/warehouseApi';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import { useWarehouse } from '../../context/WarehouseContext';
import WarehouseSelector from '../../components/warehouse/WarehouseSelector';
import CancelOrderModal from '../../components/common/CancelOrderModal';
import {
  RefreshCw, Package, Truck, Clock, X,
  ChevronRight, Box, Search, FileText, Ban, UserCircle, Plus, Check, Lock,
} from 'lucide-react';
import api from '../../api/axios';

// ─────────────────────────────────────────────────────────────────────────────
// YÊU CẦU THANH TOÁN TRƯỚC
// Khách hàng được owner cấu hình "bắt buộc thanh toán trước khi giao hàng" →
// kho KHÔNG được bấm "Bắt đầu giao hàng" cho tới khi đơn đã thu đủ tiền.
// BE cũng chặn (OrderServiceImpl.markAsDelivering) — đây là lớp UX phía trước.
// ─────────────────────────────────────────────────────────────────────────────
const fmtVnd = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0));

/** BE trả canDeliver; fallback tự tính cho trường hợp API cũ chưa có field. */
function canDeliverOrder(order) {
  if (order?.canDeliver !== undefined) return !!order.canDeliver;
  if (!order?.requirePrepayment) return true;
  return order.paymentStatus === 'PAID';
}

/** Badge cảnh báo "chưa thanh toán" hiển thị trên card + trong modal. */
function PrepayBadge({ order, compact = false }) {
  if (!order?.requirePrepayment) return null;
  const ok = canDeliverOrder(order);
  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full border
      ${compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}
      ${ok
        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28'
        : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/28'}`}>
      {ok ? <Check size={compact ? 9 : 12} /> : <Lock size={compact ? 9 : 12} />}
      {ok
        ? 'Đã thu đủ'
        : `Chờ thanh toán trước${order.remainingAmount != null ? ` · còn ${fmtVnd(order.remainingAmount)}đ` : ''}`}
    </span>
  );
}

const CANCELLABLE = new Set(['PENDING','CONFIRMED','PREPARING','READY','DELIVERING']);

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function formatQty(n) {
  if (n == null) return '0';
  return parseFloat(Number(n).toFixed(3)).toLocaleString('vi-VN');
}

// ── Driver Picker ─────────────────────────────────────────────────────────────
function DriverPicker({ selectedDrivers, onChange }) {
  const { t } = useLang();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef(null);
  const dropRef  = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api.get(`/api/warehouse/drivers?q=${encodeURIComponent(query)}`)
        .then(r => setResults(r.data?.data || []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  const toggle = (driver) => {
    const exists = selectedDrivers.some(d => d.id === driver.id);
    onChange(exists
      ? selectedDrivers.filter(d => d.id !== driver.id)
      : [...selectedDrivers, driver]
    );
  };

  const createDriver = async () => {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const r = await api.post('/api/warehouse/drivers', { name });
      const d = r.data?.data;
      if (d) { onChange([...selectedDrivers, d]); setQuery(''); }
    } catch (_) {}
    setCreating(false);
  };

  const showCreate = query.trim() && !results.some(r => r.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="space-y-2.5">
      {/* Label */}
      <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
        {t('warehouse','driver_delivery')}
      </p>

      {/* Selected tags */}
      {selectedDrivers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedDrivers.map(d => (
            <span key={d.id}
              className="inline-flex items-center gap-1 text-xs bg-gold/10 text-gold
                border border-gold/30 rounded-full px-2.5 py-1 font-medium">
              <UserCircle size={11} />
              {d.name}
              <button
                onClick={() => toggle(d)}
                className="ml-0.5 hover:text-red-500 transition-colors leading-none"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={dropRef} className="relative">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              type="text"
              {...{placeholder: t("warehouse","add_driver")}}
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-line rounded-lg
                focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/10
                bg-surface placeholder:text-faint"
            />
          </div>
          {showCreate && (
            <button
              onClick={createDriver}
              disabled={creating}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold
                bg-gold text-white hover:bg-gold-strong transition-colors disabled:opacity-60"
            >
              <Plus size={12} />
              Thêm
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface rounded-xl
            border border-line shadow-lg py-1 max-h-40 overflow-y-auto">
            {results.map(d => {
              const sel = selectedDrivers.some(s => s.id === d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => { toggle(d); setQuery(''); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors
                    ${sel
                      ? 'bg-gold/10 text-gold font-semibold'
                      : 'hover:bg-canvas text-ink'
                    }`}
                >
                  <UserCircle size={13} />
                  <span className="flex-1">{d.name}</span>
                  {sel && <Check size={12} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hint */}
      {selectedDrivers.length === 0 && (
        <p className="text-[10px] text-faint italic">
          {t('warehouse','no_selection')}
        </p>
      )}
    </div>
  );
}

// ── Order Detail Modal ────────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose, onDeliver, onCancel, delivering }) {
  if (!order) return null;
  const canCancel = CANCELLABLE.has(order.status);
  const deliverAllowed = canDeliverOrder(order);
  const [drivers, setDrivers] = useState(order.drivers || []);
  const [saving,  setSaving]  = useState(false);
  const toast = useToast?.() || { success: () => {}, error: () => {} };

  const handleSaveDrivers = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/warehouse/orders/${order.id}/drivers`, {
        driverIds: drivers.map(d => d.id),
      });
    } catch (_) {}
    setSaving(false);
  };

  useEffect(() => {
    if (drivers === (order.drivers || [])) return;
    const t = setTimeout(handleSaveDrivers, 600);
    return () => clearTimeout(t);
  }, [drivers]); // eslint-disable-line

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl
        max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft flex-shrink-0">
          <div>
            <p className="font-mono text-sm font-bold text-gold">{order.orderCode}</p>
            <p className="text-xs text-muted mt-0.5">{formatDate(order.createdAt)}</p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Customer info */}
        <div className="px-5 py-3 bg-canvas border-b border-line-soft flex-shrink-0">
          <p className="text-xs font-semibold text-ink">
            {order.customerName || t('customer','retail')}
          </p>
          <p className="text-[10px] text-muted">{order.customerPhone}</p>
          {order.notes && (
            <p className="text-[11px] text-muted mt-1.5 italic">📝 {order.notes}</p>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Driver picker — đồng bộ style với phần còn lại */}
          <div className="bg-canvas rounded-2xl px-4 py-3.5 border border-line-soft">
            <DriverPicker selectedDrivers={drivers} onChange={setDrivers} />
          </div>

          {/* Product list */}
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
            Danh sách sản phẩm cần chuẩn bị
          </p>
          {order.items?.map((item, idx) => (
            <div key={idx} className="bg-canvas rounded-2xl p-3.5 space-y-3 border border-line-soft">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface overflow-hidden shrink-0 border border-line-soft">
                  {item.productImageUrl
                    ? <img src={getImageUrl(item.productImageUrl)} alt={item.productName} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink truncate">{item.productName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {item.saleType === 'BOX'
                      ? <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/28 rounded px-1.5 py-0.5">📦 Thùng</span>
                      : <span className="text-[10px] font-semibold bg-surface-2 text-muted rounded px-1.5 py-0.5">Lẻ</span>}
                  </div>
                </div>
                <div className="shrink-0 w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-gold">x{item.quantity}</span>
                </div>
              </div>
              {item.ingredients?.length > 0 && (
                <div className="border-t border-line pt-2.5 space-y-1.5">
                  <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-2">Nguyên liệu</p>
                  {item.ingredients.map((ing, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                        <span className="text-xs text-ink">{ing.ingredientName}</span>
                      </div>
                      <span className="text-xs font-semibold text-gold">
                        {formatQty(ing.quantityUsed)} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {item.notes && (
                <p className="text-[11px] text-muted italic border-t border-line pt-2">📝 {item.notes}</p>
              )}
            </div>
          ))}
        </div>

        {/* Cảnh báo yêu cầu thanh toán trước */}
        {order.requirePrepayment && !deliverAllowed && (
          <div className="mx-5 mb-3 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28
            flex items-start gap-2 flex-shrink-0">
            <Lock size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-600 dark:text-red-300 leading-relaxed">
              <b>Khách hàng yêu cầu thanh toán trước khi giao hàng.</b><br />
              Đã thu {fmtVnd(order.paidAmount)}đ / {fmtVnd(order.finalAmount)}đ
              {order.remainingAmount > 0 && <> — còn thiếu <b>{fmtVnd(order.remainingAmount)}đ</b></>}.
              Chờ kế toán xác nhận đã thu đủ tiền rồi mới giao được.
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-line-soft flex-shrink-0 flex gap-2">
          {canCancel && (
            <button onClick={() => onCancel(order)}
              className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl
                border border-red-200 dark:border-red-500/28 bg-red-50 dark:bg-red-500/10 text-red-500 font-semibold text-sm
                hover:bg-red-100 dark:bg-red-500/18 active:scale-[0.98] transition-all shrink-0">
              <Ban size={15} /> Hủy đơn
            </button>
          )}
          <button onClick={() => onDeliver(order.id)}
            disabled={delivering || !deliverAllowed}
            title={!deliverAllowed
              ? 'Khách hàng yêu cầu thanh toán trước — đơn chưa thu đủ tiền'
              : ''}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl
              bg-gold text-white font-semibold text-sm
              hover:bg-gold-strong active:scale-[0.98] transition-all
              disabled:opacity-60 disabled:cursor-not-allowed">
            {delivering
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : deliverAllowed ? <Truck size={16} /> : <Lock size={16} />}
            {delivering
              ? 'Đang xử lý...'
              : deliverAllowed ? 'Bắt đầu giao hàng' : 'Chờ khách thanh toán'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onClick, onInvoice, invoiceLoadingId }) {
  const itemCount = order.items?.length || 0;
  return (
    <button onClick={() => onClick(order)}
      className="w-full bg-surface rounded-2xl border border-line-soft p-4
        hover:border-gold hover:shadow-md active:scale-[0.99]
        transition-all text-left group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-mono text-sm font-bold text-gold">{order.orderCode}</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5
              rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/28">
              <Package size={9} /> Đang chuẩn bị
            </span>
            <PrepayBadge order={order} compact />
          </div>
          <p className="text-sm font-semibold text-ink truncate">
            {order.customerName || t('customer','retail')}
          </p>
          <p className="text-[11px] text-muted mt-0.5">{order.customerPhone}</p>
          {order.drivers?.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <UserCircle size={11} className="text-gold" />
              <span className="text-[10px] text-gold font-medium">
                {order.drivers.map(d => d.name).join(', ')}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <Clock size={10} /> {formatDate(order.createdAt)}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <Box size={10} /> {itemCount} sản phẩm
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={e => { e.stopPropagation(); onInvoice && onInvoice(order.id, e); }}
            disabled={!!invoiceLoadingId} title="In hoá đơn PDF"
            className={`p-1.5 rounded-lg border transition-all duration-200
              ${invoiceLoadingId === order.id
                ? 'bg-gold/15 text-gold border-gold/40 cursor-wait'
                : 'bg-gold/10 text-gold border-transparent hover:bg-gold/20 hover:scale-105 active:scale-95'}`}>
            {invoiceLoadingId === order.id
              ? <div className="w-3.5 h-3.5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              : <FileText size={14} />}
          </button>
          <ChevronRight size={16} className="text-faint group-hover:text-gold transition-colors mt-1" />
        </div>
      </div>
      {order.notes && (
        <p className="text-[11px] text-muted italic mt-2 pt-2 border-t border-line-soft truncate">
          📝 {order.notes}
        </p>
      )}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WarehouseOrdersPage() {
  const { t } = useLang();
  const toast = useToast();
  const { user } = useAuth();
  const { activeWarehouseId, activeWarehouseName } = useWarehouse();

  const [orders,           setOrders]           = useState([]);
  const [loading,          setLoading]          = useMinLoading();
  const [selected,         setSelected]         = useState(null);
  const [delivering,       setDelivering]       = useState(false);
  const [search,           setSearch]           = useState('');
  const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
  const [cancelTarget,     setCancelTarget]     = useState(null);
  const [cancelLoading,    setCancelLoading]    = useMinLoading();

  const handleInvoice = async (orderId, e) => {
    if (e) e.stopPropagation();
    if (invoiceLoadingId) return;
    setInvoiceLoadingId(orderId);
    try {
      const res = await warehouseApi.getInvoice(orderId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const a = document.createElement('a'); a.href = url;
        a.download = `hoa-don-${orderId}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } else { window.open(url, '_blank'); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { alert('Không thể tải hoá đơn'); }
    finally { setInvoiceLoadingId(null); }
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.getPreparingOrders(activeWarehouseId);
      setOrders(res.data?.data || []);
    } catch { toast('Không thể tải danh sách đơn hàng', 'error'); }
    finally { setLoading(false); }
  }, [activeWarehouseId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleDeliver = async (orderId) => {
    setDelivering(true);
    try {
      const res = await warehouseApi.markDelivering(orderId);
      if (res?.data?.success === false) { toast(res.data.message || 'Không thể cập nhật', 'error'); return; }
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setSelected(null);
      toast('Đã chuyển sang Đang giao hàng', 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi cập nhật trạng thái', 'error'); }
    finally { setDelivering(false); }
  };

  const handleCancelConfirm = async (reason) => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await warehouseApi.cancelOrder(cancelTarget.id, reason);
      setOrders(prev => prev.filter(o => o.id !== cancelTarget.id));
      setSelected(null);
      setCancelTarget(null);
      toast('Đã hủy đơn hàng thành công', 'success');
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi khi hủy đơn', 'error'); }
    finally { setCancelLoading(false); }
  };

  const filtered = orders.filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.orderCode?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full bg-canvas">
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-surface border-b border-line-soft">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-ink">Đơn cần giao</h1>
            <p className="text-xs text-muted mt-0.5">{orders.length} đơn đang chuẩn bị</p>
          </div>
          <WarehouseSelector compact />
          <button onClick={fetchOrders}
            className="p-2 rounded-xl bg-surface-2 text-muted hover:bg-surface-3 transition-colors">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="text" placeholder="Tìm theo mã đơn, khách hàng..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-line rounded-xl pl-9 pr-4 py-2.5 text-sm bg-surface
              focus:outline-none focus:border-gold" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted gap-3">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center">
              <Package size={28} strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium">
              {search ? 'Không tìm thấy đơn hàng' : 'Không có đơn hàng cần chuẩn bị'}
            </p>
            {!search && activeWarehouseName && (
              <p className="text-xs text-center max-w-[220px] text-muted">
                Kho: <strong>{activeWarehouseName}</strong>
              </p>
            )}
            {!search && (
              <p className="text-xs text-center max-w-[200px]">
                Các đơn hàng trạng thái "Đang chuẩn bị" sẽ xuất hiện ở đây
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => (
              <OrderCard key={order.id} order={order} onClick={setSelected}
                onInvoice={handleInvoice} invoiceLoadingId={invoiceLoadingId} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <OrderDetailModal
          order={selected}
          onClose={() => setSelected(null)}
          onDeliver={handleDeliver}
          onCancel={order => setCancelTarget(order)}
          delivering={delivering}
        />
      )}

      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancelConfirm}
          loading={cancelLoading}
        />
      )}
    </div>
  );
}