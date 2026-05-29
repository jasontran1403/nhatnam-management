import { useLang } from '../../context/LangContext';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sk, TableSkeleton } from '../../components/ui/Skeleton.jsx';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  Search, UserPlus, UserCheck, ShoppingBag, Trash2,
  ChevronDown, X, Receipt, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle,
  FileText, Save,
} from 'lucide-react';
import { productApi, categoryApi, orderApi, warehouseApi, draftApi } from '../../api/services';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import ProductCard from '../../components/seller/ProductCard';
import CartItem from '../../components/seller/CartItem';
import CustomerSearchModal from '../../components/seller/CustomerSearchModal';
import SaleTypeModal from '../../components/seller/SaleTypeModal';

const PRICE_CHANGED_CODE = 950;
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const cartHoldApi = {
  update: (warehouseId, items) =>
    api.post('/api/seller/cart-hold/update', { warehouseId, items }),
  release: () => api.post('/api/seller/cart-hold/release'),
  getHeld: (warehouseId, ingredientIds) =>
    api.post('/api/seller/cart-hold/held-quantities', { warehouseId, ingredientIds }),
};

function formatPrice(price) {
  const num = price || 0;
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num) + ' đ';
}

let cartIdCounter = 0;
const newCartId = () => ++cartIdCounter;

function resolveTierForQty(tiers, qty, fallbackPrice) {
  if (!tiers || tiers.length === 0) return null;
  const active = tiers.filter(t => t.isActive !== false);
  if (active.length === 0) return null;
  const sorted = [...active].sort(
    (a, b) => (Number(a.minQuantity) || 0) - (Number(b.minQuantity) || 0)
  );
  let matched = sorted[0];
  for (const t of sorted) {
    if (Number(t.minQuantity ?? 0) <= qty) matched = t;
    else break;
  }
  return { tierId: matched.id, tierName: matched.tierName, unitPrice: Number(matched.price ?? fallbackPrice) };
}

// ── Helper: tính giá theo pricingType của khách hàng ─────────────────────────
// Trả về { unitPrice, tierId, tierName } để dùng cho cả addToCart và updateQty
// product: ProductResponse (có .basePrice, .priceTiers)
// customer: CustomerResponse (có .pricingType) — null = chưa chọn khách
// qty: số lượng lẻ (đã quy đổi từ thùng nếu cần)
// saleType: 'BOX' | 'RETAIL'
// unitsPerBox: số lẻ / thùng
function resolveUnitPrice(product, customer, qty, saleType = 'RETAIL', unitsPerBox = null) {
  const isWholesale = customer?.pricingType === 'WHOLESALE_PRICE';
  const tiers = product.priceTiers || [];

  // Quy đổi qty thùng → đơn vị lẻ để tra tier
  const effectiveQty = (saleType === 'BOX' && unitsPerBox > 0)
    ? qty * unitsPerBox
    : qty;

  if (isWholesale && tiers.length > 0) {
    const r = resolveTierForQty(tiers, effectiveQty, product.basePrice ?? 0);
    const tierPriceLe = r?.unitPrice ?? product.basePrice ?? 0;
    return {
      unitPrice: saleType === 'BOX' ? tierPriceLe * unitsPerBox : tierPriceLe,
      tierId: r?.tierId ?? null,
      tierName: r?.tierName ?? null,
    };
  }

  // RETAIL_PRICE hoặc chưa có khách → basePrice
  const basePrice = product.basePrice ?? 0;
  return {
    unitPrice: saleType === 'BOX' ? basePrice * unitsPerBox : basePrice,
    tierId: null,
    tierName: null,
  };
}

function parseChangedProductName(message) {
  const m = message?.match(/Giá '(.+?)' đã thay đổi/);
  return m ? m[1] : null;
}

function VatBreakdownDisplay({ breakdown, infoOnly }) {
  const { t } = useLang();
  if (!breakdown || breakdown.length === 0) return null;
  const totalVat = breakdown.reduce((s, g) => s + g.vatAmt, 0);
  return (
    <div>
      <div className="flex justify-between text-xs text-[#C4B9A8]">
        <span>VAT {infoOnly ? t('misc','vat_inclusive') : ''}</span>
        <span>{formatPrice(totalVat)}</span>
      </div>
      <div className="pl-3 mt-0.5 space-y-0.5">
        {breakdown.map(g => (
          <div key={`${g.rate}-${g.mode}`} className="flex justify-between items-center">
            <span className="text-[10px] text-[#C4B9A8]">
              • {g.rate}% ({g.mode === 'EXCLUSIVE' ? t('misc','vat_exclusive') : t('misc','vat_inclusive')})
            </span>
            <span className="text-[10px] text-[#C4B9A8]">
              {g.mode === 'EXCLUSIVE' ? '+' : ''}{formatPrice(g.vatAmt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartPanel({
  cartItems, customer, notes, paymentMethod, discount, surchargeDisplay,
  surcharge, subtotal, discountAmt, surchargeNum, vatBreakdown, exclusiveVatTotal,
  itemDiscountTotal, totalDiscount, promoTotal,
  total, submitting, priceChangedIds,
  selectedWarehouse,
  discountFixedAmt, discountFixedDisplay, maxDiscountFixed,
  onDiscountFixedOpen, onDiscountFixedChange, onDiscountFixedClear,
  onOpenCustomerModal, onClearCustomer, onClearCart, onNotesChange,
  onPaymentChange, onDiscountChange, onSurchargeChange, onUpdateQty,
  onRemoveItem, onPriceOverride, onItemDiscountChange, onPromoToggle, onSubmit,
  onSaveDraft, savingDraft,
}) {
  const { t } = useLang();
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-[#F0EBE3] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-[#C9A84C]" />
          <span className="font-semibold text-sm text-[#1C1C1E]">{t('order','order')}</span>
          {cartItems.length > 0 && (
            <span className="bg-[#C9A84C] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {cartItems.length}
            </span>
          )}
        </div>
        {cartItems.length > 0 && (
          <button onClick={onClearCart} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600">
            <Trash2 size={11} /> {t('common','delete')}
          </button>
        )}
      </div>

      {priceChangedIds.size > 0 && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-amber-700">Giá sản phẩm đã thay đổi</p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              Giá mới đã được cập nhật vào giỏ hàng. Vui lòng xem lại trước khi đặt.
            </p>
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-b border-[#F0EBE3]">
        <button
          onClick={onOpenCustomerModal}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm transition-all
            ${customer
              ? 'border-[#C9A84C] bg-[#C9A84C]/5'
              : 'border-dashed border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}
        >
          {customer ? (
            <>
              <UserCheck size={15} className="text-[#C9A84C] shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-xs truncate">{customer.contactName || customer.name}</p>
                <p className="text-[10px] text-[#8E8878]">{customer.customerCode} · {customer.phone}</p>
                {customer.pricingType === 'WHOLESALE_PRICE' && (
                  <p className="text-[10px] text-sky-600 font-semibold">🏷 Giá sỉ (khung giá)</p>
                )}
                {customer.selectedReceiver && (
                  <p className="text-[10px] text-[#C9A84C] truncate">
                    📦 {customer.selectedReceiver.receiverAddress || '—'}
                    {(customer.selectedReceiver.receiverName || customer.selectedReceiver.receiverPhone) && (
                      <span className="text-[#A08030]"> · {[customer.selectedReceiver.receiverName, customer.selectedReceiver.receiverPhone].filter(Boolean).join(' · ')}</span>
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClearCustomer(); }}
                className="text-[#8E8878] hover:text-red-400 shrink-0"
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <><UserPlus size={15} /><span className="text-xs">Chọn khách hàng *</span></>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#C4B9A8] gap-2 py-8">
            <ShoppingBag size={32} strokeWidth={1} />
            <p className="text-sm">Chưa có món</p>
          </div>
        ) : (
          cartItems.map((item) => {
            const isPriceChanged = priceChangedIds.has(item.productId);
            return (
              <div key={item.id} className={isPriceChanged ? 'rounded-xl ring-2 ring-amber-400 ring-offset-1 my-1' : ''}>
                {isPriceChanged && (
                  <div className="flex items-center gap-1.5 px-3 pt-2">
                    <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                    <span className="text-[10px] text-amber-600 font-semibold">Giá đã được cập nhật</span>
                  </div>
                )}
                <CartItem
                  item={item}
                  onUpdate={onUpdateQty}
                  onRemove={onRemoveItem}
                  onPriceOverride={onPriceOverride}
                  onDiscountChange={onItemDiscountChange}
                  onPromoToggle={onPromoToggle}
                />
              </div>
            );
          })
        )}
      </div>

      {cartItems.length > 0 && (
        <div className="border-t border-[#F0EBE3] px-4 py-3 space-y-2">
          <textarea
            placeholder="Ghi chú đơn hàng..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            className="input-elegant w-full rounded-lg px-3 py-2 text-xs resize-none"
          />
          <div className="flex gap-1.5">
            {[
              ['CASH', '💵 Tiền mặt'],
              ['BANK_TRANSFER', '🏦 Chuyển khoản'],
              ['DEBT', '📋 Công nợ'],
            ].map(([val, label]) => (
              <button key={val} onClick={() => onPaymentChange(val)}
                className={`flex-1 text-[10px] py-1.5 rounded-lg border font-medium transition-colors
                  ${paymentMethod === val
                    ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                    : 'border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8E8878] shrink-0">Giảm giá:</span>
            <div className="flex items-center gap-1 flex-wrap">
              {[0, 5, 8, 10].map((d) => (
                <button key={d} onClick={() => onDiscountChange(d)}
                  className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors
                    ${discount === d && discountFixedAmt === null
                      ? 'bg-[#C9A84C] text-white'
                      : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
                  {d}%
                </button>
              ))}
              {discountFixedAmt === null ? (
                <button onClick={onDiscountFixedOpen}
                  className="text-[10px] px-2 py-1 rounded-md font-semibold transition-colors bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]">
                  Nhập tiền
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <input
                      type="text" inputMode="numeric"
                      value={discountFixedDisplay}
                      onChange={onDiscountFixedChange}
                      placeholder={`tối đa ${new Intl.NumberFormat('vi-VN').format(maxDiscountFixed)}`}
                      className="input-elegant w-28 rounded-md px-2 py-1 text-[10px] text-right pr-5 border border-[#C9A84C] bg-[#C9A84C]/5 font-semibold text-[#C9A84C]"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[#8E8878]">đ</span>
                  </div>
                  <button onClick={onDiscountFixedClear}
                    className="text-[10px] px-1.5 py-1 rounded-md bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0] font-semibold">
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8E8878] shrink-0">Phụ phí:</span>
            <div className="relative flex-1">
              <input
                type="text" inputMode="numeric"
                value={surchargeDisplay} onChange={onSurchargeChange}
                placeholder="0"
                className="input-elegant w-full rounded-lg px-3 py-1.5 text-xs text-right pr-7"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#8E8878]">đ</span>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pb-4 pt-2 border-t border-[#F0EBE3] bg-white">
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-xs text-[#8E8878]">
            <span>Tạm tính</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {(itemDiscountTotal > 0 || discountAmt > 0 || promoTotal > 0) && (
            <div>
              <div className="flex justify-between text-xs text-emerald-600">
                <span>Giảm</span>
                <span>-{formatPrice(itemDiscountTotal + discountAmt + promoTotal)}</span>
              </div>
              <div className="pl-3 mt-0.5 space-y-0.5">
                {itemDiscountTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[10px] text-emerald-600">• CK món</span>
                    <span className="text-[10px] text-emerald-600">-{formatPrice(itemDiscountTotal)}</span>
                  </div>
                )}
                {discountAmt > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[10px] text-emerald-600">
                      {discountFixedAmt !== null ? '• Giảm trực tiếp' : `• Giảm bill (${discount}%)`}
                    </span>
                    <span className="text-[10px] text-emerald-600">-{formatPrice(discountAmt)}</span>
                  </div>
                )}
                {promoTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[10px] text-rose-500">• Khuyến mãi</span>
                    <span className="text-[10px] text-rose-500">-{formatPrice(promoTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {surchargeNum > 0 && (
            <div className="flex justify-between text-xs text-orange-500">
              <span>Phụ phí</span>
              <span>+{formatPrice(surchargeNum)}</span>
            </div>
          )}
          {vatBreakdown.length > 0 && (
            <div className="pt-1 border-t border-dashed border-[#F0EBE3]">
              <VatBreakdownDisplay breakdown={vatBreakdown} infoOnly />
            </div>
          )}
          <div className="flex justify-between font-bold text-sm text-[#1C1C1E] pt-1 border-t border-[#F0EBE3]">
            <span>Tổng cộng</span>
            <span className="text-[#C9A84C]">{formatPrice(total)}</span>
          </div>
        </div>

        {cartItems.length > 0 && (
          <button
            onClick={onSaveDraft}
            disabled={savingDraft || submitting}
            className="w-full rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2
              border-2 border-[#C9A84C] text-[#C9A84C] hover:bg-[#FDF8ED] disabled:opacity-40 disabled:cursor-not-allowed transition-colors mb-2"
          >
            {savingDraft
              ? <><div className="w-3.5 h-3.5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" /> Đang lưu...</>
              : <><Save size={14} /> Lưu nháp</>}
          </button>
        )}

        <button
          onClick={onSubmit}
          disabled={submitting || cartItems.length === 0 || !customer || !selectedWarehouse}
          className={`w-full rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors
            ${priceChangedIds.size > 0
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'btn-gold'}`}
        >
          {submitting ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang xử lý...</>
          ) : priceChangedIds.size > 0 ? (
            <><AlertTriangle size={15} /> Xác nhận giá mới & Đặt hàng</>
          ) : (
            <><Receipt size={15} /> Tạo đơn hàng</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useCartHold
// ─────────────────────────────────────────────────────────────────────────────
function useCartHold(warehouseId, cartItems, products, _userId, onCartExpired) {
  const [heldByAll, setHeldByAll] = useState({});
  const wsRef = useRef(null);
  const subscriptionsRef = useRef([]);
  const debounceRef = useRef(null);
  const lastCartRef = useRef([]);
  const onCartExpiredRef = useRef(onCartExpired);
  useEffect(() => { onCartExpiredRef.current = onCartExpired; }, [onCartExpired]);

  useEffect(() => {
    if (!warehouseId) return;

    async function connect() {
      if (!window.SockJS || !window.Stomp) return;
      const token = localStorage.getItem('token');
      const sock = new window.SockJS(`${BASE_URL}/ws`);
      const client = window.Stomp.over(sock);
      client.debug = null;

      client.connect({ Authorization: `Bearer ${token}` }, () => {
        wsRef.current = client;

        const stockSub = client.subscribe(`/topic/stock/${warehouseId}`, (frame) => {
          try {
            const { ingredientId, heldQty } = JSON.parse(frame.body);
            setHeldByAll(prev => ({
              ...prev,
              [String(ingredientId)]: Number(heldQty) || 0,
            }));
          } catch (_) { }
        });

        const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
        const myUserId = storedUser?.userId;

        const cartEventSub = client.subscribe('/topic/cart-events', (frame) => {
          try {
            const { event, sellerId } = JSON.parse(frame.body);
            if (event === 'CART_EXPIRED' && sellerId === myUserId) {
              onCartExpiredRef.current?.();
            }
          } catch (_) { }
        });

        subscriptionsRef.current = [stockSub, cartEventSub];
      });
    }

    const loadAndConnect = async () => {
      if (!window.SockJS) {
        await new Promise((res) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.6.1/sockjs.min.js';
          s.onload = res; document.head.appendChild(s);
        });
      }
      if (!window.Stomp) {
        await new Promise((res) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js';
          s.onload = res; document.head.appendChild(s);
        });
      }
      connect();
    };

    loadAndConnect();

    return () => {
      subscriptionsRef.current.forEach(s => { try { s.unsubscribe?.(); } catch (_) { } });
      subscriptionsRef.current = [];
      try { wsRef.current?.disconnect?.(); } catch (_) { }
      wsRef.current = null;
      setHeldByAll({});
    };
  }, [warehouseId]);

  useEffect(() => {
    if (!warehouseId) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const ingMap = {};
      for (const item of cartItems) {
        const prod = products.find(p => p.id === item.productId);
        if (!prod?.ingredients?.length) continue;
        const effectiveQty = (item.saleType === 'BOX' && item.unitsPerBox > 0)
          ? item.quantity * item.unitsPerBox
          : item.quantity;
        for (const ing of prod.ingredients) {
          const qtyPerUnit = Number(ing.quantity) || 1;
          ingMap[ing.ingredientId] = (ingMap[ing.ingredientId] || 0) + effectiveQty * qtyPerUnit;
        }
      }
      const holdItems = Object.entries(ingMap).map(([ingredientId, qty]) => ({
        ingredientId: Number(ingredientId),
        qty,
      }));
      try {
        if (holdItems.length > 0) {
          await cartHoldApi.update(warehouseId, holdItems);
        } else if (lastCartRef.current.length > 0) {
          await cartHoldApi.release();
        }
      } catch (_) { }
      lastCartRef.current = cartItems;
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [warehouseId, cartItems, products]);

  useEffect(() => {
    return () => { cartHoldApi.release().catch(() => { }); };
  }, []);

  return { heldByAll };
}

// ─────────────────────────────────────────────────────────────────────────────
// DeliveryTimeModal
// ─────────────────────────────────────────────────────────────────────────────
function DeliveryTimeModal({ onConfirm, onClose }) {
  const defaultDelivery = (() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0); return d;
  })();

  const [deliveryDate, setDeliveryDate] = useState(defaultDelivery);
  const [orderedBy, setOrderedBy] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [showPrices, setShowPrices] = useState(true);

  const handleConfirm = () => {
    const ts = deliveryDate ? deliveryDate.getTime() : null;
    onConfirm(ts, orderedBy.trim() || null, showPrices, recipientName.trim() || null);
  };

  const [DTPicker, setDTPicker] = useState(null);
  useEffect(() => {
    import('../../components/ui/DateTimePicker').then(m => setDTPicker(() => m.default));
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn overflow-hidden">
        <div className="bg-gradient-to-r from-[#C9A84C] to-[#b8963d] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Xác nhận đơn hàng</p>
            <h3 className="text-white font-bold text-base mt-0.5">Thông tin giao hàng</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">
              👤 Tên người đặt hàng
            </label>
            <input type="text" value={orderedBy} onChange={e => setOrderedBy(e.target.value)}
              placeholder="Nhập tên người đặt (nếu có)..."
              className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C] transition-colors bg-[#FAFAF8] placeholder:text-[#C4B9A8]" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">
              📦 Tên người nhận hàng
            </label>
            <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)}
              placeholder="Nhập tên người nhận (để trống nếu không có)..."
              className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm text-[#1C1C1E] focus:outline-none focus:border-[#C9A84C] transition-colors bg-[#FAFAF8] placeholder:text-[#C4B9A8]" />
            <p className="text-[10px] text-[#C4B9A8] mt-1">Để trống nếu không cần ghi tên người nhận trên phiếu</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">
              🕐 Ngày & giờ giao hàng
            </label>
            {DTPicker
              ? <DTPicker value={deliveryDate} onChange={setDeliveryDate} minDate={new Date()} placeholder="Chọn ngày & giờ giao hàng" />
              : <div className="h-11 rounded-xl border-2 border-[#E8DDD0] animate-pulse bg-[#FAFAF8]" />
            }
          </div>
        </div>

        <div className="px-5 pb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0
              ${showPrices ? 'bg-[#C9A84C]' : 'bg-[#D0C9BE]'}`}
              onClick={() => setShowPrices(p => !p)}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                ${showPrices ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-xs font-semibold text-[#1C1C1E]">
              Hiển thị giá trên phiếu đặt hàng
            </span>
          </label>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-[#8E8878] text-sm font-semibold hover:bg-[#F0EBE3] transition-colors">
            Hủy
          </button>
          <button onClick={handleConfirm} disabled={!deliveryDate}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-bold
              hover:bg-[#b8963d] disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors flex items-center justify-center gap-2">
            <Receipt size={15} /> Tạo đơn hàng
          </button>
        </div>
      </div>
    </div>
  );
}


export default function POSPage() {
  const { t } = useLang();
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useMinLoading();

  const [inputSearch, setInputSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const [cartItems, setCartItems] = useState([]);
  const [customer, setCustomerState] = useState(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [discount, setDiscount] = useState(0);
  const [discountFixedAmt, setDiscountFixedAmt] = useState(null);
  const [discountFixedDisplay, setDiscountFixedDisplay] = useState('');

  const [surcharge, setSurcharge] = useState(0);
  const [surchargeDisplay, setSurchargeDisplay] = useState('');
  const surchargeDebounceRef = useRef(null);

  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);

  const [priceChangedIds, setPriceChangedIds] = useState(new Set());
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  // Ref để updateQty và các callback khác luôn đọc được customer mới nhất
  const customerRef = useRef(null);
  const productsRef = useRef([]);

  useEffect(() => { customerRef.current = customer; }, [customer]);
  useEffect(() => { productsRef.current = products; }, [products]);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(inputSearch), 600);
    return () => clearTimeout(t);
  }, [inputSearch]);

  const handleCartExpired = useCallback(() => {
    setCartItems([]);
    setCustomerState(null);
    setNotes('');
    setDiscount(0);
    setSurcharge(0);
    setSurchargeDisplay('');
    setPriceChangedIds(new Set());
    setHoldExpiresAt(null);
    if (currentDraftId) {
      toast('Giỏ hàng đã hết hạn. Đơn nháp vẫn được lưu.', 'warning');
      navigate('/seller/drafts');
    } else {
      toast('Giỏ hàng đã hết hạn (3 phút không thanh toán). Vui lòng đặt lại.', 'warning');
    }
  }, [toast, currentDraftId, navigate]);

  useEffect(() => {
    if (!holdExpiresAt) return;
    const left = holdExpiresAt - Date.now();
    if (left <= 0) {
      cartHoldApi.release().catch(() => { });
      setHoldExpiresAt(null);
      toast('Hết giờ giữ tồn kho. Đơn nháp vẫn được lưu.', 'warning');
      navigate('/seller/drafts');
      return;
    }
    const id = setTimeout(async () => {
      await cartHoldApi.release().catch(() => { });
      setHoldExpiresAt(null);
      setCartItems([]);
      setCustomerState(null);
      setNotes('');
      setDiscount(0);
      setSurcharge(0);
      setSurchargeDisplay('');
      toast('Hết giờ giữ tồn kho (10 phút). Đơn nháp vẫn được lưu.', 'warning');
      navigate('/seller/drafts');
    }, left);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdExpiresAt]);

  const { heldByAll } = useCartHold(
    selectedWarehouse?.id,
    cartItems,
    products,
    user?.userId,
    handleCartExpired,
  );

  const ingStockMap = useMemo(() => {
    const map = {};
    for (const p of products) {
      if (!p.ingredients?.length) continue;
      for (const ing of p.ingredients) {
        const key = String(ing.ingredientId);
        if (map[key] == null) {
          const actualStock = Number(ing.stockQuantity);
          const held = Number(heldByAll[key] || 0);
          map[key] = Math.max(0, actualStock - held);
        }
      }
    }
    return map;
  }, [products, heldByAll]);

  const calcEffectiveStock = useCallback((product) => {
    if (product.stockQuantity == null) return null;
    if (!product.ingredients?.length) return Number(product.stockQuantity);

    let minCanMake = Infinity;
    for (const ing of product.ingredients) {
      const qtyPerProduct = Number(ing.quantity) || 1;
      const ingKey = String(ing.ingredientId);
      const ingAvailable = ingStockMap[ingKey] ?? 0;
      const canMake = Math.floor((Math.max(0, ingAvailable) / qtyPerProduct) * 1000) / 1000;
      minCanMake = Math.min(minCanMake, canMake);
    }

    return minCanMake === Infinity ? Number(product.stockQuantity) : minCanMake;
  }, [products, cartItems, ingStockMap]);

  useEffect(() => {
    warehouseApi.getAll()
      .then(res => {
        const list = res.data?.data || res.data || [];
        setWarehouses(list);
        if (list.length > 0) setSelectedWarehouse(list[0]);
      })
      .catch(() => toast('Không thể tải danh sách kho', 'error'));
  }, []);

  // ─── Load draft từ navigation state ──────────────────────────────────────
  useEffect(() => {
    const draft = location.state?.draft;
    const fromDraftHold = location.state?.fromDraftHold;
    const expiresAt = location.state?.expiresAt;
    if (!draft) return;

    if (draft.items?.length > 0) {
      const items = draft.items.map((i) => ({
        id: ++cartIdCounter,
        productId: i.productId,
        productName: i.productName,
        productImageUrl: i.productImageUrl,
        variantId: i.variantId,
        unit: i.unit,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        basePrice: Number(i.basePrice || i.unitPrice),
        priceMode: i.priceMode || 'BASE',
        tierId: i.tierId,
        tierName: i.tierName,
        discountPercent: i.discountPercent,
        isManualPrice: i.isManualPrice,
        saleType: i.saleType || 'RETAIL',
        unitsPerBox: i.unitsPerBox,
        isPromo: i.isPromo,
        promoNote: i.promoNote,
        itemDiscountRate: i.itemDiscountRate || 0,
        notes: i.notes,
        subtotal: Number(i.subtotal || 0),
        tiers: [],
      }));
      setCartItems(items);
    }

    if (draft.customerId) {
      setCustomerState({
        id: draft.customerId,
        name: draft.customerName,
        phone: draft.customerPhone,
        email: draft.customerEmail,
        contactName: draft.customerName,
        customerCode: '',
      });
    }

    if (draft.notes) setNotes(draft.notes);
    if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
    if (draft.discountRate) setDiscount(draft.discountRate);
    if (draft.discountAmount) {
      setDiscountFixedAmt(Number(draft.discountAmount));
      setDiscountFixedDisplay(new Intl.NumberFormat('vi-VN').format(Number(draft.discountAmount)));
    }
    if (draft.surcharge) setSurcharge(Number(draft.surcharge));

    if (fromDraftHold && expiresAt) {
      setHoldExpiresAt(expiresAt);
    }

    toast('Đã tải đơn nháp vào giỏ hàng', 'success');
    setCurrentDraftId(draft.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Khi đổi khách hàng: tính lại giá toàn bộ giỏ hàng ───────────────────
  // - isManualPrice = true → bỏ qua
  // - isPromo = true → bỏ qua
  // - Còn lại: tính lại theo pricingType của customer mới
  const setCustomer = useCallback((newCustomer) => {
    setCustomerState(newCustomer);
    setCartItems(prev => prev.map(item => {
      // Bỏ qua override và promo
      if (item.isManualPrice || item.isPromo) return item;

      const prod = productsRef.current.find(p => p.id === item.productId);
      if (!prod) return item;

      const { unitPrice, tierId, tierName } = resolveUnitPrice(
        prod,
        newCustomer,
        item.quantity,
        item.saleType,
        item.unitsPerBox,
      );

      return {
        ...item,
        unitPrice,
        originalUnitPrice: unitPrice,
        tierId,
        tierName,
      };
    }));
  }, []);

  const handleDiscountFixedOpen = useCallback(() => {
    setDiscount(0);
    setDiscountFixedAmt(0);
    setDiscountFixedDisplay('');
  }, []);

  const handleDiscountFixedClear = useCallback(() => {
    setDiscountFixedAmt(null);
    setDiscountFixedDisplay('');
  }, []);

  const handleDiscountFixedChange = useCallback((e) => {
    const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    setDiscountFixedDisplay(raw);
    const num = raw === '' ? 0 : parseFloat(raw);
    setDiscountFixedAmt(isNaN(num) ? 0 : num);
  }, []);

  const handleSurchargeChange = useCallback((e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setSurchargeDisplay(raw);
    clearTimeout(surchargeDebounceRef.current);
    surchargeDebounceRef.current = setTimeout(() => {
      const num = raw === '' ? 0 : parseInt(raw, 10);
      setSurcharge(num);
      setSurchargeDisplay(num > 0 ? new Intl.NumberFormat('vi-VN').format(num) : '');
    }, 600);
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!selectedWarehouse?.id) return null;
    try {
      const res = await productApi.getAll({ page: 0, size: 200, warehouseId: selectedWarehouse.id });
      return res.data?.data?.content || [];
    } catch {
      return null;
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    if (!selectedWarehouse) return;
    setLoadingProducts(true);
    productApi.getAll({ page: 0, size: 200, warehouseId: selectedWarehouse.id })
      .then(res => setProducts(res.data?.data?.content || []))
      .catch(() => toast('Không thể tải sản phẩm', 'error'))
      .finally(() => setLoadingProducts(false));
  }, [selectedWarehouse]);

  useEffect(() => {
    categoryApi.getAll()
      .then(res => setCategories(res.data?.data || res.data || []))
      .catch(() => { });
  }, []);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory !== 'ALL')
      list = list.filter((p) => p.categoryId == activeCategory || p.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name?.toLowerCase().includes(q));
    }
    if (sortField) {
      list = [...list].sort((a, b) => {
        if (sortField === 'name') {
          const aV = a.name?.toLowerCase() ?? '', bV = b.name?.toLowerCase() ?? '';
          return sortDir === 'asc' ? aV.localeCompare(bV) : bV.localeCompare(aV);
        }
        if (sortField === 'price') {
          const aV = a.priceTiers?.[0]?.price ?? a.basePrice ?? 0;
          const bV = b.priceTiers?.[0]?.price ?? b.basePrice ?? 0;
          return sortDir === 'asc' ? aV - bV : bV - aV;
        }
        return 0;
      });
    }
    return list;
  }, [products, activeCategory, searchQuery, sortField, sortDir]);

  // ── addToCart: tính giá theo customer ────────────────────────────────────
  const addToCart = useCallback((product, saleType = 'RETAIL') => {
    setPriceChangedIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });

    const unitsPerBox = (saleType === 'BOX' && product.unitsPerBox > 0)
      ? product.unitsPerBox : null;

    setCartItems((prev) => {
      const stock = product.stockQuantity != null ? Number(product.stockQuantity) : null;
      if (stock !== null && stock <= 0) return prev;

      const addQty = (stock !== null && stock < 1)
        ? Math.round(stock * 1000) / 1000
        : 1;

      // Tính giá theo customer hiện tại
      const { unitPrice, tierId, tierName } = resolveUnitPrice(
        product,
        customerRef.current,
        addQty,
        saleType,
        unitsPerBox,
      );

      const displayUnit = unitsPerBox ? 'Thùng' : (product.unit || '');
      const uniqueKey = `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      return [...prev, {
        id: newCartId(),
        key: uniqueKey,
        productId: product.id,
        productName: product.name,
        variantId: null,
        variantName: null,
        tierId,
        tierName,
        unitPrice,
        originalUnitPrice: unitPrice,
        quantity: addQty,
        unit: displayUnit,
        imageUrl: product.imageUrl || null,
        vatRate: product.vatRate ?? 0,
        vatMode: product.vatMode ?? 'INCLUSIVE',
        maxDiscountRate: product.maxDiscountRate ?? 0,
        itemDiscountRate: 0,
        priceTiers: product.priceTiers || [],
        basePrice: product.basePrice ?? 0,
        saleType,
        unitsPerBox,
      }];
    });
  }, []);

  const [pendingSaleProduct, setPendingSaleProduct] = useState(null);

  const handleAddProduct = useCallback((product) => {
    const effStock = calcEffectiveStock(product);
    const productWithEffectiveStock = effStock !== null
      ? { ...product, stockQuantity: effStock }
      : product;
    if (product.unitsPerBox && product.unitsPerBox > 0) {
      setPendingSaleProduct(productWithEffectiveStock);
    } else {
      addToCart(productWithEffectiveStock, 'RETAIL');
    }
  }, [addToCart, calcEffectiveStock]);

  // ── updateQty: tính lại giá tier nếu WHOLESALE_PRICE ─────────────────────
  const updateQty = useCallback((cartId, qty) => {
    if (qty <= 0) { setCartItems((prev) => prev.filter((i) => i.id !== cartId)); return; }
    setCartItems((prev) => prev.map((i) => {
      if (i.id !== cartId) return i;

      const prod = productsRef.current.find((p) => p.id === i.productId);
      let cappedQty = qty;
      if (prod) {
        const effStock = calcEffectiveStock(prod);
        if (effStock !== null) {
          cappedQty = Math.min(qty, Math.round((effStock + i.quantity) * 1000) / 1000);
        }
      }

      // Promo: không tính lại giá
      if (i.isPromo) return { ...i, quantity: cappedQty };

      // Manual price override: không tính lại giá
      if (i.isManualPrice) return { ...i, quantity: cappedQty };

      // BOX: giá đã nhân unitsPerBox khi addToCart
      // Vẫn cần tính lại tier nếu WHOLESALE (dựa trên số lẻ tương đương)
      if (i.saleType === 'BOX' && i.unitsPerBox > 0) {
        const currentCustomer = customerRef.current;
        if (currentCustomer?.pricingType === 'WHOLESALE_PRICE' && prod) {
          const { unitPrice, tierId, tierName } = resolveUnitPrice(
            prod, currentCustomer, cappedQty, 'BOX', i.unitsPerBox,
          );
          return { ...i, quantity: cappedQty, unitPrice, originalUnitPrice: unitPrice, tierId, tierName };
        }
        return { ...i, quantity: cappedQty };
      }

      // RETAIL saleType — tính lại theo customer
      const currentCustomer = customerRef.current;
      if (prod) {
        const { unitPrice, tierId, tierName } = resolveUnitPrice(
          prod, currentCustomer, cappedQty, i.saleType, i.unitsPerBox,
        );
        const changed = tierId !== i.tierId || unitPrice !== i.unitPrice;
        return {
          ...i,
          quantity: cappedQty,
          ...(changed ? { unitPrice, originalUnitPrice: unitPrice, tierId, tierName } : {}),
        };
      }

      // Fallback: không có prod trong list → giữ nguyên
      const allTiers = i.priceTiers || [];
      const r = resolveTierForQty(allTiers, cappedQty, i.basePrice ?? i.unitPrice);
      if (!r) return { ...i, quantity: cappedQty };
      const changed = r.tierId !== i.tierId || r.unitPrice !== i.unitPrice;
      return {
        ...i,
        quantity: cappedQty,
        ...(changed ? {
          tierId: r.tierId,
          tierName: r.tierName,
          unitPrice: r.unitPrice,
          originalUnitPrice: r.unitPrice,
        } : {}),
      };
    }));
  }, [calcEffectiveStock]);

  const overridePrice = useCallback((cartId, newPrice, isManual = false) => {
    setCartItems((prev) => prev.map((i) => {
      if (i.id !== cartId) return i;
      return {
        ...i,
        unitPrice: newPrice,
        originalUnitPrice: i.originalUnitPrice ?? i.unitPrice,
        isManualPrice: isManual ? true : i.isManualPrice,
      };
    }));
  }, []);

  const togglePromo = useCallback((cartId, enable, note) => {
    setCartItems((prev) => prev.map((i) => {
      if (i.id !== cartId) return i;
      if (enable) {
        return {
          ...i,
          isPromo: true,
          promoNote: note || '',
          _priceBeforePromo: i._priceBeforePromo ?? i.unitPrice,
        };
      } else {
        return {
          ...i,
          isPromo: false,
          promoNote: '',
          unitPrice: i._priceBeforePromo ?? i.unitPrice,
          _priceBeforePromo: undefined,
        };
      }
    }));
  }, []);

  const removeItem = useCallback((cartId) => {
    setCartItems((prev) => {
      const item = prev.find(i => i.id === cartId);
      if (item) {
        const remaining = prev.filter(i => i.id !== cartId && i.productId === item.productId);
        if (remaining.length === 0)
          setPriceChangedIds(ids => { const n = new Set(ids); n.delete(item.productId); return n; });
      }
      return prev.filter((i) => i.id !== cartId);
    });
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setCustomerState(null);
    setNotes('');
    setDiscount(0);
    setSurcharge(0);
    setSurchargeDisplay('');
    setPriceChangedIds(new Set());
    cartHoldApi.release().catch(() => { });
  }, []);

  const promoTotal = cartItems.reduce((s, i) => {
    if (!i.isPromo) return s;
    const origPrice = Number(i._priceBeforePromo ?? i.unitPrice);
    return s + origPrice * Number(i.quantity);
  }, 0);

  const subtotal = cartItems.reduce((s, i) => {
    if (i.isPromo) return s;
    return s + Number(i.unitPrice) * Number(i.quantity);
  }, 0);

  const itemDiscountTotal = cartItems.reduce((s, i) => {
    if (i.isPromo) return s;
    const d = i.itemDiscountRate ?? 0;
    if (!d) return s;
    return s + Number(i.unitPrice) * (d / 100) * Number(i.quantity);
  }, 0);

  const subtotalAfterItemDiscount = subtotal - itemDiscountTotal;
  const maxDiscountFixed = Math.round(subtotalAfterItemDiscount * 0.1);
  const discountAmt = discountFixedAmt !== null
    ? Math.min(discountFixedAmt, maxDiscountFixed)
    : Math.round(subtotalAfterItemDiscount * discount) / 100;

  const totalDiscount = itemDiscountTotal + discountAmt + promoTotal;
  const surchargeNum = Number(surcharge) || 0;
  const total = subtotal - itemDiscountTotal - discountAmt + surchargeNum;

  const vatBreakdown = useMemo(() => {
    const map = {};
    for (const i of cartItems) {
      const rate = i.vatRate ?? 0;
      const mode = i.vatMode ?? 'INCLUSIVE';
      if (rate === 0 || mode !== 'INCLUSIVE') continue;
      const effDiscountRate = discountFixedAmt !== null
        ? (subtotalAfterItemDiscount > 0 ? Math.min(discountFixedAmt, maxDiscountFixed) / subtotalAfterItemDiscount : 0)
        : discount / 100;
      const lineGross = Number(i.unitPrice) * (1 - (i.itemDiscountRate ?? 0) / 100)
        * Number(i.quantity) * (1 - effDiscountRate);
      const vatAmt = lineGross - lineGross / (1 + rate / 100);
      const key = `${rate}|${mode}`;
      if (!map[key]) map[key] = { rate, mode, vatAmt: 0 };
      map[key].vatAmt += vatAmt;
    }
    return Object.values(map).sort((a, b) => a.rate - b.rate);
  }, [cartItems, discount, discountFixedAmt, maxDiscountFixed, subtotalAfterItemDiscount]);

  const exclusiveVatTotal = 0;

  const handlePriceChanged = useCallback(async (message) => {
    const changedName = parseChangedProductName(message);
    const fresh = await fetchProducts();
    if (!fresh) return;

    setProducts(fresh);
    const newChangedIds = new Set();

    setCartItems(prev => prev.map(item => {
      if (item.isManualPrice) return item;
      if (item.saleType === 'BOX' && item.unitsPerBox > 0) return item;
      const freshProduct = fresh.find(p => p.id === item.productId);
      if (!freshProduct) return item;

      const freshTier = freshProduct.priceTiers?.find(t => t.id === item.tierId)
        || freshProduct.priceTiers?.find(t => t.sortOrder === 0)
        || freshProduct.priceTiers?.[0];
      const freshPrice = Number(freshTier?.price ?? freshProduct.basePrice ?? item.unitPrice);

      if (Math.abs(freshPrice - item.unitPrice) > 1) {
        newChangedIds.add(item.productId);
        return {
          ...item,
          unitPrice: freshPrice,
          originalUnitPrice: freshPrice,
          tierId: freshTier?.id || item.tierId,
          tierName: freshTier?.tierName || item.tierName,
          vatRate: freshProduct.vatRate ?? item.vatRate,
          vatMode: freshProduct.vatMode ?? item.vatMode,
          isManualPrice: false,
        };
      }
      return item;
    }));

    if (newChangedIds.size > 0) setPriceChangedIds(prev => new Set([...prev, ...newChangedIds]));
    toast(
      changedName
        ? `Giá "${changedName}" đã được cập nhật trong giỏ hàng. Vui lòng kiểm tra lại.`
        : 'Một số giá đã thay đổi và được cập nhật trong giỏ hàng.',
      'warning',
    );
  }, [fetchProducts, toast]);

  const handleSaveDraft = useCallback(async () => {
    if (cartItems.length === 0) { toast('Giỏ hàng trống', 'warning'); return; }
    setSavingDraft(true);
    try {
      const payload = {
        customerId: customer?.id || null,
        customerName: customer?.contactName || customer?.name || null,
        customerPhone: customer?.selectedReceiver?.receiverPhone || customer?.phone || null,
        customerEmail: customer?.email || null,
        shippingAddress: customer?.selectedReceiver?.receiverAddress || null,
        notes,
        paymentMethod,
        discountRate: discountFixedAmt ? 0 : discount,
        discountAmount: discountFixedAmt ? Math.min(discountFixedAmt, maxDiscountFixed) : null,
        surcharge: surchargeNum,
        warehouseId: selectedWarehouse?.id || null,
        warehouseName: selectedWarehouse?.name || null,
        receiverName: customer?.selectedReceiver?.receiverName || null,
        receiverPhone: customer?.selectedReceiver?.receiverPhone || null,
        receiverAddress: customer?.selectedReceiver?.receiverAddress || null,
        receiverInfoId: customer?.selectedReceiver?.id || null,
        items: cartItems.map(i => {
          const itemSubtotal = Number(i.unitPrice) * Number(i.quantity);
          return {
            productId: i.productId,
            productName: i.productName,
            productImageUrl: i.productImageUrl,
            variantId: i.variantId,
            unit: i.unit,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            basePrice: i.basePrice,
            priceMode: i.priceMode || 'BASE',
            tierId: i.isPromo ? null : i.tierId,
            tierName: i.tierName,
            discountPercent: i.discountPercent,
            isManualPrice: i.isManualPrice,
            saleType: i.saleType || 'RETAIL',
            unitsPerBox: i.unitsPerBox,
            isPromo: i.isPromo,
            promoNote: i.promoNote,
            itemDiscountRate: i.itemDiscountRate || 0,
            notes: i.notes,
            subtotal: itemSubtotal,
          };
        }),
      };

      await cartHoldApi.release().catch(() => { });

      if (currentDraftId) {
        await draftApi.delete(currentDraftId).catch(() => { });
      }

      const res = await draftApi.save(payload);
      const newDraftId = res?.data?.data?.id || res?.data?.id;
      setCurrentDraftId(newDraftId || null);

      toast('Đã lưu đơn nháp thành công', 'success');
      clearCart();
      setCurrentDraftId(null);
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi lưu đơn nháp', 'error');
    } finally {
      setSavingDraft(false);
    }
  }, [cartItems, customer, notes, paymentMethod, discount, discountFixedAmt, maxDiscountFixed,
    surchargeNum, selectedWarehouse, clearCart, toast, currentDraftId]);

  const handleOpenDeliveryModal = useCallback(() => {
    if (!customer) { toast('Vui lòng chọn khách hàng', 'warning'); return; }
    if (cartItems.length === 0) { toast('Giỏ hàng trống', 'warning'); return; }
    setDeliveryModalOpen(true);
  }, [customer, cartItems, toast]);

  const handleSubmit = useCallback(async (deliveryDatetime, orderedByName, showPrices = true, recipientName = null) => {
    setDeliveryModalOpen(false);
    if (!customer) { toast('Vui lòng chọn khách hàng', 'warning'); return; }
    if (cartItems.length === 0) { toast('Giỏ hàng trống', 'warning'); return; }

    setSubmitting(true);
    try {
      const payload = {
        customerId: customer.id,
        customerName: customer.contactName || customer.name,
        customerPhone: customer.selectedReceiver?.receiverPhone || customer.phone,
        shippingAddress: customer.selectedReceiver?.receiverAddress || '',
        receiverName: recipientName !== null ? recipientName : (customer.selectedReceiver?.receiverName || null),
        receiverPhone: customer.selectedReceiver?.receiverPhone || customer.phone,
        receiverAddress: customer.selectedReceiver?.receiverAddress || '',
        notes, paymentMethod,
        discountRate: discountFixedAmt !== null ? 0 : discount,
        discountAmount: discountFixedAmt !== null ? Math.min(discountFixedAmt, maxDiscountFixed) : undefined,
        surcharge: surchargeNum,
        warehouseId: selectedWarehouse?.id,
        deliveryDatetime: deliveryDatetime ?? null,
        orderedByName: orderedByName || undefined,
        showPrices: showPrices,
        items: cartItems.map((i) => ({
          productId: i.productId,
          tierId: i.isPromo ? undefined : i.tierId,
          quantity: i.quantity,
          sentUnitPrice: i.isPromo ? 0 : (
            (i.saleType === 'BOX' && i.unitsPerBox > 0)
              ? i.unitPrice / i.unitsPerBox
              : i.unitPrice
          ),
          priceMode: i.isPromo ? 'BASE' : ((i.itemDiscountRate > 0) ? 'DISCOUNT_PERCENT' : 'TIER'),
          discountPercent: (!i.isPromo && i.itemDiscountRate > 0) ? i.itemDiscountRate : undefined,
          isManualPrice: i.isPromo ? true : (i.isManualPrice === true),
          saleType: i.saleType || 'RETAIL',
          notes: i.isPromo
            ? `[KM]${i.promoNote ? ' ' + i.promoNote : ''}`
            : (i.notes || undefined),
        })),
      };

      const res = await orderApi.create(payload);
      const body = res.data;

      if (body?.code === PRICE_CHANGED_CODE) {
        await handlePriceChanged(body.message);
        return;
      }
      if (body?.code !== 900 || !body?.success) {
        toast(body?.message || 'Lỗi khi tạo đơn hàng', 'error');
        return;
      }

      await cartHoldApi.release().catch(() => { });

      const orderCode = body?.data?.orderCode;
      toast(`Tạo đơn hàng thành công${orderCode ? ': ' + orderCode : ''}`, 'success');
      clearCart();
      setMobileCartOpen(false);
      const fresh = await fetchProducts();
      if (fresh) setProducts(fresh);

    } catch (err) {
      const body = err?.response?.data;
      if (body?.code === PRICE_CHANGED_CODE) {
        await handlePriceChanged(body.message);
        return;
      }
      toast(body?.message || err?.message || 'Lỗi khi tạo đơn hàng', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [customer, cartItems, notes, paymentMethod, discount, discountFixedAmt, maxDiscountFixed, surchargeNum, selectedWarehouse, clearCart, fetchProducts, handlePriceChanged, toast]);

  const cartPanelProps = {
    cartItems, customer, notes, paymentMethod, discount,
    surchargeDisplay, surcharge, subtotal, discountAmt, surchargeNum,
    vatBreakdown, exclusiveVatTotal, itemDiscountTotal, totalDiscount, promoTotal,
    total, submitting, priceChangedIds,
    selectedWarehouse,
    maxDiscountFixed,
    onOpenCustomerModal: () => setCustomerModalOpen(true),
    onClearCustomer: () => setCustomer(null),
    onClearCart: clearCart,
    onNotesChange: setNotes,
    onPaymentChange: setPaymentMethod,
    onDiscountChange: (d) => { setDiscount(d); setDiscountFixedAmt(null); setDiscountFixedDisplay(''); },
    onSurchargeChange: handleSurchargeChange,
    discountFixedAmt,
    discountFixedDisplay,
    onDiscountFixedOpen: handleDiscountFixedOpen,
    onDiscountFixedChange: handleDiscountFixedChange,
    onDiscountFixedClear: handleDiscountFixedClear,
    onUpdateQty: updateQty,
    onRemoveItem: removeItem,
    onPriceOverride: overridePrice,
    onItemDiscountChange: (cartId, pct) => {
      setCartItems(prev => prev.map(i => {
        if (i.id !== cartId) return i;
        const max = i.maxDiscountRate || 0;
        const capped = max > 0 ? Math.min(pct, max) : pct;
        return { ...i, itemDiscountRate: Math.max(0, Math.min(100, capped)) };
      }));
    },
    onPromoToggle: togglePromo,
    onSubmit: handleOpenDeliveryModal,
    onSaveDraft: handleSaveDraft,
    savingDraft,
  };

  const holdCountdown = (() => {
    if (!holdExpiresAt) return null;
    const left = Math.max(0, holdExpiresAt - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  })();

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-[#FAF7F2]">

      {holdExpiresAt && (
        <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-semibold">
          <span>⏱ Tồn kho được giữ: {holdCountdown}</span>
          <button onClick={async () => { await cartHoldApi.release().catch(() => { }); setHoldExpiresAt(null); navigate('/seller/drafts'); }}
            className="text-white/80 hover:text-white underline text-xs">Hủy</button>
        </div>
      )}
      {holdExpiresAt && (
        <div className="hidden lg:flex fixed top-0 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-white px-6 py-2 rounded-b-xl items-center gap-4 text-sm font-semibold shadow-lg">
          <span>⏱ Tồn kho được giữ trong: {holdCountdown}</span>
          <button onClick={async () => { await cartHoldApi.release().catch(() => { }); setHoldExpiresAt(null); navigate('/seller/drafts'); }}
            className="text-white border border-white/40 rounded-lg px-2 py-0.5 text-xs hover:bg-white/10 transition-colors">Hủy giữ kho</button>
        </div>
      )}

      <div className="lg:hidden flex-shrink-0">
        <button
          onClick={() => setMobileCartOpen(!mobileCartOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#1C1C1E] text-white"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-[#C9A84C]" />
            <span className="text-sm font-semibold">
              Giỏ hàng {cartItems.length > 0 && `(${cartItems.length})`}
            </span>
            {customer && (
              <span className="text-[10px] text-[#C9A84C] bg-[#C9A84C]/20 rounded-full px-2 py-0.5">
                {customer.contactName || customer.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {priceChangedIds.size > 0 && <AlertTriangle size={14} className="text-amber-400" />}
            <span className="text-[#C9A84C] text-sm font-bold">{formatPrice(total)}</span>
            <ChevronDown size={16} className={`text-[#8E8878] transition-transform ${mobileCartOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {mobileCartOpen && (
          <div className="h-[60vh] border-b border-[#E8DDD0] shadow-lg">
            <CartPanel {...cartPanelProps} />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-3 pt-3 pb-2 bg-white border-b border-[#F0EBE3] space-y-2">

          {warehouses.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8E8878] shrink-0">🏭 Kho:</span>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {warehouses.map(w => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setSelectedWarehouse(w);
                      setCartItems([]);
                      setPriceChangedIds(new Set());
                      cartHoldApi.release().catch(() => { });
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                      ${selectedWarehouse?.id === w.id
                        ? 'bg-[#C9A84C] text-white'
                        : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input
                type="text" placeholder="Tìm món..." value={inputSearch}
                onChange={(e) => setInputSearch(e.target.value)}
                className="input-elegant w-full rounded-xl pl-9 pr-4 py-2 text-sm"
              />
            </div>
            {[{ field: 'name', label: 'Tên' }, { field: 'price', label: 'Giá' }].map(({ field, label }) => {
              const active = sortField === field;
              const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <button key={field} onClick={() => {
                  if (!active) { setSortField(field); setSortDir('asc'); }
                  else if (sortDir === 'asc') setSortDir('desc');
                  else { setSortField(null); setSortDir('asc'); }
                }}
                  className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-colors
                    ${active
                      ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                      : 'border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}>
                  <Icon size={13} />{label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <button onClick={() => setActiveCategory('ALL')}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${activeCategory === 'ALL' ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
              Tất cả
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${activeCategory === cat.id ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loadingProducts ? (
            <div className="flex justify-center items-center h-40">
              <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-[#8E8878] gap-2">
              <span className="text-3xl">🔍</span>
              <p className="text-sm">Không tìm thấy sản phẩm</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-3">
              {filteredProducts.map((p) => {
                const cartQty = cartItems
                  .filter((i) => i.productId === p.id)
                  .reduce((s, i) => s + i.quantity, 0);
                const effectiveStock = calcEffectiveStock(p);
                return (
                  <ProductCard
                    key={p.id}
                    product={{ ...p, stockQuantity: effectiveStock }}
                    onAdd={handleAddProduct}
                    cartQty={cartQty}
                    ingStockMap={ingStockMap}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:flex flex-col w-80 xl:w-96 border-l border-[#E8DDD0] h-full">
        <CartPanel {...cartPanelProps} />
      </div>

      <CustomerSearchModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSelect={setCustomer}
        selected={customer}
      />

      {pendingSaleProduct && (
        <SaleTypeModal
          product={pendingSaleProduct}
          customer={customer}
          onConfirm={({ saleType }) => {
            addToCart(pendingSaleProduct, saleType);
            setPendingSaleProduct(null);
          }}
          onClose={() => setPendingSaleProduct(null)}
        />
      )}

      {deliveryModalOpen && (
        <DeliveryTimeModal
          onConfirm={(ts, orderedByName, showPrices, recipientName) => handleSubmit(ts, orderedByName, showPrices, recipientName)}
          onClose={() => setDeliveryModalOpen(false)}
        />
      )}
    </div>
  );
}