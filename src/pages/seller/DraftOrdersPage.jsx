// src/pages/seller/DraftOrdersPage.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import { receiverMissingRegion, MISSING_REGION_MESSAGE } from '../../utils/receiverRegion';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { draftApi, orderApi, productApi, categoryApi, warehouseApi } from '../../api/services';
import api from '../../api/axios';
import CustomerSearchModal from '../../components/seller/CustomerSearchModal';
import DateTimePicker from '../../components/ui/DateTimePicker';
import CartItem from '../../components/seller/CartItem';
import SaleTypeModal from '../../components/seller/SaleTypeModal';
import {
  FileText, Trash2, AlertTriangle, RefreshCw, Package, X,
  User, Clock, ShoppingCart,
  Warehouse, Receipt, ArrowRight, Timer, FileDown,
  Edit3, Search, ChevronDown, Plus, Save, PackageX,
  AlertCircle, RefreshCcw, Check,
  FileTextIcon
} from 'lucide-react';

const PRICE_CHANGED_CODE = 950;
const STOCK_ERROR_CODE = 947;
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const HOLD_TIMEOUT_MS = 10 * 60 * 1000;

let editCartIdCounter = 0;
const newEditCartId = () => ++editCartIdCounter;

const cartHoldApi = {
  update: (warehouseId, items) => api.post('/api/seller/cart-hold/update', { warehouseId, items }),
  release: () => api.post('/api/seller/cart-hold/release'),
};

function formatPrice(n) {
  if (!n || Number(n) === 0) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n))) + ' đ';
}
function fmt(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(n) || 0)) + ' đ';
}
function calcDraftTotal(draft) {
  const items = draft.items || [];

  // Tạm tính = giá gộp (unitPrice × qty, INCLUSIVE VAT đã trong giá)
  const subtotalGross = items.reduce((s, i) => {
    if (i.isPromo) return s;
    return s + Number(i.unitPrice || 0) * Number(i.quantity || 0);
  }, 0);

  const itemDiscountTotal = items.reduce((s, i) => {
    if (i.isPromo || !i.itemDiscountRate) return s;
    return s + Number(i.unitPrice || 0) * Number(i.quantity || 0) * (i.itemDiscountRate / 100);
  }, 0);

  const netAfterItemDiscount = subtotalGross - itemDiscountTotal;

  const discountAmt = Number(draft.discountRate) > 0
    ? Math.round(netAfterItemDiscount * draft.discountRate) / 100
    : (Number(draft.discountAmount) > 0 ? Number(draft.discountAmount) : 0);

  const grossAfterAllDiscount = netAfterItemDiscount - discountAmt;

  // VAT EXCLUSIVE tính thêm ngoài
  const exclusiveVat = items.reduce((s, i) => {
    if (i.isPromo || (i.vatMode ?? 'INCLUSIVE') !== 'EXCLUSIVE' || !i.vatRate) return s;
    const lineGross = Number(i.unitPrice || 0) * Number(i.quantity || 0);
    const proportion = subtotalGross > 0 ? lineGross / subtotalGross : 0;
    const lineGrossAfterDiscount = lineGross - (itemDiscountTotal + discountAmt) * proportion;
    return s + lineGrossAfterDiscount * (i.vatRate / 100);
  }, 0);

  const surcharge = (draft.surchargeItems || []).reduce((s, i) => s + (Number(i.amount) || 0), 0)
    || Number(draft.surcharge || 0);

  return grossAfterAllDiscount + exclusiveVat + surcharge;
}

function formatDate(ts, t) {
  if (!ts) return '—';
  const d = new Date(ts), now = new Date();
  const diffMin = Math.floor((now - d) / 60000), diffH = Math.floor(diffMin / 60);
  if (diffMin < 1) return t('common', 'just_now');
  if (diffMin < 60) return `${diffMin}${t('common', 'minutes_ago')}`;
  if (diffH < 24) return `${diffH}${t('common', 'hours_ago')}`;
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const pad = (n) => String(n).padStart(2, '0');
function calcNetPrice(price, vatRate, vatMode) {
  const rate = vatRate ?? 0;
  const mode = vatMode ?? 'INCLUSIVE';
  if (rate === 0) return price;
  if (mode === 'INCLUSIVE') return price / (1 + rate / 100);
  return price;
}
function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
function CountdownBadge({ scheduledAt, now }) {
  if (!scheduledAt) return null;
  const diffMs = scheduledAt - now;
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(diffSecs / 3600);
  const mins = Math.floor((diffSecs % 3600) / 60);
  const secs = diffSecs % 60;
  if (diffMs <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-2 text-faint border border-line">
        <Clock size={10} /> Đã hết giờ
      </span>
    );
  }
  const timeStr = hours > 0 ? `${hours}h ${pad(mins)}m` : `${pad(mins)}:${pad(secs)}`;
  if (diffMs < 15 * 60 * 1000) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-500/18 text-red-600 dark:text-red-300 border border-red-300 dark:border-red-500/35 animate-pulse">
        <AlertTriangle size={10} /> {timeStr}
      </span>
    );
  }
  if (diffMs < 60 * 60 * 1000) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-500/18 text-amber-600 dark:text-amber-300 border border-amber-300 dark:border-amber-500/35">
        <Clock size={10} /> {timeStr}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/28">
      <Clock size={10} /> {timeStr}
    </span>
  );
}
function getScheduledRowClass(scheduledAt, now) {
  if (!scheduledAt) return '';
  const diffMs = scheduledAt - now;
  if (diffMs <= 0) return 'bg-canvas';
  if (diffMs < 15 * 60 * 1000) return 'bg-red-50/60 dark:bg-red-500/6';
  if (diffMs < 60 * 60 * 1000) return 'bg-amber-50/60 dark:bg-amber-500/6';
  return 'bg-blue-50/20 dark:bg-blue-500/4';
}
function WarningModal({ open, type, items, onClose }) {
  if (!open) return null;
  const isStock = type === 'stock';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`px-5 py-4 flex items-center gap-3 border-b ${isStock ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/18' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/18'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isStock ? 'bg-red-100 dark:bg-red-500/18' : 'bg-amber-100 dark:bg-amber-500/18'}`}>
            <AlertTriangle size={16} className={isStock ? 'text-red-500' : 'text-amber-500'} />
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-sm ${isStock ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {isStock ? 'Không đủ tồn kho' : 'Giá đã thay đổi'}
            </h3>
            <p className={`text-xs mt-0.5 ${isStock ? 'text-red-500' : 'text-amber-500'}`}>
              {isStock ? 'Không thể tạo đơn hàng, vui lòng điều chỉnh đơn nháp' : 'Vui lòng xem lại và cập nhật giá'}
            </p>
          </div>
          <button onClick={onClose} className={`${isStock ? 'text-red-400 hover:text-red-600 dark:text-red-300' : 'text-amber-400 hover:text-amber-600 dark:text-amber-300'} transition-colors`}>
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 max-h-64 overflow-y-auto">
          {items.map((item, idx) => (
            <div key={idx} className={`rounded-xl border p-3 ${isStock ? 'border-red-100 dark:border-red-500/18 bg-red-50/40 dark:bg-red-500/4' : 'border-amber-100 dark:border-amber-500/18 bg-amber-50/40 dark:bg-amber-500/4'}`}>
              <p className={`font-semibold text-sm ${isStock ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {isStock ? item.ingredientName : item.productName}
              </p>
              {isStock ? (
                <div className="flex gap-4 mt-1">
                  <span className="text-xs text-red-400">Cần: <b className="text-red-600 dark:text-red-300">{Number(item.needed).toFixed(2)}</b></span>
                  <span className="text-xs text-red-400">Còn: <b className="text-red-600 dark:text-red-300">{Number(item.available).toFixed(2)}</b></span>
                </div>
              ) : (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex gap-4">
                    <span className="text-xs text-amber-500">Giá hiện tại trong đơn: <b>{fmt(item.oldPrice)}</b></span>
                    <span className="text-xs text-amber-500">Giá mới: <b>{fmt(item.newPrice)}</b></span>
                  </div>
                  {item.tierName && <span className="text-[11px] text-amber-600 dark:text-amber-300">Khung giá: {item.tierName}</span>}
                </div>
              )}
              {isStock && item.affectedProducts?.length > 0 && (
                <p className="text-[11px] text-muted mt-1">Ảnh hưởng: {item.affectedProducts.join(', ')}</p>
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
function OrderInfoModal({ open, draft, onClose, onConfirm }) {
  const [deliveryDate, setDeliveryDate] = useState(null);
  const [orderedBy, setOrderedBy] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [showPrices, setShowPrices] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    setOrderedBy(draft?.orderedByName || '');
    setReceiverName(draft?.receiverName || '');
    setDeliveryDate(draft?.deliveryDatetime
      ? new Date(draft.deliveryDatetime)
      : null);
    if (draft?.customerId) {
      setCustomer({ id: draft.customerId, name: draft.customerName, phone: draft.customerPhone, contactName: draft.customerName });
    } else {
      setCustomer(null);
    }
  }, [open, draft]);
  if (!open) return null;
  const handleConfirm = () => {
    const ts = deliveryDate ? deliveryDate.getTime() : null;
    onConfirm(ts, orderedBy.trim() || null, showPrices, customer, receiverName.trim() || null);
  };
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="bg-gradient-to-r from-gold to-gold-strong px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Xác nhận đặt hàng</p>
              <h3 className="text-white font-bold text-base mt-0.5">Thông tin giao hàng</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
              <X size={15} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">👤 Khách hàng</label>
              {customer ? (
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-gold/40 bg-gold-tint">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-ink truncate">{customer.contactName || customer.name}</p>
                    {customer.phone && <p className="text-xs text-muted">{customer.phone}</p>}
                  </div>
                  <button onClick={() => setCustomer(null)} className="text-faint hover:text-red-400 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setCustomerModalOpen(true)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl border-2 border-dashed border-line text-muted text-sm hover:border-gold hover:text-gold transition-all">
                  <User size={14} /> Chọn khách hàng (tuỳ chọn)
                </button>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">✍️ Tên người đặt hàng</label>
              <input type="text" value={orderedBy} onChange={e => setOrderedBy(e.target.value)}
                placeholder="Nhập tên người đặt..."
                className="w-full rounded-xl border-2 border-line px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-gold transition-colors bg-surface placeholder:text-faint" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">📦 Người nhận hàng</label>
              <input type="text" value={receiverName} onChange={e => setReceiverName(e.target.value)}
                placeholder="Nhập tên người nhận (nếu khác người đặt)..."
                className="w-full rounded-xl border-2 border-line px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-gold transition-colors bg-surface placeholder:text-faint" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">🕐 Ngày & giờ giao hàng <span className="normal-case font-normal text-faint">(tuỳ chọn)</span></label>
              <DateTimePicker value={deliveryDate} onChange={setDeliveryDate} minDate={new Date()} placeholder="Không hẹn giờ giao — bấm để chọn" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div onClick={() => setShowPrices(v => !v)}
                className={`w-9 h-5 rounded-full relative flex-shrink-0 transition-colors ${showPrices ? 'bg-gold' : 'bg-surface-3'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface shadow transition-all ${showPrices ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-sm text-ink-2">Hiển thị giá trên hóa đơn</span>
            </label>
          </div>
          <div className="px-5 pb-5">
            <button onClick={handleConfirm}
              className="w-full py-3 rounded-xl bg-gold text-white font-bold text-sm hover:bg-gold-strong transition-colors flex items-center justify-center gap-2">
              <Receipt size={15} /> Xác nhận đặt hàng
            </button>
          </div>
        </div>
      </div>
      {customerModalOpen && (
        <CustomerSearchModal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)}
          onSelect={(c) => { setCustomer(c); setCustomerModalOpen(false); }} />
      )}
    </>
  );
}
function HoldOverlay({ expiresAt, onExpired, onCancel }) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = expiresAt - Date.now();
      setRemaining(left > 0 ? left : 0);
      if (left <= 0) onExpired?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const m = Math.floor((remaining || 0) / 60000);
  const s = Math.floor(((remaining || 0) % 60000) / 1000);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm text-center overflow-hidden">
        <div className="bg-gradient-to-r from-gold to-gold-strong px-5 py-5">
          <Timer size={28} className="text-white mx-auto mb-2" />
          <p className="text-white font-bold text-lg">Đang giữ tồn kho</p>
          <p className="text-white/70 text-xs mt-1">Chuyển sang trang bán hàng để xử lý đơn</p>
        </div>
        <div className="px-5 py-6">
          <div className="text-5xl font-bold text-gold font-mono mb-2">{pad(m)}:{pad(s)}</div>
          <p className="text-sm text-muted mb-5">Tồn kho sẽ được giải phóng khi hết giờ</p>
          <button onClick={onCancel}
            className="w-full py-2.5 rounded-xl border border-red-200 dark:border-red-500/28 text-red-500 text-sm font-semibold hover:bg-red-50 dark:bg-red-500/10 transition-colors">
            Hủy & Giải phóng tồn kho
          </button>
        </div>
      </div>
    </div>
  );
}
function TierSelectModal({ product, currentTierId, currentPriceSource, onConfirm, onClose }) {
  const hasTiers = product.priceTiers && product.priceTiers.length > 0;
  const saleType = product._saleType || 'RETAIL';
  const unitsPerBox = (saleType === 'BOX' && product.unitsPerBox > 0) ? product.unitsPerBox : 1;
  const isBox = unitsPerBox > 1;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
        <div className="bg-gradient-to-r from-gold to-gold-strong px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Chọn loại giá</p>
            <h3 className="text-white font-bold text-sm mt-0.5 truncate max-w-[200px]">{product.name}</h3>
            {isBox && <p className="text-white/60 text-[10px] mt-0.5">📦 Thùng {unitsPerBox} hộp</p>}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <X size={14} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <button
            onClick={() => onConfirm({ priceSource: 'BASE', tierId: null, tierName: null, unitPrice: product.basePrice * unitsPerBox })}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all
              ${currentPriceSource === 'BASE' ? 'border-sky-400 bg-sky-50 dark:bg-sky-500/10' : 'border-line hover:border-sky-300 dark:border-sky-500/35 hover:bg-sky-50/50 dark:bg-sky-500/5'}`}>
            <div className="text-left">
              <p className="text-sm font-semibold text-ink">Giá lẻ</p>
              {isBox && <p className="text-[10px] text-muted">{fmt(product.basePrice)} / hộp</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-sky-600 dark:text-sky-300">{fmt(product.basePrice * unitsPerBox)}</p>
              {isBox && <p className="text-[10px] text-muted">/ thùng</p>}
            </div>
          </button>
          {hasTiers && product.priceTiers.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((tier, idx) => (
            <button key={tier.id}
              onClick={() => onConfirm({ priceSource: 'TIER', tierId: tier.id, tierName: tier.tierName, unitPrice: tier.price * unitsPerBox })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all
                ${currentTierId === tier.id ? 'border-orange-400 bg-orange-50 dark:bg-orange-500/10' : 'border-line hover:border-orange-300 dark:border-orange-500/35 hover:bg-orange-50/50 dark:bg-orange-500/5'}`}>
              <div className="text-left">
                <p className="text-sm font-semibold text-ink">{tier.tierName || `Sỉ ${idx + 1}`}</p>
                {isBox && <p className="text-[10px] text-muted">{fmt(tier.price)} / hộp</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-orange-600 dark:text-orange-300">{fmt(tier.price * unitsPerBox)}</p>
                {isBox && <p className="text-[10px] text-muted">/ thùng</p>}
                {currentTierId === tier.id && <Check size={14} className="text-orange-500 ml-auto mt-0.5" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
function ProductSearchModal({ open, warehouseId, onClose, onSelect }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  useEffect(() => {
    if (!open || !warehouseId) return;
    setLoading(true);
    Promise.all([
      productApi.getAll({ page: 0, size: 200, warehouseId }),
      categoryApi.getAll(),
    ]).then(([pRes, cRes]) => {
      setProducts(pRes.data?.data?.content || []);
      setCategories(cRes.data?.data || cRes.data || []);
    }).catch(() => { }).finally(() => setLoading(false));
  }, [open, warehouseId]);
  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory !== 'ALL') list = list.filter(p => p.categoryId == activeCategory || p.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, search]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="px-4 py-3 border-b border-line-soft flex items-center justify-between shrink-0">
          <h3 className="font-bold text-sm text-ink">Thêm sản phẩm</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-surface-2"><X size={16} /></button>
        </div>
        <div className="px-4 py-3 border-b border-line-soft space-y-2 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="text" placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-line text-sm focus:outline-none focus:border-gold bg-surface"
              autoFocus />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <button onClick={() => setActiveCategory('ALL')}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === 'ALL' ? 'bg-gold text-white' : 'bg-surface-2 text-muted hover:bg-surface-3'}`}>
              Tất cả
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === cat.id ? 'bg-gold text-white' : 'bg-surface-2 text-muted hover:bg-surface-3'}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted gap-2">
              <Package size={28} strokeWidth={1} />
              <p className="text-sm">Không tìm thấy sản phẩm</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.map(p => {
                const imageUrl = p.imageUrl
                  ? p.imageUrl.startsWith('http') ? p.imageUrl : `${BASE_URL}/api/auth${p.imageUrl}`
                  : null;
                const stock = p.stockQuantity != null ? Number(p.stockQuantity) : null;
                const outOfStock = stock !== null && stock <= 0;
                return (
                  <button key={`${p.id}-${Math.random()}`} onClick={() => onSelect(p)}
                    className="rounded-xl overflow-hidden text-left flex flex-col border border-line-soft hover:border-gold transition-all active:scale-95">
                    <div className="relative aspect-square bg-surface-2 overflow-hidden">
                      {imageUrl
                        ? <img src={imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                      }
                      {outOfStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white text-[9px] font-bold">Hết hàng</span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1.5">
                        <p className="text-white text-[10px] font-semibold line-clamp-2 leading-tight">{p.name}</p>
                        <p className="text-gold text-[10px] font-bold">{fmt(p.basePrice)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function PriceUpdateBanner({ changes, onUpdate, updating }) {
  if (!changes || changes.length === 0) return null;
  return (
    <div className="mx-4 mt-3 rounded-xl border border-amber-200 dark:border-amber-500/28 bg-amber-50 dark:bg-amber-500/10 overflow-hidden">
      <div className="px-3 py-2.5 flex items-start gap-2">
        <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-1">Giá sản phẩm đã thay đổi</p>
          <div className="space-y-1">
            {changes.map((c, i) => (
              <p key={i} className="text-[10px] text-amber-600 dark:text-amber-300">
                <b>{c.productName}</b>
                {c.tierName ? ` (${c.tierName})` : ' (Giá lẻ)'}:
                {' '}{fmt(c.oldPrice)} → <b>{fmt(c.newPrice)}</b>
              </p>
            ))}
          </div>
        </div>
        <button onClick={onUpdate} disabled={updating}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 disabled:opacity-60 transition-colors">
          {updating
            ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <RefreshCcw size={11} />}
          Cập nhật giá
        </button>
      </div>
    </div>
  );
}
function DraftCard({ draft, onDelete, onOrder, onInvoice, onEdit, processingId, orderingId, invoicingId, now }) {
  const { t } = useLang();
  const items = draft.items || [];
  const totalSubtotal = calcDraftTotal(draft);
  const isProcessing = processingId === draft.id;
  const isOrdering = orderingId === draft.id;
  const isInvoicing = invoicingId === draft.id;
  const busy = isProcessing || isOrdering || isInvoicing;
  const isScheduled = draft.type === 'SCHEDULED';
  const cardBg = isScheduled ? getScheduledRowClass(draft.scheduledAt, now) : '';
  const scheduledLabel = draft.scheduledAt
    ? new Date(draft.scheduledAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : null;
  return (
    <div className={`bg-surface rounded-xl border border-line-soft overflow-hidden shadow-sm ${cardBg}`}>
      <div className="p-4 border-b border-line-soft">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${isScheduled ? 'text-amber-600 dark:text-amber-300' : 'text-gold'}`}>
              {draft.draftCode}
            </span>
            {isScheduled && (
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/18 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-500/28">
                Hẹn giờ
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {draft.customerId ? (
              <div className="flex items-center gap-1">
                <User size={12} className="text-gold" />
                <span className="text-xs font-medium text-gold">{draft.customerName}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <User size={12} className="text-faint" />
                <span className="text-xs text-faint italic">Chưa chọn</span>
              </div>
            )}
            {draft.warehouseName && (
              <div className="flex items-center gap-1">
                <Warehouse size={11} className="text-muted" />
                <span className="text-xs text-ink-2">{draft.warehouseName}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-2">{items.length} món</span>
            {totalSubtotal > 0 && (
              <span className="text-xs font-bold text-gold">{formatPrice(totalSubtotal)}</span>
            )}
          </div>
          {isScheduled ? (
            <div className="flex items-center gap-1.5">
              <CountdownBadge scheduledAt={draft.scheduledAt} now={now} />
              {scheduledLabel && <span className="text-[10px] text-muted">→ {scheduledLabel}</span>}
            </div>
          ) : (
            <span className="text-[10px] text-faint flex items-center gap-0.5">
              <Clock size={10} />{formatDate(draft.updatedAt, t)}
            </span>
          )}
        </div>
        {(draft.discountRate > 0 || Number(draft.discountAmount) > 0) && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-300 mt-1.5">
            {draft.discountRate > 0 ? `Giảm ${draft.discountRate}%` : `Giảm ${formatPrice(draft.discountAmount)}`}
          </p>
        )}
      </div>
      <div className="p-3 bg-surface flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onInvoice(draft.id); }}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gold text-white text-sm font-bold hover:bg-[var(--c-gold-strong)] transition-all disabled:opacity-50 shadow-sm">
          {isInvoicing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileTextIcon size={16} />}
          <span>Tạo phiếu</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOrder(draft); }}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gold text-white text-sm font-bold hover:bg-[var(--c-gold-strong)] transition-all disabled:opacity-50 shadow-sm">
          {isOrdering ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Receipt size={16} />}
          <span>Đặt hàng</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(draft.id); }}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 dark:border-red-500/28 text-red-500 hover:bg-red-50 dark:bg-red-500/10 transition-all disabled:opacity-50">
          <Trash2 size={16} />
          <span className="text-sm">Xóa</span>
        </button>
      </div>
    </div>
  );
}
function DraftRow({ draft, onDelete, onOrder, onInvoice, onEdit, processingId, orderingId, invoicingId, now }) {
  const { t } = useLang();
  const items = draft.items || [];
  const totalSubtotal = calcDraftTotal(draft);
  const isProcessing = processingId === draft.id;
  const isOrdering = orderingId === draft.id;
  const isInvoicing = invoicingId === draft.id;
  const busy = isProcessing || isOrdering || isInvoicing;
  const isScheduled = draft.type === 'SCHEDULED';
  const rowBg = isScheduled ? getScheduledRowClass(draft.scheduledAt, now) : '';
  const scheduledLabel = draft.scheduledAt
    ? new Date(draft.scheduledAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : null;
  return (
    <tr className={`border-b border-line-soft hover:bg-surface transition-colors cursor-pointer select-none ${rowBg}`} onClick={(e) => { e.stopPropagation(); onEdit(draft); }}>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${isScheduled ? 'text-amber-600 dark:text-amber-300' : 'text-gold'}`}>
              {draft.draftCode}
            </span>
            {isScheduled && (
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/18 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-500/28">
                Hẹn giờ
              </span>
            )}
          </div>
          {isScheduled ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <CountdownBadge scheduledAt={draft.scheduledAt} now={now} />
              {scheduledLabel && <span className="text-[10px] text-muted">→ {scheduledLabel}</span>}
            </div>
          ) : (
            <span className="text-[10px] text-faint flex items-center gap-0.5">
              <Clock size={10} />{formatDate(draft.updatedAt, t)}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {draft.customerId ? (
          <div className="flex items-center gap-1.5">
            <User size={13} className="text-gold shrink-0" />
            {draft.customerName && <span className="text-xs font-bold text-gold font-mono">{draft.customerName}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <User size={13} className="text-faint" />
            <span className="text-faint italic text-xs">Chưa chọn</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {draft.warehouseName
          ? <span className="text-xs text-ink-2 flex items-center gap-1"><Warehouse size={11} className="text-muted" />{draft.warehouseName}</span>
          : <span className="text-xs text-faint">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-2 font-medium">{items.length} món</span>
          {totalSubtotal > 0 && (
            <span className="text-xs font-bold text-gold">{formatPrice(totalSubtotal)}</span>
          )}
        </div>
        {(draft.discountRate > 0 || Number(draft.discountAmount) > 0) && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-300 mt-0.5">
            {draft.discountRate > 0 ? `Giảm ${draft.discountRate}%` : `Giảm ${formatPrice(draft.discountAmount)}`}
          </p>
        )}
      </td>
      <td className="px-3 py-4">
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onInvoice(draft.id); }}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gold text-white text-sm font-bold hover:bg-[var(--c-gold-strong)] transition-all disabled:opacity-50 shadow-sm">
            {isInvoicing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileTextIcon size={16} />}
            <span>Tạo phiếu</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOrder(draft); }}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gold text-white text-sm font-bold hover:bg-[var(--c-gold-strong)] transition-all disabled:opacity-50 shadow-sm">
            {isOrdering ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Receipt size={16} />}
            <span>Đặt hàng</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(draft.id); }}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-500/28 text-red-500 hover:bg-red-50 dark:bg-red-500/10 transition-all disabled:opacity-50">
            <Trash2 size={16} />
            <span className="text-sm">Xóa</span>
          </button>
        </div>
      </td>
    </tr>
  );
}
function StockErrorBanner({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/28 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-lg">
        <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-red-700 dark:text-red-300">Không đủ tồn kho</p>
          <p className="text-xs text-red-500 mt-0.5">{message}</p>
          <p className="text-[10px] text-red-400 mt-1">Đơn nháp vẫn được giữ nguyên. Vui lòng điều chỉnh và thử lại.</p>
        </div>
        <button onClick={onClose} className="text-red-300 dark:text-red-300 hover:text-red-500 shrink-0"><X size={14} /></button>
      </div>
    </div>
  );
}
function DraftSurchargePanel({ surchargeItems, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const PRESETS = [
    { name: 'Thùng xốp', amount: 20000 },
    { name: 'Phí vận chuyển', amount: 30000 },
    { name: 'Gửi xe', amount: 10000 },
    { name: 'Đá khô', amount: 15000 },
  ];
  const addedNames = new Set(surchargeItems.map(i => i.name));
  const availablePresets = PRESETS.filter(p => !addedNames.has(p.name));
  const addPreset = (p) => { onChange([...surchargeItems, { name: p.name, amount: p.amount }]); setShowPicker(false); };
  const addCustom = () => {
    const name = customName.trim();
    const amount = parseInt(customAmount.replace(/[^0-9]/g, ''), 10) || 0;
    if (!name || surchargeItems.find(i => i.name === name)) return;
    onChange([...surchargeItems, { name, amount }]);
    setCustomName(''); setCustomAmount(''); setShowPicker(false);
  };
  const updateAmount = (name, raw) => {
    const num = raw === '' ? 0 : parseInt(String(raw).replace(/[^0-9]/g, ''), 10) || 0;
    if (num === 0) onChange(surchargeItems.filter(i => i.name !== name));
    else onChange(surchargeItems.map(i => i.name === name ? { ...i, amount: num } : i));
  };
  return (
    <div className="space-y-1.5">
      {surchargeItems.map(item => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="text-[11px] text-ink-2 font-medium w-24 shrink-0 truncate">{item.name}</span>
          <div className="relative flex-1">
            <input type="text" inputMode="numeric"
              value={item.amount === 0 ? '' : new Intl.NumberFormat('vi-VN').format(item.amount)}
              onChange={e => updateAmount(item.name, e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-line px-2 py-1 text-xs text-right pr-6 focus:outline-none focus:border-gold" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">đ</span>
          </div>
          <button onClick={() => onChange(surchargeItems.filter(i => i.name !== item.name))} className="text-faint hover:text-red-400 shrink-0"><X size={12} /></button>
        </div>
      ))}
      {!showPicker ? (
        <button onClick={() => setShowPicker(true)} className="flex items-center gap-1 text-[11px] text-gold hover:text-gold-deep font-semibold py-0.5">
          <Plus size={12} /> Thêm phụ phí
        </button>
      ) : (
        <div className="bg-gold-tint rounded-xl border border-gold/20 p-2.5 space-y-2">
          {availablePresets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availablePresets.map(p => (
                <button key={p.name} onClick={() => addPreset(p)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-surface border border-line text-ink-2 hover:border-gold font-medium transition-colors">
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setShowPicker(false); }}
              placeholder="Tên phụ phí..."
              className="flex-1 rounded-lg border border-line px-2 py-1 text-[11px] focus:outline-none focus:border-gold bg-surface" />
            <div className="relative w-24">
              <input type="text" inputMode="numeric" value={customAmount}
                onChange={e => setCustomAmount(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setShowPicker(false); }}
                placeholder="Số tiền"
                className="w-full rounded-lg border border-line px-2 py-1 text-[11px] text-right pr-5 focus:outline-none focus:border-gold bg-surface" />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">đ</span>
            </div>
            <button onClick={addCustom} disabled={!customName.trim()}
              className="px-2 py-1 rounded-lg bg-gold text-white text-[10px] font-semibold disabled:opacity-40 shrink-0">Thêm</button>
            <button onClick={() => { setShowPicker(false); setCustomName(''); setCustomAmount(''); }}
              className="px-2 py-1 rounded-lg border border-line text-muted text-[10px] shrink-0">Bỏ</button>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── EditDraftModal with shipping info and price display option ──────────────
function EditDraftModal({ open, draft, onClose, onSaved }) {
  const toast = useToast();
  // Cart state
  const [cartItems, setCartItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [discountFixedAmt, setDiscountFixedAmt] = useState(null);
  const [discountFixedDisplay, setDiscountFixedDisplay] = useState('');
  const [surchargeItems, setSurchargeItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  // Shipping info state
  const [customer, setCustomer] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [orderedByName, setOrderedByName] = useState('');
  const [priceDisplayOption, setPriceDisplayOption] = useState('show'); // 'show', 'hide_prices', 'hide_all'
  // UI state
  const [saving, setSaving] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [pendingSaleProduct, setPendingSaleProduct] = useState(null);
  const [tierModalProduct, setTierModalProduct] = useState(null);
  const [tierModalCartId, setTierModalCartId] = useState(null);
  const [products, setProducts] = useState([]);
  const [priceChanges, setPriceChanges] = useState([]);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const productsRef = useRef([]);
  useEffect(() => { productsRef.current = products; }, [products]);
  // Load products
  useEffect(() => {
    if (!open || !draft?.warehouseId) return;
    productApi.getAll({ page: 0, size: 200, warehouseId: draft.warehouseId })
      .then(res => setProducts(res.data?.data?.content || []))
      .catch(() => { });
  }, [open, draft?.warehouseId]);
  // Init cart & order fields from draft
  useEffect(() => {
    if (!open || !draft) return;
    setCartItems((draft.items || []).map(i => ({
      id: newEditCartId(),
      productId: i.productId, productName: i.productName, productImageUrl: i.productImageUrl,
      unit: i.unit, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice),
      originalUnitPrice: Number(i.unitPrice),
      priceSource: i.isManualPrice ? 'MANUAL' : (i.tierId ? 'TIER' : 'BASE'),
      tierId: i.tierId, tierName: i.tierName,
      vatRate: i.vatRate ?? 0, vatMode: i.vatMode ?? 'INCLUSIVE',
      maxDiscountRate: i.maxDiscountRate ?? 0, itemDiscountRate: i.itemDiscountRate || 0,
      isManualPrice: i.isManualPrice, saleType: i.saleType || 'RETAIL', unitsPerBox: i.unitsPerBox,
      isPromo: i.isPromo, promoNote: i.promoNote, notes: i.notes,
      priceTiers: [], basePrice: i.basePrice ?? i.unitPrice,
    })));
    setDiscount(draft.discountRate || 0);
    if (draft.discountAmount && Number(draft.discountAmount) > 0) {
      setDiscountFixedAmt(Number(draft.discountAmount));
      setDiscountFixedDisplay(new Intl.NumberFormat('vi-VN').format(Number(draft.discountAmount)));
    } else {
      setDiscountFixedAmt(null);
      setDiscountFixedDisplay('');
    }
    setSurchargeItems(draft.surchargeItems || []);
    setNotes(draft.notes || '');
    setPaymentMethod(draft.paymentMethod || 'CASH');
    // Shipping info
    if (draft.customerId) {
      setCustomer({ id: draft.customerId, name: draft.customerName, phone: draft.customerPhone, contactName: draft.customerName });
    } else {
      setCustomer(null);
    }
    setReceiverName(draft.receiverName || '');
    setOrderedByName(draft.orderedByName || '');
    // Price display option
    if (draft.hideAllPrices) {
      setPriceDisplayOption('hide_all');
    } else if (draft.showPrices === false) {
      setPriceDisplayOption('hide_prices');
    } else {
      setPriceDisplayOption('show');
    }
    setPriceChanges([]);
  }, [open, draft]);
  // Detect price changes when products load
  useEffect(() => {
    if (!products.length || !cartItems.length) return;
    const changes = [];
    for (const item of cartItems) {
      if (item.isManualPrice || item.isPromo) continue;
      const fp = products.find(p => p.id === item.productId);
      if (!fp) continue;
      let freshPrice, tierName = null;
      if (item.priceSource === 'TIER' && item.tierId) {
        const ft = fp.priceTiers?.find(t => t.id === item.tierId);
        freshPrice = ft ? Number(ft.price) : Number(fp.basePrice);
        tierName = ft?.tierName || item.tierName;
      } else {
        freshPrice = Number(fp.basePrice);
      }
      if (item.saleType === 'BOX' && item.unitsPerBox > 0) freshPrice *= item.unitsPerBox;
      if (Math.abs(freshPrice - item.unitPrice) > 1) {
        changes.push({ productName: item.productName, tierName, oldPrice: item.unitPrice, newPrice: freshPrice, productId: item.productId, tierId: item.tierId, priceSource: item.priceSource });
      }
    }
    setPriceChanges(prev => {
      const prevKey = prev.map(c => `${c.productId}-${c.oldPrice}-${c.newPrice}`).join(',');
      const nextKey = changes.map(c => `${c.productId}-${c.oldPrice}-${c.newPrice}`).join(',');
      return prevKey === nextKey ? prev : changes;
    });
  }, [products, open]);
  // Update prices
  const handleUpdatePrices = useCallback(async () => {
    setUpdatingPrices(true);
    try {
      const freshRes = await productApi.getAll({ page: 0, size: 200, warehouseId: draft?.warehouseId });
      const fps = freshRes.data?.data?.content || [];
      setProducts(fps);
      setCartItems(prev => prev.map(item => {
        if (item.isManualPrice || item.isPromo) return item;
        const fp = fps.find(p => p.id === item.productId);
        if (!fp) return item;
        let freshPrice;
        if (item.priceSource === 'TIER' && item.tierId) {
          const ft = fp.priceTiers?.find(t => t.id === item.tierId);
          freshPrice = ft ? Number(ft.price) : Number(fp.basePrice);
        } else {
          freshPrice = Number(fp.basePrice);
        }
        if (item.saleType === 'BOX' && item.unitsPerBox > 0) freshPrice *= item.unitsPerBox;
        const newVatRate = fp.vatRate ?? item.vatRate;
        const newVatMode = fp.vatMode ?? item.vatMode;
        const newMaxDiscount = fp.maxDiscountRate ?? item.maxDiscountRate;
        const newItemDiscount = (newMaxDiscount > 0 && item.itemDiscountRate > newMaxDiscount) ? newMaxDiscount : item.itemDiscountRate;
        return {
          ...item, unitPrice: freshPrice, originalUnitPrice: freshPrice,
          vatRate: newVatRate,
          vatMode: (item.vatMode === 'EXCLUSIVE' && newVatMode === 'INCLUSIVE') ? 'INCLUSIVE' : item.vatMode,
          maxDiscountRate: newMaxDiscount, itemDiscountRate: newItemDiscount,
        };
      }));
      setPriceChanges([]);
      toast('Đã cập nhật giá mới nhất', 'success');
    } catch { toast('Lỗi khi cập nhật giá', 'error'); }
    finally { setUpdatingPrices(false); }
  }, [draft?.warehouseId, toast]);
  // Cart operations
  const addToCartDirect = useCallback((product, saleType, priceSource, tierId, tierName, unitPrice) => {
    const unitsPerBox = (saleType === 'BOX' && product.unitsPerBox > 0) ? product.unitsPerBox : null;
    setCartItems(prev => [...prev, {
      id: newEditCartId(), productId: product.id, productName: product.name,
      productImageUrl: product.imageUrl, unit: unitsPerBox ? 'Thùng' : (product.unit || ''),
      quantity: 1, unitPrice, originalUnitPrice: unitPrice, priceSource, tierId, tierName,
      vatRate: product.vatRate ?? 0, vatMode: product.vatMode ?? 'INCLUSIVE',
      maxDiscountRate: product.maxDiscountRate ?? 0, itemDiscountRate: 0,
      isManualPrice: false, saleType, unitsPerBox,
      priceTiers: product.priceTiers || [], basePrice: product.basePrice ?? 0,
    }]);
  }, []);
  const handleProductSelect = useCallback((product) => {
    setProductSearchOpen(false);
    if (product.unitsPerBox && product.unitsPerBox > 0) {
      setPendingSaleProduct(product);
    } else if (product.priceTiers && product.priceTiers.length > 0) {
      setTierModalProduct(product); setTierModalCartId(null);
    } else {
      addToCartDirect(product, 'RETAIL', 'BASE', null, null, product.basePrice);
    }
  }, [addToCartDirect]);
  const handleTierConfirm = useCallback(({ priceSource, tierId, tierName, unitPrice }) => {
    if (tierModalCartId != null) {
      setCartItems(prev => prev.map(i => i.id !== tierModalCartId ? i : { ...i, priceSource, tierId, tierName, unitPrice, originalUnitPrice: unitPrice, isManualPrice: false }));
    } else if (tierModalProduct) {
      addToCartDirect(tierModalProduct, tierModalProduct._saleType || 'RETAIL', priceSource, tierId, tierName, unitPrice);
    }
    setTierModalProduct(null); setTierModalCartId(null);
  }, [tierModalCartId, tierModalProduct, addToCartDirect]);
  const handleTierSelect = useCallback((cartId) => {
    const item = cartItems.find(i => i.id === cartId);
    if (!item) return;
    const prod = productsRef.current.find(p => p.id === item.productId);
    if (!prod) return;
    setTierModalProduct({ ...prod, _saleType: item.saleType });
    setTierModalCartId(cartId);
  }, [cartItems]);
  const updateQty = useCallback((cartId, qty) => {
    if (qty <= 0) { setCartItems(prev => prev.filter(i => i.id !== cartId)); return; }
    setCartItems(prev => prev.map(i => i.id !== cartId ? i : { ...i, quantity: qty }));
  }, []);
  const overridePrice = useCallback((cartId, newPrice, isManual = false) => {
    setCartItems(prev => prev.map(i => {
      if (i.id !== cartId) return i;
      return { ...i, unitPrice: newPrice, originalUnitPrice: i.originalUnitPrice ?? i.unitPrice, priceSource: isManual ? 'MANUAL' : i.priceSource, isManualPrice: isManual || i.isManualPrice, tierId: isManual ? null : i.tierId, tierName: isManual ? null : i.tierName };
    }));
  }, []);
  const handleVatRateChange = useCallback((cartId, newRate) => {
    setCartItems(prev => prev.map(i => i.id !== cartId ? i : ((i.vatMode ?? 'INCLUSIVE') === 'INCLUSIVE' ? i : { ...i, vatRate: newRate })));
  }, []);
  const togglePromo = useCallback((cartId, enable, note) => {
    setCartItems(prev => prev.map(i => {
      if (i.id !== cartId) return i;
      if (enable) return { ...i, isPromo: true, promoNote: note || '', _priceBeforePromo: i._priceBeforePromo ?? i.unitPrice };
      return { ...i, isPromo: false, promoNote: '', unitPrice: i._priceBeforePromo ?? i.unitPrice, _priceBeforePromo: undefined };
    }));
  }, []);
  // Summary calculations
  // THAY TOÀN BỘ phần summary calculations:

  const calcNet = (item) => calcNetPrice(item.unitPrice, item.vatRate, item.vatMode);

  const promoTotal = cartItems.reduce((s, i) => {
    if (!i.isPromo) return s;
    return s + Number(i._priceBeforePromo ?? i.unitPrice) * Number(i.quantity);
  }, 0);

  // Tạm tính = tổng giá gộp (unitPrice × qty), giống OrdersPage
  const subtotalGross = cartItems.reduce((s, i) => {
    if (i.isPromo) return s;
    return s + Number(i.unitPrice) * Number(i.quantity);
  }, 0);

  const itemDiscountTotal = cartItems.reduce((s, i) => {
    if (i.isPromo || !i.itemDiscountRate) return s;
    // CK món tính trên giá gộp
    return s + Number(i.unitPrice) * Number(i.quantity) * (i.itemDiscountRate / 100);
  }, 0);

  const subtotalAfterItemDiscount = subtotalGross - itemDiscountTotal;
  const maxDiscountFixed = Math.round(subtotalAfterItemDiscount * 0.1);
  const discountAmt = discountFixedAmt !== null
    ? Math.min(discountFixedAmt, maxDiscountFixed)
    : Math.round(subtotalAfterItemDiscount * discount) / 100;

  const surchargeNum = surchargeItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  // VAT EXCLUSIVE tính trên NET sau giảm giá, phân bổ theo tỷ lệ
  const exclusiveVatTotal = (() => {
    return cartItems.reduce((s, i) => {
      if (i.isPromo || (i.vatMode ?? 'INCLUSIVE') !== 'EXCLUSIVE' || !i.vatRate) return s;
      const lineGross = Number(i.unitPrice) * Number(i.quantity);
      const proportion = subtotalGross > 0 ? lineGross / subtotalGross : 0;
      const lineDiscountTotal = (itemDiscountTotal + discountAmt) * proportion;
      const lineNet = calcNet(i) * Number(i.quantity) - lineDiscountTotal * calcNet(i) / (Number(i.unitPrice) || 1);
      // Đơn giản hơn: NET sau giảm = (lineGross - phần giảm) / (1 + rate/100) cho INCLUSIVE
      // Với EXCLUSIVE: lineNet = lineGross - phần giảm, VAT = lineNet * rate/100
      const lineGrossAfterDiscount = lineGross - (itemDiscountTotal + discountAmt) * proportion;
      return s + lineGrossAfterDiscount * (i.vatRate / 100);
    }, 0);
  })();

  const inclusiveVatTotal = cartItems.reduce((s, i) => {
    if (i.isPromo || (i.vatMode ?? 'INCLUSIVE') !== 'INCLUSIVE' || !i.vatRate) return s;
    const lineGross = Number(i.unitPrice) * Number(i.quantity);
    const proportion = subtotalGross > 0 ? lineGross / subtotalGross : 0;
    const lineGrossAfterDiscount = lineGross - (itemDiscountTotal + discountAmt) * proportion;
    // Tách VAT ra từ giá gộp sau giảm
    return s + lineGrossAfterDiscount * i.vatRate / (100 + i.vatRate);
  }, 0);


  // Tổng = giá gộp sau giảm + VAT exclusive + phụ phí
  const total = subtotalAfterItemDiscount - discountAmt + exclusiveVatTotal + surchargeNum;
  // Save
  const handleSave = async () => {
    if (cartItems.length === 0) { toast('Giỏ hàng trống', 'warning'); return; }
    setSaving(true);
    try {
      const showPrices = priceDisplayOption === 'show';
      const hideAllPrices = priceDisplayOption === 'hide_all';
      const payload = {
        customerId: customer?.id || null,
        customerName: customer?.contactName || customer?.name || draft?.customerName || null,
        customerPhone: customer?.phone || draft?.customerPhone || null,
        customerEmail: draft?.customerEmail || null,
        shippingAddress: draft?.shippingAddress || null,
        provinceName: draft?.provinceName || null,
        wardName: draft?.wardName || null,
        receiverName: receiverName.trim() || null,
        receiverPhone: draft?.receiverPhone || null,
        receiverAddress: draft?.receiverAddress || null,
        notes,
        paymentMethod,
        discountRate: discountFixedAmt !== null ? 0 : discount,
        discountAmount: discountFixedAmt !== null ? Math.min(discountFixedAmt, maxDiscountFixed) : null,
        surchargeItems: surchargeItems.filter(i => Number(i.amount) > 0),
        warehouseId: draft?.warehouseId || null,
        warehouseName: draft?.warehouseName || null,
        deliveryDatetime: draft?.deliveryDatetime || null,
        orderedByName: orderedByName.trim() || null,
        showPrices,
        hideAllPrices,
        type: draft?.type || 'DRAFT',
        scheduledAt: draft?.scheduledAt || null,
        items: cartItems.map(i => ({
          productId: i.productId, productName: i.productName, productImageUrl: i.productImageUrl,
          unit: i.unit, quantity: i.quantity, unitPrice: i.unitPrice, basePrice: i.basePrice,
          priceMode: i.priceSource === 'MANUAL' ? 'BASE' : (i.priceSource === 'TIER' ? 'TIER' : 'BASE'),
          tierId: i.isPromo ? null : i.tierId, tierName: i.tierName,
          isManualPrice: i.priceSource === 'MANUAL',
          vatRate: i.vatRate, vatMode: i.vatMode,
          saleType: i.saleType || 'RETAIL', unitsPerBox: i.unitsPerBox,
          isPromo: i.isPromo, promoNote: i.promoNote,
          itemDiscountRate: i.itemDiscountRate || 0, notes: i.notes,
          subtotal: calcNet(i) * Number(i.quantity),
        })),
      };
      const res = await draftApi.save(payload);
      const saved = res?.data?.data;
      await draftApi.delete(draft.id).catch(() => { });
      toast('Đã lưu thay đổi', 'success');
      onSaved(saved);
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi lưu đơn nháp', 'error');
    } finally {
      setSaving(false);
    }
  };
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-surface rounded-2xl shadow-2xl flex flex-col w-[80svw] max-w-4xl" style={{ maxHeight: '85svh' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-gold to-gold-strong px-5 py-4 flex items-center justify-between shrink-0 rounded-t-2xl">
            <div>
              <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Chỉnh sửa đơn nháp</p>
              <h3 className="text-white font-bold text-base mt-0.5">{draft?.draftCode}</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30"><X size={15} /></button>
          </div>
          {/* Price change banner */}
          <PriceUpdateBanner changes={priceChanges} onUpdate={handleUpdatePrices} updating={updatingPrices} />
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Shipping Info Section */}
            <div className="px-4 pt-4 pb-2 border-b border-line-soft space-y-3">
              {/* Customer selection */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">👤 Khách hàng</label>
                {customer ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-gold/40 bg-gold-tint">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-ink truncate">{customer.contactName || customer.name}</p>
                      {customer.phone && <p className="text-xs text-muted">{customer.phone}</p>}
                    </div>
                    <button onClick={() => setCustomer(null)} className="text-faint hover:text-red-400 transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setCustomerModalOpen(true)}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl border-2 border-dashed border-line text-muted text-sm hover:border-gold hover:text-gold transition-all">
                    <User size={14} /> Chọn khách hàng (tuỳ chọn)
                  </button>
                )}
              </div>
              {/* Two column: Receiver name (left) and Ordered by (right) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">📦 Người nhận hàng</label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    placeholder="Tên người nhận"
                    className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:outline-none focus:border-gold bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">✍️ Người đặt hàng</label>
                  <input
                    type="text"
                    value={orderedByName}
                    onChange={e => setOrderedByName(e.target.value)}
                    placeholder="Tên người đặt"
                    className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:outline-none focus:border-gold bg-surface"
                  />
                </div>
              </div>
              {/* Price display option dropdown */}
              <div>
                <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">💰 Hiển thị giá</label>
                <select
                  value={priceDisplayOption}
                  onChange={(e) => setPriceDisplayOption(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2 text-sm focus:outline-none focus:border-gold bg-surface"
                >
                  <option value="show">Hiển thị đầy đủ giá</option>
                  <option value="hide_prices">Che giá (ẩn giá từng sản phẩm, chỉ hiện tổng)</option>
                  <option value="hide_all">Che toàn bộ (ẩn tất cả số tiền)</option>
                </select>
                <p className="text-[10px] text-muted mt-1">
                  {priceDisplayOption === 'show' && '✓ Hiển thị tất cả giá trên phiếu'}
                  {priceDisplayOption === 'hide_prices' && '✓ Ẩn giá từng sản phẩm, vẫn hiển thị tổng tiền'}
                  {priceDisplayOption === 'hide_all' && '✓ Ẩn toàn bộ số tiền trên phiếu (chỉ hiển thị tên và số lượng)'}
                </p>
              </div>
            </div>
            {/* Cart items */}
            <div className="px-4 pt-3 pb-1">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-faint gap-2">
                  <Package size={28} strokeWidth={1} /><p className="text-sm">Chưa có món nào</p>
                </div>
              ) : (
                cartItems.map(item => (
                  <CartItem
                    key={item.id} item={item}
                    onUpdate={updateQty}
                    onRemove={(cartId) => setCartItems(prev => prev.filter(i => i.id !== cartId))}
                    onPriceOverride={overridePrice}
                    onDiscountChange={(cartId, pct) => {
                      setCartItems(prev => prev.map(i => {
                        if (i.id !== cartId) return i;
                        const max = i.maxDiscountRate || 0;
                        return { ...i, itemDiscountRate: Math.max(0, Math.min(100, max > 0 ? Math.min(pct, max) : pct)) };
                      }));
                    }}
                    onPromoToggle={togglePromo}
                    onVatRateChange={handleVatRateChange}
                    onTierSelect={() => handleTierSelect(item.id)}
                  />
                ))
              )}
            </div>
            {/* Add product button */}
            <div className="px-4 pb-3">
              <button onClick={() => setProductSearchOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-line text-muted text-sm hover:border-gold hover:text-gold transition-all">
                <Plus size={15} /> Thêm sản phẩm
              </button>
            </div>
            {/* Divider */}
            <div className="border-t border-line-soft mx-4" />
            {/* Order settings */}
            <div className="px-4 py-3 space-y-3">
              <textarea placeholder="Ghi chú đơn hàng..." value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full rounded-xl border border-line px-3 py-2 text-xs resize-none focus:outline-none focus:border-gold bg-surface" />
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Thanh toán</p>
                <div className="flex gap-1.5">
                  {[['CASH', '💵 Tiền mặt'], ['BANK_TRANSFER', '🏦 Chuyển khoản'], ['DEBT', '📋 Công nợ']].map(([val, label]) => (
                    <button key={val} onClick={() => setPaymentMethod(val)}
                      className={`flex-1 text-[10px] py-1.5 rounded-lg border font-medium transition-colors
                        ${paymentMethod === val ? 'border-gold bg-gold/10 text-gold' : 'border-line text-muted hover:border-gold'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Giảm giá bill</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {[0, 3, 5, 8, 10].map(d => (
                    <button key={d} onClick={() => { setDiscount(d); setDiscountFixedAmt(null); setDiscountFixedDisplay(''); }}
                      className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors
                        ${discount === d && discountFixedAmt === null ? 'bg-gold text-white' : 'bg-surface-2 text-muted hover:bg-surface-3'}`}>
                      {d}%
                    </button>
                  ))}
                  {discountFixedAmt === null ? (
                    <button onClick={() => { setDiscount(0); setDiscountFixedAmt(0); setDiscountFixedDisplay(''); }}
                      className="text-[10px] px-2 py-1 rounded-md font-semibold bg-surface-2 text-muted hover:bg-surface-3">
                      Nhập tiền
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="relative">
                        <input type="text" inputMode="numeric" value={discountFixedDisplay}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            setDiscountFixedDisplay(raw);
                            setDiscountFixedAmt(raw === '' ? 0 : parseInt(raw, 10) || 0);
                          }}
                          placeholder={`tối đa ${new Intl.NumberFormat('vi-VN').format(maxDiscountFixed)}`}
                          className="w-28 rounded-md px-2 py-1 text-[10px] text-right pr-5 border border-gold bg-gold/5 font-semibold text-gold focus:outline-none" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">đ</span>
                      </div>
                      <button onClick={() => { setDiscountFixedAmt(null); setDiscountFixedDisplay(''); }}
                        className="text-[10px] px-1.5 py-1 rounded-md bg-surface-2 text-muted hover:bg-surface-3 font-semibold">×</button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Phụ phí</p>
                <DraftSurchargePanel surchargeItems={surchargeItems} onChange={setSurchargeItems} />
              </div>
            </div>
          </div>
          {/* Footer: summary + save */}
          <div className="border-t border-line-soft px-4 py-3 bg-surface shrink-0 rounded-b-2xl space-y-2">
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between text-muted">
                <span>Tạm tính</span><span>{fmt(subtotalGross)}</span>
              </div>
              {itemDiscountTotal > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-300">
                  <span>CK món</span><span>-{fmt(itemDiscountTotal)}</span>
                </div>
              )}
              {discountAmt > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-300">
                  <span>{discountFixedAmt !== null ? 'Giảm trực tiếp' : `Giảm bill (${discount}%)`}</span>
                  <span>-{fmt(discountAmt)}</span>
                </div>
              )}
              {promoTotal > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>Khuyến mãi</span><span>-{fmt(promoTotal)}</span>
                </div>
              )}
              {surchargeNum > 0 && (
                <div className="flex justify-between text-orange-500">
                  <span>Phụ phí</span><span>+{fmt(surchargeNum)}</span>
                </div>
              )}
              {/* Thay đoạn exclusiveVatTotal hiện tại bằng: */}
              {inclusiveVatTotal > 0 && (
                <div className="flex justify-between text-faint text-[10px]">
                  <span>VAT (đã bao gồm trong giá)</span>
                  <span>{fmt(inclusiveVatTotal)}</span>
                </div>
              )}
              {exclusiveVatTotal > 0 && (
                <div className="flex justify-between text-muted text-[10px]">
                  <span>VAT (ngoài giá)</span>
                  <span>+{fmt(exclusiveVatTotal)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-ink pt-1 border-t border-line-soft">
                <span>Tổng cộng</span>
                <span className="text-gold">{fmt(total)}</span>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || cartItems.length === 0}
              className="w-full py-3 rounded-xl bg-gold text-white font-bold text-sm hover:bg-gold-strong transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
      {/* Product search modal */}
      {productSearchOpen && (
        <ProductSearchModal open={productSearchOpen} warehouseId={draft?.warehouseId}
          onClose={() => setProductSearchOpen(false)} onSelect={handleProductSelect} />
      )}
      {/* Customer search modal */}
      {customerModalOpen && (
        <CustomerSearchModal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)}
          onSelect={(c) => { setCustomer(c); setCustomerModalOpen(false); }} />
      )}
      {/* Sale type modal */}
      {pendingSaleProduct && (
        <SaleTypeModal product={pendingSaleProduct} customer={null}
          onConfirm={({ saleType }) => {
            if (pendingSaleProduct.priceTiers?.length > 0) {
              setTierModalProduct({ ...pendingSaleProduct, _saleType: saleType }); setTierModalCartId(null);
            } else {
              const upb = (saleType === 'BOX' && pendingSaleProduct.unitsPerBox > 0) ? pendingSaleProduct.unitsPerBox : 1;
              addToCartDirect(pendingSaleProduct, saleType, 'BASE', null, null, pendingSaleProduct.basePrice * upb);
            }
            setPendingSaleProduct(null);
          }}
          onClose={() => setPendingSaleProduct(null)} />
      )}
      {/* Tier select modal */}
      {tierModalProduct && (
        <TierSelectModal product={tierModalProduct}
          currentTierId={tierModalCartId ? cartItems.find(i => i.id === tierModalCartId)?.tierId : null}
          currentPriceSource={tierModalCartId ? cartItems.find(i => i.id === tierModalCartId)?.priceSource : 'BASE'}
          onConfirm={handleTierConfirm}
          onClose={() => { setTierModalProduct(null); setTierModalCartId(null); }} />
      )}
    </>
  );
}
// ─── Main page ────────────────────────────────────────────────────────────────
export default function DraftOrdersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLang();
  const { user } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [orderingId, setOrderingId] = useState(null);
  const [invoicingId, setInvoicingId] = useState(null);
  const [holdState, setHoldState] = useState(null);
  const [warning, setWarning] = useState({ open: false, type: 'stock', items: [] });
  const [orderInfoModal, setOrderInfoModal] = useState({ open: false, draft: null });
  const [editDraftModal, setEditDraftModal] = useState({ open: false, draft: null });
  const [stockErrorMessage, setStockErrorMessage] = useState(null);
  const wsRef = useRef(null);
  const hasScheduled = drafts.some(d => d.type === 'SCHEDULED' && d.scheduledAt);
  const now = useNow(hasScheduled);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await draftApi.getAll();
      setDrafts(res.data?.data || res.data || []);
    } catch {
      toast('Không thể tải danh sách đơn nháp', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { return () => { try { wsRef.current?.disconnect?.(); } catch (_) { } }; }, []);
  const connectWs = useCallback((warehouseId) => {
    if (!warehouseId) return;
    const go = async () => {
      if (!window.SockJS) await new Promise(res => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.6.1/sockjs.min.js'; s.onload = res; document.head.appendChild(s); });
      if (!window.Stomp) await new Promise(res => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js'; s.onload = res; document.head.appendChild(s); });
      const token = localStorage.getItem('token');
      const client = window.Stomp.over(new window.SockJS(`${BASE_URL}/ws`));
      client.debug = null;
      client.connect({ Authorization: `Bearer ${token}` }, () => { wsRef.current = client; });
    };
    go();
  }, []);
  const handleDelete = async (draftId) => {
    if (!window.confirm('Xóa đơn nháp này?')) return;
    try {
      await draftApi.delete(draftId);
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      toast('Đã xóa đơn nháp', 'success');
    } catch { toast('Không thể xóa đơn nháp', 'error'); }
  };
  const handleInvoice = async (draftId) => {
    setInvoicingId(draftId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/api/seller/drafts/${draftId}/invoice`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Lỗi tạo phiếu');
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { toast('Lỗi khi tạo phiếu đặt hàng', 'error'); }
    finally { setInvoicingId(null); }
  };
  const handleContinue = async (draft) => {
    setProcessingId(draft.id);
    try {
      const stockRes = await draftApi.checkStock(draft.id);
      const stockBody = stockRes.data?.data || stockRes.data;
      if (!stockBody?.sufficient) { setWarning({ open: true, type: 'stock', items: stockBody?.outOfStockItems || [] }); return; }
      if (draft.warehouseId) connectWs(draft.warehouseId);
      navigate('/seller/pos', { state: { draft, fromDraftHold: true, expiresAt: Date.now() + HOLD_TIMEOUT_MS } });
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi kiểm tra tồn kho', 'error'); }
    finally { setProcessingId(null); }
  };
  const handleOrder = async (draft) => {
    setOrderingId(draft.id);
    try {
      const stockRes = await draftApi.checkStock(draft.id);
      const stockBody = stockRes.data?.data || stockRes.data;
      if (!stockBody?.sufficient) { setWarning({ open: true, type: 'stock', items: stockBody?.outOfStockItems || [] }); return; }
    } catch (e) { toast(e?.response?.data?.message || 'Lỗi kiểm tra tồn kho', 'error'); return; }
    finally { setOrderingId(null); }
    const needsInfo = !draft.orderedByName || (!draft.deliveryDatetime && !draft.scheduledAt);
    if (needsInfo || !draft.customerId) {
      setOrderInfoModal({ open: true, draft });
    } else {
      const deliveryTs = draft.type === 'SCHEDULED' ? draft.scheduledAt : draft.deliveryDatetime;
      await submitOrder(draft, deliveryTs, draft.orderedByName, draft.showPrices ?? true, null, draft.receiverName || null);
    }
  };
  const submitOrder = async (draft, deliveryDatetime, orderedByName, showPrices, selectedCustomer, receiverName) => {
    setOrderingId(draft.id);
    try {
      const stockRes = await draftApi.checkStock(draft.id);
      const stockBody = stockRes.data?.data || stockRes.data;
      if (!stockBody?.sufficient) { setWarning({ open: true, type: 'stock', items: stockBody?.outOfStockItems || [] }); setOrderInfoModal({ open: false, draft: null }); return; }
      const effectiveCustomer = selectedCustomer || (draft.customerId ? { id: draft.customerId, name: draft.customerName, phone: draft.customerPhone } : null);
      // Chặn tạo đơn khi địa chỉ giao (người nhận vừa chọn hoặc dữ liệu nháp) thiếu tỉnh/phường.
      const effReceiver = effectiveCustomer?.selectedReceiver || {
        receiverAddress: draft.receiverAddress || draft.shippingAddress,
        provinceName: draft.provinceName,
        wardName: draft.wardName,
      };
      if (receiverMissingRegion(effReceiver)) {
        toast(MISSING_REGION_MESSAGE, 'error');
        setOrderInfoModal({ open: false, draft: null });
        return;
      }
      const payload = {
        customerId: effectiveCustomer?.id || null,
        customerName: effectiveCustomer?.contactName || effectiveCustomer?.name || draft.customerName || null,
        customerPhone: effectiveCustomer?.selectedReceiver?.receiverPhone || effectiveCustomer?.phone || draft.customerPhone || null,
        shippingAddress: effectiveCustomer?.selectedReceiver?.receiverAddress || draft.shippingAddress || draft.receiverAddress || '',
        // Ưu tiên tỉnh/phường của người nhận vừa chọn; nếu không có thì giữ theo nháp.
        provinceName: effectiveCustomer?.selectedReceiver?.provinceName || draft.provinceName || null,
        wardName: effectiveCustomer?.selectedReceiver?.wardName || draft.wardName || null,
        receiverName: receiverName || effectiveCustomer?.selectedReceiver?.receiverName || draft.receiverName || draft.customerName || null,
        receiverPhone: effectiveCustomer?.selectedReceiver?.receiverPhone || effectiveCustomer?.phone || draft.receiverPhone || draft.customerPhone || null,
        receiverAddress: effectiveCustomer?.selectedReceiver?.receiverAddress || draft.receiverAddress || draft.shippingAddress || '',
        notes: draft.notes, paymentMethod: draft.paymentMethod || 'CASH',
        discountRate: draft.discountRate || 0,
        discountAmount: Number(draft.discountAmount) > 0 ? draft.discountAmount : undefined,
        surchargeItems: draft.surchargeItems?.filter(i => Number(i.amount) > 0) || [],
        warehouseId: draft.warehouseId, deliveryDatetime: deliveryDatetime ?? null,
        orderedByName: orderedByName || undefined, showPrices, hideAllPrices: draft.hideAllPrices ?? false,
        items: (draft.items || []).map(i => ({
          productId: i.productId, tierId: i.isPromo ? undefined : i.tierId, quantity: i.quantity,
          sentUnitPrice: i.isPromo ? 0 : ((i.saleType === 'BOX' && i.unitsPerBox > 0) ? Number(i.unitPrice) / i.unitsPerBox : Number(i.unitPrice)),
          priceMode: i.isPromo ? 'BASE' : (i.itemDiscountRate > 0 ? 'DISCOUNT_PERCENT' : (i.priceMode || 'BASE')),
          discountPercent: (!i.isPromo && i.itemDiscountRate > 0) ? i.itemDiscountRate : undefined,
          isManualPrice: i.isManualPrice === true, saleType: i.saleType || 'RETAIL',
          notes: i.isPromo ? `[KM]${i.promoNote ? ' ' + i.promoNote : ''}` : (i.notes || undefined),
          vatRate: i.vatRate, vatMode: i.vatMode,
        })),
      };
      const res = await orderApi.create(payload);
      const body = res.data;
      if (body?.code === STOCK_ERROR_CODE || (!body?.success && body?.message?.includes('tồn kho'))) {
        setStockErrorMessage(body?.message || 'Không đủ tồn kho');
        setOrderInfoModal({ open: false, draft: null });
        toast('Không đủ tồn kho, đơn nháp vẫn được giữ nguyên', 'error');
        return;
      }
      if (body?.code === PRICE_CHANGED_CODE) {
        const priceItems = await _buildPriceChangeItems(draft, body.message);
        setWarning({ open: true, type: 'price', items: priceItems });
        setOrderInfoModal({ open: false, draft: null });
        return;
      }
      if (!body?.success) {
        toast(body?.message || 'Lỗi khi tạo đơn hàng', 'error');
        setOrderInfoModal({ open: false, draft: null });
        return;
      }
      await draftApi.delete(draft.id).catch(() => { });
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
      toast(`Đặt hàng thành công: ${body?.data?.orderCode || ''}`, 'success');
      setOrderInfoModal({ open: false, draft: null });
    } catch (err) {
      const body = err?.response?.data;
      if (body?.code === STOCK_ERROR_CODE || body?.message?.includes('tồn kho')) {
        setStockErrorMessage(body?.message || 'Không đủ tồn kho');
        setOrderInfoModal({ open: false, draft: null });
        toast('Không đủ tồn kho, đơn nháp vẫn được giữ nguyên', 'error');
        return;
      }
      if (body?.code === PRICE_CHANGED_CODE) {
        const priceItems = await _buildPriceChangeItems(draft, body.message);
        setWarning({ open: true, type: 'price', items: priceItems });
        setOrderInfoModal({ open: false, draft: null });
        return;
      }
      toast(body?.message || err?.message || 'Lỗi khi đặt hàng', 'error');
    } finally { setOrderingId(null); }
  };
  const _buildPriceChangeItems = async (draft, serverMessage) => {
    try {
      if (!draft.warehouseId) return [{ productName: serverMessage, oldPrice: 0, newPrice: 0 }];
      const freshRes = await productApi.getAll({ page: 0, size: 200, warehouseId: draft.warehouseId });
      const freshProducts = freshRes.data?.data?.content || [];
      const changes = [];
      for (const item of (draft.items || [])) {
        if (item.isManualPrice || item.isPromo) continue;
        const fp = freshProducts.find(p => p.id === item.productId);
        if (!fp) continue;
        let freshPrice, tierName = null;
        if (item.tierId) {
          const ft = fp.priceTiers?.find(t => t.id === item.tierId);
          freshPrice = ft ? Number(ft.price) : Number(fp.basePrice);
          tierName = ft?.tierName || item.tierName;
        } else { freshPrice = Number(fp.basePrice); }
        if (item.saleType === 'BOX' && item.unitsPerBox > 0) freshPrice *= item.unitsPerBox;
        if (Math.abs(freshPrice - Number(item.unitPrice)) > 1) {
          changes.push({ productName: item.productName, tierName, oldPrice: Number(item.unitPrice), newPrice: freshPrice });
        }
      }
      return changes.length > 0 ? changes : [{ productName: serverMessage, oldPrice: 0, newPrice: 0 }];
    } catch { return [{ productName: serverMessage, oldPrice: 0, newPrice: 0 }]; }
  };
  const totalItems = drafts.reduce((s, d) => s + (d.items?.length || 0), 0);
  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-surface border-b border-line-soft px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold-tint border border-gold/20 flex items-center justify-center">
            <FileText size={16} className="text-gold" />
          </div>
          <div>
            <h1 className="text-base font-bold text-ink">Đơn nháp</h1>
            {drafts.length > 0 && <p className="text-[11px] text-muted">{drafts.length} đơn · {totalItems} sản phẩm</p>}
          </div>
        </div>
        <button onClick={load} disabled={loading} className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted hover:bg-surface-2 transition-colors">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="px-4 py-3 border-b border-canvas last:border-0 flex gap-4">
                <div className="h-4 w-24 bg-surface-2 rounded animate-pulse" />
                <div className="h-4 w-32 bg-surface-2 rounded animate-pulse" />
                <div className="h-4 w-20 bg-surface-2 rounded animate-pulse" />
                <div className="h-4 w-28 bg-surface-2 rounded animate-pulse flex-1" />
                <div className="h-7 w-40 bg-surface-2 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
              <Package size={28} className="text-faint" strokeWidth={1.5} />
            </div>
            <p className="text-base font-semibold text-ink-2 mb-1">Chưa có đơn nháp</p>
            <p className="text-sm text-faint mb-6 max-w-xs">Lưu đơn nháp từ trang bán hàng để tiếp tục xử lý sau</p>
            <button onClick={() => navigate('/seller/pos')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold text-white text-sm font-bold hover:bg-[var(--c-gold-strong)] transition-colors shadow-sm">
              <ShoppingCart size={15} /> Đi đến bán hàng
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table view */}
            <div className="hidden md:block bg-surface rounded-2xl border border-line-soft overflow-hidden shadow-sm">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-line-soft bg-surface">
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider w-[22%]">Mã nháp</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider w-[18%]">Khách hàng</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider w-[13%]">Kho</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider">Sản phẩm / Tổng</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider w-[30%]">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map(draft => (
                    <DraftRow
                      key={draft.id} draft={draft} now={now}
                      onDelete={handleDelete} onOrder={handleOrder} onInvoice={handleInvoice}
                      onEdit={(d) => setEditDraftModal({ open: true, draft: d })}
                      processingId={processingId} orderingId={orderingId} invoicingId={invoicingId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {drafts.map(draft => (
                <div key={draft.id} onClick={() => setEditDraftModal({ open: true, draft })}>
                  <DraftCard
                    draft={draft} now={now}
                    onDelete={handleDelete} onOrder={handleOrder} onInvoice={handleInvoice}
                    processingId={processingId} orderingId={orderingId} invoicingId={invoicingId}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <WarningModal open={warning.open} type={warning.type} items={warning.items} onClose={() => setWarning({ open: false, type: 'stock', items: [] })} />
      <OrderInfoModal open={orderInfoModal.open} draft={orderInfoModal.draft} onClose={() => setOrderInfoModal({ open: false, draft: null })}
        onConfirm={(ts, name, show, customer, receiverName) => submitOrder(orderInfoModal.draft, ts, name, show, customer, receiverName)} />
      <EditDraftModal open={editDraftModal.open} draft={editDraftModal.draft} onClose={() => setEditDraftModal({ open: false, draft: null })}
        onSaved={() => { setEditDraftModal({ open: false, draft: null }); load(); }} />
      {holdState && (
        <HoldOverlay expiresAt={holdState.expiresAt}
          onExpired={async () => { await cartHoldApi.release().catch(() => { }); setHoldState(null); toast('Hết giờ giữ tồn kho', 'warning'); }}
          onCancel={async () => { await cartHoldApi.release().catch(() => { }); setHoldState(null); toast('Đã hủy giữ tồn kho', 'info'); }} />
      )}
      <StockErrorBanner message={stockErrorMessage} onClose={() => setStockErrorMessage(null)} />
    </div>
  );
}