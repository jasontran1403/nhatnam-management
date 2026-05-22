// src/pages/seller/POSPage.jsx
// FIX #6: Real-time cart hold — giữ slot số lượng nguyên liệu khi thêm vào giỏ
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search, UserPlus, UserCheck, ShoppingBag, Trash2,
  ChevronDown, X, Receipt, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle,
} from 'lucide-react';
import { productApi, categoryApi, orderApi, warehouseApi } from '../../api/services';
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
  return new Intl.NumberFormat('vi-VN').format(Math.round(price || 0)) + ' đ';
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

function parseChangedProductName(message) {
  const m = message?.match(/Giá '(.+?)' đã thay đổi/);
  return m ? m[1] : null;
}

function VatBreakdownDisplay({ breakdown, infoOnly }) {
  if (!breakdown || breakdown.length === 0) return null;
  const totalVat = breakdown.reduce((s, g) => s + g.vatAmt, 0);
  return (
    <div>
      <div className="flex justify-between text-xs text-[#C4B9A8]">
        <span>VAT {infoOnly ? '(đã trong giá)' : ''}</span>
        <span>{formatPrice(totalVat)}</span>
      </div>
      <div className="pl-3 mt-0.5 space-y-0.5">
        {breakdown.map(g => (
          <div key={`${g.rate}-${g.mode}`} className="flex justify-between items-center">
            <span className="text-[10px] text-[#C4B9A8]">
              • {g.rate}% ({g.mode === 'EXCLUSIVE' ? 'ngoài giá' : 'trong giá'})
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
  itemDiscountTotal, totalDiscount,
  total, submitting, priceChangedIds,
  selectedWarehouse,
  onOpenCustomerModal, onClearCustomer, onClearCart, onNotesChange,
  onPaymentChange, onDiscountChange, onSurchargeChange, onUpdateQty,
  onRemoveItem, onPriceOverride, onItemDiscountChange, onSubmit,
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-[#F0EBE3] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-[#C9A84C]" />
          <span className="font-semibold text-sm text-[#1C1C1E]">Giỏ hàng</span>
          {cartItems.length > 0 && (
            <span className="bg-[#C9A84C] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {cartItems.length}
            </span>
          )}
        </div>
        {cartItems.length > 0 && (
          <button onClick={onClearCart} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600">
            <Trash2 size={11} /> Xoá tất cả
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
                {customer.selectedReceiver && (
                  <p className="text-[10px] text-[#C9A84C] truncate">
                    📦 {customer.selectedReceiver.receiverName} · {customer.selectedReceiver.receiverPhone}
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
            <div className="flex items-center gap-1">
              {[0, 5, 10, 15, 20].map((d) => (
                <button key={d} onClick={() => onDiscountChange(d)}
                  className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors
                    ${discount === d
                      ? 'bg-[#C9A84C] text-white'
                      : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
                  {d}%
                </button>
              ))}
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
          {(itemDiscountTotal > 0 || discountAmt > 0) && (
            <div>
              <div className="flex justify-between text-xs text-emerald-600">
                <span>Giảm</span>
                <span>-{formatPrice(itemDiscountTotal + discountAmt)}</span>
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
                    <span className="text-[10px] text-emerald-600">• Giảm bill ({discount}%)</span>
                    <span className="text-[10px] text-emerald-600">-{formatPrice(discountAmt)}</span>
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
// heldByAll = tổng hold của TẤT CẢ sellers (kể cả chính mình) theo ingredientId
// Frontend dùng: displayStock = actualStock - heldByAll[ingId]
// calcEffectiveStock trừ thêm cartItems của chính mình từ displayStock đó
// ─────────────────────────────────────────────────────────────────────────────
function useCartHold(warehouseId, cartItems, products, _userId, onCartExpired) {
  const [heldByAll, setHeldByAll] = useState({});
  const wsRef = useRef(null);
  const subscriptionsRef = useRef([]);
  const debounceRef = useRef(null);
  const lastCartRef = useRef([]);
  const onCartExpiredRef = useRef(onCartExpired);
  useEffect(() => { onCartExpiredRef.current = onCartExpired; }, [onCartExpired]);

  // Kết nối WebSocket
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

        // Subscribe stock update cho kho này
        const stockSub = client.subscribe(`/topic/stock/${warehouseId}`, (frame) => {
          try {
            const { ingredientId, heldQty } = JSON.parse(frame.body);
            setHeldByAll(prev => ({
              ...prev,
              [String(ingredientId)]: Number(heldQty) || 0,
            }));
          } catch (_) {}
        });

        // Subscribe /topic/cart-events — topic chung cho tất cả POS client
        // Payload: { event: "CART_EXPIRED", sellerId: 7 }
        // Client so sánh sellerId với userId của mình, nếu trùng thì clear giỏ
        const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
        const myUserId = storedUser?.userId;

        const cartEventSub = client.subscribe('/topic/cart-events', (frame) => {
          try {
            const { event, sellerId } = JSON.parse(frame.body);
            if (event === 'CART_EXPIRED' && sellerId === myUserId) {
              onCartExpiredRef.current?.();
            }
          } catch (_) {}
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
      subscriptionsRef.current.forEach(s => { try { s.unsubscribe?.(); } catch (_) {} });
      subscriptionsRef.current = [];
      try { wsRef.current?.disconnect?.(); } catch (_) {}
      wsRef.current = null;
      setHeldByAll({});
    };
  }, [warehouseId]);

  // Sync cart lên server (debounced 300ms)
  useEffect(() => {
    if (!warehouseId) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const ingMap = {};
      for (const item of cartItems) {
        const prod = products.find(p => p.id === item.productId);
        if (!prod?.ingredients?.length) continue;
        // Nếu bán thùng: item.quantity = số thùng → quy ra đơn vị lẻ
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
      } catch (_) {}
      lastCartRef.current = cartItems;
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [warehouseId, cartItems, products]);

  // Release khi unmount
  useEffect(() => {
    return () => { cartHoldApi.release().catch(() => {}); };
  }, []);

  return { heldByAll };
}

// ─────────────────────────────────────────────────────────────────────────────
// POSPage
// ─────────────────────────────────────────────────────────────────────────────
export default function POSPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [inputSearch, setInputSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const [cartItems, setCartItems] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [discount, setDiscount] = useState(0);

  const [surcharge, setSurcharge] = useState(0);
  const [surchargeDisplay, setSurchargeDisplay] = useState('');
  const surchargeDebounceRef = useRef(null);

  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);

  const [priceChangedIds, setPriceChangedIds] = useState(new Set());
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(inputSearch), 600);
    return () => clearTimeout(t);
  }, [inputSearch]);

  // Khi giỏ hàng hết hạn 3 phút — server broadcast CART_EXPIRED → clear giỏ + thông báo
  const handleCartExpired = useCallback(() => {
    setCartItems([]);
    setCustomer(null);
    setNotes('');
    setDiscount(0);
    setSurcharge(0);
    setSurchargeDisplay('');
    setPriceChangedIds(new Set());
    toast('Giỏ hàng đã hết hạn (3 phút không thanh toán). Vui lòng đặt lại.', 'warning');
  }, [toast]);

  // heldByAll: { [ingredientId]: totalHeldQty } — nhận realtime từ WS
  // Bao gồm cả hold của chính mình (server trả về tổng)
  // user.userId — theo LoginResponse DTO (không phải user.id)
  const { heldByAll } = useCartHold(
    selectedWarehouse?.id,
    cartItems,
    products,
    user?.userId,
    handleCartExpired,
  );

  // ingStockMap: actualStock - heldByAll
  // Đây là "stock thực còn lại trên thị trường", chưa trừ cartItems của mình
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

  // calcEffectiveStock: từ ingStockMap trừ thêm cartItems của chính mình
  // → "còn có thể thêm bao nhiêu sản phẩm này"
  const calcEffectiveStock = useCallback((product) => {
    if (product.stockQuantity == null) return null;
    if (!product.ingredients?.length) return Number(product.stockQuantity);

    let minCanMake = Infinity;
    for (const ing of product.ingredients) {
      const qtyPerProduct = Number(ing.quantity) || 1;
      const ingKey = String(ing.ingredientId);
      // ingStockMap đã trừ hold của tất cả (kể cả mình)
      // nhưng hold của mình = cartItems của mình → cần cộng lại để không trừ kép
      const myHoldForThisIng = cartItems.reduce((sum, cartItem) => {
        const cp = products.find(p => p.id === cartItem.productId);
        if (!cp?.ingredients?.length) return sum;
        const cpIng = cp.ingredients.find(i => String(i.ingredientId) === ingKey);
        if (!cpIng) return sum;
        // Quy đổi về đơn vị lẻ nếu bán thùng
        const effectiveQty = (cartItem.saleType === 'BOX' && cartItem.unitsPerBox > 0)
          ? cartItem.quantity * cartItem.unitsPerBox
          : cartItem.quantity;
        return sum + effectiveQty * (Number(cpIng.quantity) || 1);
      }, 0);

      // stock khả dụng = ingStockMap (actualStock - heldByAll) + myHold - myCartUsage
      // = actualStock - heldByOthers - myCartUsage
      const availableForMe = (ingStockMap[ingKey] ?? 0) + myHoldForThisIng - myHoldForThisIng;
      // Đơn giản hơn: ingStockMap đã = actualStock - heldByAll (kể cả mình)
      // mình đang dùng myHoldForThisIng trong cart
      // → có thể thêm thêm: ingStockMap[key] (vì hold của mình đã được trừ)
      // → canMake từ ingStock này
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
      .catch(() => {});
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

  const addToCart = useCallback((product, saleType = 'RETAIL') => {
    setPriceChangedIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });

    const unitsPerBox = (saleType === 'BOX' && product.unitsPerBox > 0)
      ? product.unitsPerBox : null;

    setCartItems((prev) => {
      const tier = product.priceTiers?.find((t) => t.sortOrder === 0) || product.priceTiers?.[0];
      // Key phân biệt BOX vs RETAIL của cùng 1 sản phẩm
      const key = `${product.id}-nv-${tier?.id || 'np'}-${saleType}`;
      const stock = product.stockQuantity != null ? Number(product.stockQuantity) : null;
      if (stock !== null && stock <= 0) return prev;

      // Giá đơn vị: bán thùng = unitPrice × unitsPerBox, bán lẻ = unitPrice
      const unitPrice = tier?.price ?? product.basePrice ?? 0;
      const effectivePrice = unitsPerBox ? unitPrice * unitsPerBox : unitPrice;
      // ĐVT hiển thị: thùng = "Thùng", lẻ = unit gốc
      const displayUnit = unitsPerBox ? 'Thùng' : (product.unit || '');

      const existing = prev.find((i) => i.key === key);
      const addQty = (stock !== null && stock < 1)
        ? Math.round(stock * 1000) / 1000
        : 1;

      if (existing) {
        const step = (stock !== null && stock < 1) ? addQty : 1;
        const maxQty = stock !== null
          ? Math.round((stock + existing.quantity) * 1000) / 1000
          : Infinity;
        const newQty = Math.min(
          Math.round((existing.quantity + step) * 1000) / 1000,
          maxQty
        );
        if (newQty <= existing.quantity) return prev;

        if (!existing.isManualPrice && !unitsPerBox) {
          const allTiers = product.priceTiers || existing.priceTiers || [];
          const r = resolveTierForQty(allTiers, newQty, existing.basePrice ?? existing.unitPrice);
          if (r) {
            // FIX #2b: Nếu item đang là BOX, giữ nguyên unitPrice (đã nhân sẵn unitsPerBox)
            // chỉ update tier metadata nếu RETAIL
            if (existing.saleType === 'BOX' && existing.unitsPerBox > 0) {
              return prev.map(i => i.key === key ? { ...i, quantity: newQty } : i);
            }
            return prev.map(i => i.key === key ? {
              ...i, quantity: newQty,
              tierId: r.tierId, tierName: r.tierName,
              unitPrice: r.unitPrice, originalUnitPrice: r.unitPrice,
            } : i);
          }
        }
        return prev.map(i => i.key === key ? { ...i, quantity: newQty } : i);
      }

      return [...prev, {
        id: newCartId(),
        key,
        productId: product.id,
        productName: product.name,
        variantId: null,
        variantName: null,
        tierId: tier?.id || null,
        tierName: tier?.tierName || null,
        unitPrice: effectivePrice,
        originalUnitPrice: effectivePrice,
        quantity: addQty,
        unit: displayUnit,
        imageUrl: product.imageUrl || null,
        vatRate: product.vatRate ?? 0,
        vatMode: product.vatMode ?? 'INCLUSIVE',
        maxDiscountRate: product.maxDiscountRate ?? 0,
        itemDiscountRate: 0,
        priceTiers: product.priceTiers || [],
        basePrice: product.basePrice ?? unitPrice,
        saleType,
        unitsPerBox,
      }];
    });
  }, []);

  // Sản phẩm pending modal chọn quy cách
  const [pendingSaleProduct, setPendingSaleProduct] = useState(null);

  // FIX #2: Truyền effectiveStock (đã trừ hold của tất cả sellers) vào product
  // để addToCart dùng đúng maxQty, không dùng số gốc từ DB
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

  const updateQty = useCallback((cartId, qty) => {
    if (qty <= 0) { setCartItems((prev) => prev.filter((i) => i.id !== cartId)); return; }
    setCartItems((prev) => prev.map((i) => {
      if (i.id !== cartId) return i;
      const prod = products.find((p) => p.id === i.productId);
      let cappedQty = qty;
      if (prod) {
        const effStock = calcEffectiveStock(prod);
        if (effStock !== null) {
          cappedQty = Math.min(qty, Math.round((effStock + i.quantity) * 1000) / 1000);
        }
      }
      if (i.isManualPrice) return { ...i, quantity: cappedQty };
      // BOX: giá đã được nhân sẵn khi addToCart, không resolve tier lại
      if (i.saleType === 'BOX' && i.unitsPerBox > 0) {
        return { ...i, quantity: cappedQty };
      }
      const allTiers = i.priceTiers || prod?.priceTiers || [];
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
  }, [products, calcEffectiveStock]);

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
    setCustomer(null);
    setNotes('');
    setDiscount(0);
    setSurcharge(0);
    setSurchargeDisplay('');
    setPriceChangedIds(new Set());
    cartHoldApi.release().catch(() => {});
  }, []);

  const subtotal = cartItems.reduce((s, i) =>
    s + Number(i.unitPrice) * Number(i.quantity), 0);

  const itemDiscountTotal = cartItems.reduce((s, i) => {
    const d = i.itemDiscountRate ?? 0;
    if (!d) return s;
    return s + Number(i.unitPrice) * (d / 100) * Number(i.quantity);
  }, 0);

  const subtotalAfterItemDiscount = subtotal - itemDiscountTotal;
  const discountAmt = Math.round(subtotalAfterItemDiscount * discount / 100);
  const totalDiscount = itemDiscountTotal + discountAmt;
  const surchargeNum = Number(surcharge) || 0;
  const total = subtotal - totalDiscount + surchargeNum;

  const vatBreakdown = useMemo(() => {
    const map = {};
    for (const i of cartItems) {
      const rate = i.vatRate ?? 0;
      const mode = i.vatMode ?? 'INCLUSIVE';
      if (rate === 0 || mode !== 'INCLUSIVE') continue;
      const lineGross = Number(i.unitPrice) * (1 - (i.itemDiscountRate ?? 0) / 100)
        * Number(i.quantity) * (1 - discount / 100);
      const vatAmt = lineGross - lineGross / (1 + rate / 100);
      const key = `${rate}|${mode}`;
      if (!map[key]) map[key] = { rate, mode, vatAmt: 0 };
      map[key].vatAmt += vatAmt;
    }
    return Object.values(map).sort((a, b) => a.rate - b.rate);
  }, [cartItems, discount]);

  const exclusiveVatTotal = 0;

  const handlePriceChanged = useCallback(async (message) => {
    const changedName = parseChangedProductName(message);
    const fresh = await fetchProducts();
    if (!fresh) return;

    setProducts(fresh);
    const newChangedIds = new Set();

    setCartItems(prev => prev.map(item => {
      if (item.isManualPrice) return item;
      // BOX: giá đã nhân unitsPerBox, không override lại theo tier lẻ
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

  const handleSubmit = useCallback(async () => {
    if (!customer) { toast('Vui lòng chọn khách hàng', 'warning'); return; }
    if (cartItems.length === 0) { toast('Giỏ hàng trống', 'warning'); return; }

    setSubmitting(true);
    try {
      const payload = {
        customerId: customer.id,
        customerName: customer.contactName || customer.name,
        customerPhone: customer.selectedReceiver?.receiverPhone || customer.phone,
        shippingAddress: customer.selectedReceiver?.receiverAddress || '',
        receiverName: customer.selectedReceiver?.receiverName || customer.contactName || customer.name,
        receiverPhone: customer.selectedReceiver?.receiverPhone || customer.phone,
        receiverAddress: customer.selectedReceiver?.receiverAddress || '',
        notes, paymentMethod,
        discountRate: discount,
        surcharge: surchargeNum,
        warehouseId: selectedWarehouse?.id,
        items: cartItems.map((i) => ({
          productId: i.productId,
          tierId: i.tierId,
          quantity: i.quantity,
          // BOX: unitPrice đã nhân unitsPerBox → gửi giá lẻ gốc để backend validate đúng
          sentUnitPrice: (i.saleType === 'BOX' && i.unitsPerBox > 0)
            ? i.unitPrice / i.unitsPerBox
            : i.unitPrice,
          priceMode: (i.itemDiscountRate > 0) ? 'DISCOUNT_PERCENT' : 'TIER',
          discountPercent: i.itemDiscountRate > 0 ? i.itemDiscountRate : undefined,
          isManualPrice: i.isManualPrice === true,
          saleType: i.saleType || 'RETAIL',
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

      await cartHoldApi.release().catch(() => {});

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
  }, [customer, cartItems, notes, paymentMethod, discount, surchargeNum, selectedWarehouse, clearCart, fetchProducts, handlePriceChanged, toast]);

  const cartPanelProps = {
    cartItems, customer, notes, paymentMethod, discount,
    surchargeDisplay, surcharge, subtotal, discountAmt, surchargeNum,
    vatBreakdown, exclusiveVatTotal, itemDiscountTotal, totalDiscount,
    total, submitting, priceChangedIds,
    selectedWarehouse,
    onOpenCustomerModal: () => setCustomerModalOpen(true),
    onClearCustomer: () => setCustomer(null),
    onClearCart: clearCart,
    onNotesChange: setNotes,
    onPaymentChange: setPaymentMethod,
    onDiscountChange: setDiscount,
    onSurchargeChange: handleSurchargeChange,
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
    onSubmit: handleSubmit,
  };

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-[#FAF7F2]">

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
                      cartHoldApi.release().catch(() => {});
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

      {/* Modal chọn quy cách: Thùng / Lẻ */}
      {pendingSaleProduct && (
        <SaleTypeModal
          product={pendingSaleProduct}
          onConfirm={({ saleType }) => {
            addToCart(pendingSaleProduct, saleType);
            setPendingSaleProduct(null);
          }}
          onClose={() => setPendingSaleProduct(null)}
        />
      )}
    </div>
  );
}