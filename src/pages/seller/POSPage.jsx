import { useLang } from '../../context/LangContext';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMinLoading from '../../hooks/useMinLoading.js';
import {
  Search, UserPlus, UserCheck, ShoppingBag, Trash2,
  ChevronDown, X, Receipt, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle,
  Save, Check, Plus, PackageX, RefreshCw,
} from 'lucide-react';
import { productApi, categoryApi, orderApi, warehouseApi, draftApi } from '../../api/services';
import api from '../../api/axios';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import ProductCard from '../../components/seller/ProductCard';
import CartItem from '../../components/seller/CartItem';
import CustomerSearchModal from '../../components/seller/CustomerSearchModal';
import SaleTypeModal from '../../components/seller/SaleTypeModal';
import SaveDraftModal from '../../components/common/SaveDraftModal.jsx';

const PRICE_CHANGED_CODE = 950;
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// SurchargePanel — hiển thị dạng "thêm" thay vì mặc định 4 ô
// Không hiện sẵn 4 ô, thay vào đó hiện nút + và danh sách các phụ phí đã thêm
const PRESET_SURCHARGE_TYPES = [
  { name: 'Thùng xốp', amount: 20000 },
  { name: 'Phí vận chuyển', amount: 30000 },
  { name: 'Gửi xe', amount: 10000 },
  { name: 'Đá khô', amount: 15000 },
];

function SurchargePanel({ surchargeItems, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  const addPreset = (preset) => {
    if (surchargeItems.find(i => i.name === preset.name)) return;
    onChange([...surchargeItems, { name: preset.name, amount: preset.amount }]);
  };

  const addCustom = () => {
    const name = customName.trim();
    const amount = parseInt(customAmount.replace(/[^0-9]/g, ''), 10) || 0;
    if (!name) return;
    if (surchargeItems.find(i => i.name === name)) {
      setCustomName(''); setCustomAmount(''); return;
    }
    onChange([...surchargeItems, { name, amount }]);
    setCustomName(''); setCustomAmount(''); setShowPicker(false);
  };

  const updateAmount = (name, rawValue) => {
    const num = rawValue === '' ? 0 : parseInt(String(rawValue).replace(/[^0-9]/g, ''), 10) || 0;
    if (num === 0) {
      onChange(surchargeItems.filter(i => i.name !== name));
    } else {
      onChange(surchargeItems.map(i => i.name === name ? { ...i, amount: num } : i));
    }
  };

  const removeItem = (name) => onChange(surchargeItems.filter(i => i.name !== name));

  const addedNames = new Set(surchargeItems.map(i => i.name));
  const availablePresets = PRESET_SURCHARGE_TYPES.filter(p => !addedNames.has(p.name));

  return (
    <div className="space-y-1.5">
      {/* Danh sách phụ phí đã thêm */}
      {surchargeItems.map(item => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="text-[11px] text-[#5C4E3D] font-medium w-28 shrink-0 truncate">{item.name}</span>
          <div className="relative flex-1">
            <input
              type="text"
              inputMode="numeric"
              value={item.amount === 0 ? '' : new Intl.NumberFormat('vi-VN').format(item.amount)}
              onChange={e => updateAmount(item.name, e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-[#E8DDD0] px-2 py-1 text-xs text-right pr-6 focus:outline-none focus:border-[#C9A84C]"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8E8878]">đ</span>
          </div>
          <button onClick={() => removeItem(item.name)} className="text-[#C4B9A8] hover:text-red-400 shrink-0">
            <X size={12} />
          </button>
        </div>
      ))}

      {/* Nút thêm phụ phí */}
      {!showPicker ? (
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1 text-[11px] text-[#C9A84C] hover:text-[#a07830] font-semibold py-0.5"
        >
          <Plus size={12} /> Thêm phụ phí
        </button>
      ) : (
        <div className="bg-[#FDF8ED] rounded-xl border border-[#C9A84C]/20 p-2.5 space-y-2">
          {/* Preset nhanh */}
          {availablePresets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availablePresets.map(p => (
                <button
                  key={p.name}
                  onClick={() => { addPreset(p); setShowPicker(false); }}
                  className="text-[10px] px-2 py-1 rounded-lg bg-white border border-[#E8DDD0] text-[#5C4E3D] hover:border-[#C9A84C] hover:bg-[#FDF8ED] font-medium transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Nhập tùy chỉnh */}
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setShowPicker(false); }}
                placeholder="Tên phụ phí..."
                className="flex-1 rounded-lg border border-[#E8DDD0] px-2 py-1 text-[11px] focus:outline-none focus:border-[#C9A84C] bg-white"
              />
              <div className="relative w-24">
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setShowPicker(false); }}
                  placeholder="Số tiền"
                  className="w-full rounded-lg border border-[#E8DDD0] px-2 py-1 text-[11px] text-right pr-5 focus:outline-none focus:border-[#C9A84C] bg-white"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[#8E8878]">đ</span>
              </div>
              <button onClick={addCustom} disabled={!customName.trim()}
                className="px-2 py-1 rounded-lg bg-[#C9A84C] text-white text-[10px] font-semibold disabled:opacity-40 shrink-0">
                Thêm
              </button>
              <button onClick={() => { setShowPicker(false); setCustomName(''); setCustomAmount(''); }}
                className="px-2 py-1 rounded-lg border border-[#E8DDD0] text-[#8E8878] text-[10px] shrink-0">
                Bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
    maximumFractionDigits: 0,
  }).format(num) + ' đ';
}

let cartIdCounter = 0;
const newCartId = () => ++cartIdCounter;

function calcNetPrice(price, vatRate, vatMode) {
  const rate = vatRate ?? 0;
  const mode = vatMode ?? 'INCLUSIVE';
  if (rate === 0) return price;
  if (mode === 'INCLUSIVE') return price / (1 + rate / 100);
  return price;
}

function parseChangedProductName(message) {
  const m = message?.match(/Giá '(.+?)' đã thay đổi/);
  return m ? m[1] : null;
}

function TierSelectModal({ product, currentTierId, currentPriceSource, onConfirm, onClose }) {
  const hasTiers = product.priceTiers && product.priceTiers.length > 0;
  const saleType = product._saleType || 'RETAIL';
  const unitsPerBox = (saleType === 'BOX' && product.unitsPerBox > 0) ? product.unitsPerBox : 1;
  const isBox = unitsPerBox > 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs animate-fadeIn overflow-hidden">
        <div className="bg-gradient-to-r from-[#C9A84C] to-[#b8963d] px-5 py-4 flex items-center justify-between">
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
              ${currentPriceSource === 'BASE' ? 'border-sky-400 bg-sky-50' : 'border-[#E8DDD0] hover:border-sky-300 hover:bg-sky-50/50'}`}
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-[#1C1C1E]">Giá lẻ</p>
              {isBox && <p className="text-[10px] text-[#8E8878]">{formatPrice(product.basePrice)} / hộp</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-sky-600">{formatPrice(product.basePrice * unitsPerBox)}</p>
              {isBox && <p className="text-[10px] text-[#8E8878]">/ thùng</p>}
            </div>
          </button>
          {hasTiers && product.priceTiers.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((tier, idx) => (
            <button
              key={tier.id}
              onClick={() => onConfirm({ priceSource: 'TIER', tierId: tier.id, tierName: tier.tierName, unitPrice: tier.price * unitsPerBox })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all
                ${currentTierId === tier.id ? 'border-orange-400 bg-orange-50' : 'border-[#E8DDD0] hover:border-orange-300 hover:bg-orange-50/50'}`}
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-[#1C1C1E]">{tier.tierName || `Sỉ ${idx + 1}`}</p>
                {isBox && <p className="text-[10px] text-[#8E8878]">{formatPrice(tier.price)} / hộp</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-orange-600">{formatPrice(tier.price * unitsPerBox)}</p>
                {isBox && <p className="text-[10px] text-[#8E8878]">/ thùng</p>}
                {currentTierId === tier.id && <Check size={14} className="text-orange-500 ml-auto mt-0.5" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VatBreakdownDisplay({ breakdown }) {
  if (!breakdown || breakdown.length === 0) return null;
  const totalVat = breakdown.reduce((s, g) => s + g.vatAmt, 0);
  return (
    <div>
      <div className="flex justify-between text-xs text-[#C4B9A8]">
        <span>Tổng VAT</span>
        <span>+{formatPrice(totalVat)}</span>
      </div>
      <div className="pl-3 mt-0.5 space-y-0.5">
        {breakdown.map(g => (
          <div key={`${g.rate}-${g.mode}`} className="flex justify-between items-center">
            <span className="text-[10px] text-[#C4B9A8]">• {g.rate}% ({g.mode === 'EXCLUSIVE' ? 'ngoài giá' : 'trong giá'})</span>
            <span className="text-[10px] text-[#C4B9A8]">+{formatPrice(g.vatAmt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// CartPanel — summary luôn nằm gần bottom với min-height
function CartPanel({
  cartItems, customer, notes, paymentMethod, discount, surchargeItems,
  subtotalNet, discountAmt, surchargeNum, vatBreakdown,
  exclusiveVatTotal, itemDiscountTotal, promoTotal, total,
  submitting, priceChangedIds, selectedWarehouse,
  discountFixedAmt, discountFixedDisplay, maxDiscountFixed,
  onDiscountFixedOpen, onDiscountFixedChange, onDiscountFixedClear,
  onOpenCustomerModal, onClearCustomer, onClearCart, onNotesChange,
  onPaymentChange, onDiscountChange, onSurchargeItemsChange, onUpdateQty,
  onRemoveItem, onPriceOverride, onItemDiscountChange, onPromoToggle,
  onVatRateChange, onTierSelect, onSubmit, onSaveDraft, savingDraft, countdownSeconds,
  cartContainerRef,
  // NEW PROPS:
  hasOutOfStockItems,  // boolean — true if any cart item is out of stock
  onUpdatePrices,      // () => void — refresh prices from server
  updatingPrices,      // boolean
}) {
  const { t } = useLang();
  const formatCountdown = (seconds) => {
    if (seconds <= 0) return 'Hết hạn';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col bg-white min-h-full">
      {/* Header — sticky */}
      <div className="sticky top-0 z-10 bg-white px-4 py-3 border-b border-[#F0EBE3] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-[#C9A84C]" />
          <span className="font-semibold text-sm text-[#1C1C1E]">{t('order', 'order')}</span>
          {cartItems.length > 0 && (
            <span className="bg-[#C9A84C] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {cartItems.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {countdownSeconds > 0 && (
            <div className="text-xs font-mono bg-amber-50 px-2 py-1 rounded-full text-amber-700">
              ⏱️ {formatCountdown(countdownSeconds)}
            </div>
          )}
          {cartItems.length > 0 && (
            <button onClick={onClearCart} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600">
              <Trash2 size={11} /> {t('common', 'delete')}
            </button>
          )}
        </div>
      </div>

      {/* Out-of-stock warning banner */}
      {hasOutOfStockItems && cartItems.length > 0 && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-red-700">Có món hết hàng trong giỏ</p>
            <p className="text-[10px] text-red-500 mt-0.5">Không thể tạo đơn — chỉ có thể lưu nháp để đặt sau.</p>
          </div>
        </div>
      )}

      {/* Price changed banner */}
      {priceChangedIds.size > 0 && (
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-amber-700">Giá sản phẩm đã thay đổi</p>
            <p className="text-[10px] text-amber-600 mt-0.5">Giá mới đã được cập nhật tự động.</p>
          </div>
          {onUpdatePrices && (
            <button
              onClick={onUpdatePrices}
              disabled={updatingPrices}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {updatingPrices
                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <RefreshCw size={10} />}
              Cập nhật
            </button>
          )}
        </div>
      )}

      {/* Customer */}
      <div className="px-4 py-3 border-b border-[#F0EBE3]">
        <button
          onClick={onOpenCustomerModal}
          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm transition-all
            ${customer ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-dashed border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}
        >
          {customer ? (
            <>
              <UserCheck size={15} className="text-[#C9A84C] shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-xs truncate">{customer.contactName || customer.name}</p>
                <p className="text-[10px] text-[#8E8878]">{customer.customerCode} · {customer.phone}</p>
                {customer.selectedReceiver && (
                  <p className="text-[10px] text-[#C9A84C] truncate">📦 {customer.selectedReceiver.receiverAddress || '—'}</p>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); onClearCustomer(); }} className="text-[#8E8878] hover:text-red-400 shrink-0">
                <X size={13} />
              </button>
            </>
          ) : (
            <><UserPlus size={15} /><span className="text-xs">Chọn khách hàng *</span></>
          )}
        </button>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2" ref={cartContainerRef}>
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#C4B9A8] gap-2">
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
                  onVatRateChange={onVatRateChange}
                  onTierSelect={() => onTierSelect(item.id)}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Controls + Summary */}
      {cartItems.length > 0 && (
        <div className="border-t border-[#F0EBE3] px-4 py-3 space-y-2 bg-white">
          <textarea
            placeholder="Ghi chú đơn hàng..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            className="input-elegant w-full rounded-lg px-3 py-2 text-xs resize-none"
          />
          <div className="flex gap-1.5 flex-wrap">
            {[['CASH', '💵 Tiền mặt'], ['BANK_TRANSFER', '🏦 Chuyển khoản'], ['DEBT', '📋 Công nợ']].map(([val, label]) => (
              <button key={val} onClick={() => onPaymentChange(val)}
                className={`flex-1 text-[10px] py-1.5 rounded-lg border font-medium transition-colors
                  ${paymentMethod === val ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8E8878] shrink-0">Giảm giá:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {[0, 3, 5, 8, 10].map((d) => (
                  <button key={d} onClick={() => onDiscountChange(d)}
                    className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors
                      ${discount === d && discountFixedAmt === null ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
                    {d}%
                  </button>
                ))}
                {discountFixedAmt === null ? (
                  <button onClick={onDiscountFixedOpen}
                    className="text-[10px] px-2 py-1 rounded-md font-semibold bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]">
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
            <div className="flex flex-col gap-2">
              <span className="text-xs text-[#8E8878]">Phụ phí:</span>
              <div className="flex-1">
                <SurchargePanel surchargeItems={surchargeItems} onChange={onSurchargeItemsChange} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="px-4 pb-4 pt-2 border-t border-[#F0EBE3] bg-white">
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-xs text-[#8E8878]">
            <span>Tạm tính</span>
            <span>{formatPrice(subtotalNet)}</span>
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
            <div>
              <div className="flex justify-between text-xs text-orange-500">
                <span>Phụ phí</span>
                <span>+{formatPrice(surchargeNum)}</span>
              </div>
              {surchargeItems.filter(i => Number(i.amount) > 0).map(i => (
                <div key={i.name} className="flex justify-between pl-3">
                  <span className="text-[10px] text-orange-400">• {i.name}</span>
                  <span className="text-[10px] text-orange-400">+{formatPrice(i.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {vatBreakdown.length > 0 && (
            <div className="pt-1 border-t border-dashed border-[#F0EBE3]">
              <VatBreakdownDisplay breakdown={vatBreakdown} />
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
          disabled={submitting || cartItems.length === 0 || !customer || !selectedWarehouse || hasOutOfStockItems}
          className={`w-full rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors
            ${hasOutOfStockItems
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : priceChangedIds.size > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'btn-gold'
            }`}
        >
          {submitting ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang xử lý...</>
          ) : hasOutOfStockItems ? (
            <><PackageX size={15} /> Hết hàng — Chỉ được lưu nháp</>
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


// useCartHold — (giữ nguyên)
function useCartHold(warehouseId, cartItems, products, _userId, onCartExpired, setProducts) {
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
            const { ingredientId, heldQty, stockQuantity } = JSON.parse(frame.body);

            // Cập nhật heldByAll như cũ
            setHeldByAll(prev => ({
              ...prev,
              [String(ingredientId)]: Number(heldQty) || 0
            }));

            // Cập nhật stockQuantity thực tế trong products nếu server gửi kèm
            if (stockQuantity != null && setProducts) {
              setProducts(prev => prev.map(p => {
                if (!p.ingredients?.length) return p;
                const hasIng = p.ingredients.some(
                  ing => String(ing.ingredientId) === String(ingredientId)
                );
                if (!hasIng) return p;
                return {
                  ...p,
                  ingredients: p.ingredients.map(ing =>
                    String(ing.ingredientId) === String(ingredientId)
                      ? { ...ing, stockQuantity: Number(stockQuantity) }
                      : ing
                  )
                };
              }));
            }
          } catch (_) { }
        });
        const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
        const myUserId = storedUser?.userId;
        const cartEventSub = client.subscribe('/topic/cart-events', (frame) => {
          try {
            const { event, sellerId } = JSON.parse(frame.body);
            if (event === 'CART_EXPIRED' && sellerId === myUserId) onCartExpiredRef.current?.();
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
          ? item.quantity * item.unitsPerBox : item.quantity;
        for (const ing of prod.ingredients) {
          const qtyPerUnit = Number(ing.quantity) || 1;
          ingMap[ing.ingredientId] = (ingMap[ing.ingredientId] || 0) + effectiveQty * qtyPerUnit;
        }
      }
      const holdItems = Object.entries(ingMap).map(([ingredientId, qty]) => ({ ingredientId: Number(ingredientId), qty }));
      try {
        if (holdItems.length > 0) await cartHoldApi.update(warehouseId, holdItems);
        else if (lastCartRef.current.length > 0) await cartHoldApi.release();
      } catch (_) { }
      lastCartRef.current = cartItems;
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [warehouseId, cartItems, products]);

  useEffect(() => { return () => { cartHoldApi.release().catch(() => { }); }; }, []);
  return { heldByAll, setHeldByAll };
}

// Thay thế phần switch trong DeliveryTimeModal bằng dropdown
// DeliveryTimeModal component - sửa lại phần onConfirm
function DeliveryTimeModal({ onConfirm, onClose }) {
  const [deliveryDate, setDeliveryDate] = useState(null);
  const [orderedBy, setOrderedBy] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [priceDisplayOption, setPriceDisplayOption] = useState('show'); // 'show', 'hide_prices', 'hide_all'
  const [DTPicker, setDTPicker] = useState(null);

  useEffect(() => {
    import('../../components/ui/DateTimePicker').then(m => setDTPicker(() => m.default));
  }, []);

  const getShowPricesValue = () => {
    return priceDisplayOption === 'show';
  };

  const getHideAllPricesValue = () => {
    return priceDisplayOption === 'hide_all';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn overflow-hidden">
        <div className="bg-gradient-to-r from-[#C9A84C] to-[#b8963d] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-[10px] uppercase tracking-widest font-semibold">Xác nhận đơn hàng</p>
            <h3 className="text-white font-bold text-base mt-0.5">Thông tin giao hàng</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">👤 Tên người đặt hàng</label>
            <input type="text" value={orderedBy} onChange={e => setOrderedBy(e.target.value)}
              placeholder="Nhập tên người đặt (nếu có)..."
              className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm focus:outline-none focus:border-[#C9A84C] bg-[#FAFAF8]" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">📦 Tên người nhận</label>
            <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)}
              placeholder="Nhập tên người nhận..."
              className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm focus:outline-none focus:border-[#C9A84C] bg-[#FAFAF8]" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">🕐 Ngày & giờ giao hàng <span className="normal-case font-normal text-[#C4B9A8]">(tuỳ chọn)</span></label>
            {DTPicker
              ? <DTPicker value={deliveryDate} onChange={setDeliveryDate} minDate={new Date()} placeholder="Không hẹn giờ giao — bấm để chọn" />
              : <div className="h-11 rounded-xl border-2 border-[#E8DDD0] animate-pulse bg-[#FAFAF8]" />}
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#8E8878] uppercase tracking-wider mb-1.5">💰 Hiển thị giá</label>
            <select
              value={priceDisplayOption}
              onChange={(e) => setPriceDisplayOption(e.target.value)}
              className="w-full rounded-xl border-2 border-[#E8DDD0] px-4 py-2.5 text-sm focus:outline-none focus:border-[#C9A84C] bg-white"
            >
              <option value="show">Hiển thị đầy đủ giá</option>
              <option value="hide_prices">Che giá (ẩn giá từng sản phẩm, chỉ hiện tổng)</option>
              <option value="hide_all">Che toàn bộ (ẩn tất cả số tiền)</option>
            </select>
            <p className="text-[10px] text-[#8E8878] mt-1">
              {priceDisplayOption === 'show' && '✓ Hiển thị tất cả giá trên phiếu'}
              {priceDisplayOption === 'hide_prices' && '✓ Ẩn giá từng sản phẩm, vẫn hiển thị tổng tiền'}
              {priceDisplayOption === 'hide_all' && '✓ Ẩn toàn bộ số tiền trên phiếu (chỉ hiển thị tên và số lượng)'}
            </p>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E8DDD0] text-[#8E8878] text-sm font-semibold hover:bg-[#F0EBE3]">Hủy</button>
          <button
            onClick={() => {
              onConfirm(
                deliveryDate?.getTime() ?? null,
                orderedBy.trim() || null,
                getShowPricesValue(),
                recipientName.trim() || null,
                getHideAllPricesValue()
              );
            }}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-white text-sm font-bold hover:bg-[#b8963d] disabled:opacity-40 flex items-center justify-center gap-2">
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
  const desktopCartRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useMinLoading();

  const [inputSearch, setInputSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [saveDraftModalOpen, setSaveDraftModalOpen] = useState(false);

  const [cartItems, setCartItems] = useState([]);
  const [customer, setCustomerState] = useState(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [discount, setDiscount] = useState(0);
  const [discountFixedAmt, setDiscountFixedAmt] = useState(null);
  const [discountFixedDisplay, setDiscountFixedDisplay] = useState('');
  const [surchargeItems, setSurchargeItems] = useState([]);

  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [priceChangedIds, setPriceChangedIds] = useState(new Set());

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  const [tierModalProduct, setTierModalProduct] = useState(null);
  const [tierModalCartId, setTierModalCartId] = useState(null);

  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const timerRef = useRef(null);
  const CART_HOLD_DURATION = 10 * 60;

  // Ref để scroll xuống summary khi thêm món mới
  const cartContainerRef = useRef(null);
  const prevCartLengthRef = useRef(0);

  const customerRef = useRef(null);
  const productsRef = useRef([]);
  useEffect(() => { customerRef.current = customer; }, [customer]);
  useEffect(() => { productsRef.current = products; }, [products]);

  // Scroll xuống dưới khi thêm món mới
  useEffect(() => {
    if (cartItems.length > prevCartLengthRef.current) {
      setTimeout(() => {
        // Mobile: scroll trong cartContainerRef
        if (cartContainerRef.current) {
          cartContainerRef.current.scrollTo({
            top: cartContainerRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
        // Desktop: scroll wrapper panel
        if (desktopCartRef.current) {
          desktopCartRef.current.scrollTo({
            top: desktopCartRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      }, 100);
    }
    prevCartLengthRef.current = cartItems.length;
  }, [cartItems.length]);

  useEffect(() => {
    if (cartItems.length > 0 && countdownSeconds === 0) setCountdownSeconds(CART_HOLD_DURATION);
    if (cartItems.length === 0 && countdownSeconds !== 0) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setCountdownSeconds(0);
    }
  }, [cartItems.length]);

  useEffect(() => {
    if (countdownSeconds > 0 && cartItems.length > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdownSeconds(prev => {
          if (prev <= 1) { clearInterval(timerRef.current); timerRef.current = null; handleCartExpired(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [countdownSeconds, cartItems.length]);

  const handleCartExpired = useCallback(() => {
    setCartItems([]);
    setCustomerState(null);
    setNotes(''); setDiscount(0); setSurchargeItems([]);
    setPriceChangedIds(new Set()); setCountdownSeconds(0);
    if (currentDraftId) {
      toast('Giỏ hàng đã hết hạn. Đơn nháp vẫn được lưu.', 'warning');
      navigate('/seller/drafts');
    } else {
      toast('Giỏ hàng đã hết hạn. Vui lòng đặt lại.', 'warning');
    }
  }, [toast, currentDraftId, navigate]);

  const { heldByAll, setHeldByAll } = useCartHold(
    selectedWarehouse?.id,
    cartItems,
    products,
    user?.userId,
    handleCartExpired,
    setProducts
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
          // Cap held tối đa bằng actualStock để không âm khi qty > tồn
          map[key] = actualStock - Math.min(held, actualStock);
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
      const canMake = ingAvailable / qtyPerProduct;  // ← bỏ Math.max và Math.floor
      minCanMake = Math.min(minCanMake, canMake);
    }
    return minCanMake === Infinity ? Number(product.stockQuantity) : minCanMake;
  }, [ingStockMap]);

  useEffect(() => {
    warehouseApi.getAll()
      .then(res => {
        const list = res.data?.data || res.data || [];
        setWarehouses(list);
        const draftState = location.state?.draft;
        if (draftState?.warehouseId) {
          const found = list.find(w => w.id === draftState.warehouseId);
          setSelectedWarehouse(found || (list.length > 0 ? list[0] : null));
        } else {
          if (list.length > 0) setSelectedWarehouse(list[0]);
        }
      })
      .catch(() => toast('Không thể tải danh sách kho', 'error'));
  }, [toast]);

  useEffect(() => {
    const draft = location.state?.draft;
    if (!draft) return;
    if (draft.items?.length > 0) {
      setCartItems(draft.items.map((i) => ({
        id: ++cartIdCounter,
        productId: i.productId, productName: i.productName, productImageUrl: i.productImageUrl,
        unit: i.unit, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice),
        originalUnitPrice: Number(i.unitPrice),
        priceSource: i.isManualPrice ? 'MANUAL' : (i.tierId ? 'TIER' : 'BASE'),
        tierId: i.tierId, tierName: i.tierName,
        vatRate: i.vatRate ?? 0, vatMode: i.vatMode ?? 'INCLUSIVE',
        maxDiscountRate: i.maxDiscountRate ?? 0, itemDiscountRate: i.itemDiscountRate || 0,
        isManualPrice: i.isManualPrice, saleType: i.saleType || 'RETAIL', unitsPerBox: i.unitsPerBox,
        isPromo: i.isPromo, promoNote: i.promoNote, notes: i.notes, priceTiers: [],
      })));
    }
    if (draft.customerId) {
      setCustomerState({ id: draft.customerId, name: draft.customerName, phone: draft.customerPhone, email: draft.customerEmail, contactName: draft.customerName, customerCode: '' });
    }
    if (draft.notes) setNotes(draft.notes);
    if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
    if (draft.discountRate) setDiscount(draft.discountRate);
    if (draft.discountAmount && Number(draft.discountAmount) > 0) {
      setDiscountFixedAmt(Number(draft.discountAmount));
      setDiscountFixedDisplay(new Intl.NumberFormat('vi-VN').format(Number(draft.discountAmount)));
    }
    if (draft.surchargeItems?.length > 0) {
      setSurchargeItems(draft.surchargeItems);
    } else if (Number(draft.surcharge) > 0) {
      setSurchargeItems([{ name: 'Phụ phí', amount: Number(draft.surcharge) }]);
    }
    if (draft.warehouseId) {
      setWarehouses(prev => {
        const found = prev.find(w => w.id === draft.warehouseId);
        if (found) setSelectedWarehouse(found);
        return prev;
      });
    }
    toast('Đã tải đơn nháp vào giỏ hàng', 'success');
    setCurrentDraftId(draft.id);
  }, [location.state, toast]);

  useEffect(() => {
    if (!selectedWarehouse) return;
    setLoadingProducts(true);
    productApi.getAll({ page: 0, size: 200, warehouseId: selectedWarehouse.id })
      .then(res => setProducts(res.data?.data?.content || []))
      .catch(() => toast('Không thể tải sản phẩm', 'error'))
      .finally(() => setLoadingProducts(false));
  }, [selectedWarehouse, toast, setLoadingProducts]);

  useEffect(() => {
    categoryApi.getAll()
      .then(res => setCategories(res.data?.data || res.data || []))
      .catch(() => { });
  }, []);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory !== 'ALL') list = list.filter((p) => p.categoryId == activeCategory || p.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name?.toLowerCase().includes(q));
    }
    if (sortField) {
      list = [...list].sort((a, b) => {
        if (sortField === 'name') { const aV = a.name?.toLowerCase() ?? '', bV = b.name?.toLowerCase() ?? ''; return sortDir === 'asc' ? aV.localeCompare(bV) : bV.localeCompare(aV); }
        if (sortField === 'price') { const aV = a.basePrice ?? 0, bV = b.basePrice ?? 0; return sortDir === 'asc' ? aV - bV : bV - aV; }
        return 0;
      });
    }
    return list;
  }, [products, activeCategory, searchQuery, sortField, sortDir]);

  const handleAddProduct = useCallback((product) => {
    const effStock = calcEffectiveStock(product);
    const productWithStock = effStock !== null ? { ...product, stockQuantity: effStock } : product;
    if (product.unitsPerBox && product.unitsPerBox > 0) {
      setPendingSaleProduct(productWithStock);
    } else if (product.priceTiers && product.priceTiers.length > 0) {
      setTierModalProduct(productWithStock);
      setTierModalCartId(null);
    } else {
      addToCartDirect(productWithStock, 'RETAIL', 'BASE', null, null, productWithStock.basePrice);
    }
  }, [calcEffectiveStock]);

  const addToCartDirect = useCallback((product, saleType, priceSource, tierId, tierName, unitPrice) => {
    setPriceChangedIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
    const unitsPerBox = (saleType === 'BOX' && product.unitsPerBox > 0) ? product.unitsPerBox : null;
    const stock = product.stockQuantity != null ? Number(product.stockQuantity) : null;
    const addQty = 1;
    const displayUnit = unitsPerBox ? 'Thùng' : (product.unit || '');
    setCartItems(prev => [...prev, {
      id: newCartId(), productId: product.id, productName: product.name, productImageUrl: product.imageUrl,
      unit: displayUnit, quantity: addQty, unitPrice: unitPrice, originalUnitPrice: unitPrice,
      priceSource, tierId, tierName, vatRate: product.vatRate ?? 0, vatMode: product.vatMode ?? 'INCLUSIVE',
      maxDiscountRate: product.maxDiscountRate ?? 0, itemDiscountRate: 0, isManualPrice: false,
      saleType, unitsPerBox, priceTiers: product.priceTiers || [], basePrice: product.basePrice ?? 0,
    }]);
  }, []);

  const handleTierConfirm = useCallback(({ priceSource, tierId, tierName, unitPrice }) => {
    if (tierModalCartId != null) {
      setCartItems(prev => prev.map(i => {
        if (i.id !== tierModalCartId) return i;
        return { ...i, priceSource, tierId, tierName, unitPrice, originalUnitPrice: unitPrice, isManualPrice: false };
      }));
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
    setTierModalProduct({ ...prod, stockQuantity: calcEffectiveStock(prod) });
    setTierModalCartId(cartId);
  }, [cartItems, calcEffectiveStock]);

  const updateQty = useCallback((cartId, qty) => {
    if (qty <= 0) { setCartItems((prev) => prev.filter((i) => i.id !== cartId)); return; }
    setCartItems((prev) => prev.map((i) => {
      if (i.id !== cartId) return i;
      const prod = productsRef.current.find((p) => p.id === i.productId);
      let cappedQty = qty;
      if (prod) {
        const effStock = calcEffectiveStock(prod);
        // CŨ: if (effStock !== null) cappedQty = Math.min(qty, Math.round((effStock + i.quantity) * 1000) / 1000);
        // MỚI: chỉ cap khi effStock > 0, còn âm/0 thì cho nhập thoải mái (sẽ block ở nút tạo đơn)
        if (effStock !== null && effStock > 0) {
          cappedQty = Math.min(qty, Math.round((effStock + i.quantity) * 1000) / 1000);
        }
      }
      return { ...i, quantity: cappedQty };
    }));
  }, [calcEffectiveStock]);

  const overridePrice = useCallback((cartId, newPrice, isManual = false) => {
    setCartItems((prev) => prev.map((i) => {
      if (i.id !== cartId) return i;
      return { ...i, unitPrice: newPrice, originalUnitPrice: i.originalUnitPrice ?? i.unitPrice, priceSource: isManual ? 'MANUAL' : i.priceSource, isManualPrice: isManual ? true : i.isManualPrice, tierId: isManual ? null : i.tierId, tierName: isManual ? null : i.tierName };
    }));
  }, []);

  const handleVatRateChange = useCallback((cartId, newRate) => {
    setCartItems(prev => prev.map(i => { if (i.id !== cartId) return i; if ((i.vatMode ?? 'INCLUSIVE') === 'INCLUSIVE') return i; return { ...i, vatRate: newRate }; }));
  }, []);

  const togglePromo = useCallback((cartId, enable, note) => {
    setCartItems((prev) => prev.map((i) => {
      if (i.id !== cartId) return i;
      if (enable) return { ...i, isPromo: true, promoNote: note || '', _priceBeforePromo: i._priceBeforePromo ?? i.unitPrice };
      return { ...i, isPromo: false, promoNote: '', unitPrice: i._priceBeforePromo ?? i.unitPrice, _priceBeforePromo: undefined };
    }));
  }, []);

  const removeItem = useCallback((cartId) => {
    setCartItems((prev) => {
      const item = prev.find(i => i.id === cartId);
      if (item) {
        const remaining = prev.filter(i => i.id !== cartId && i.productId === item.productId);
        if (remaining.length === 0) {
          setPriceChangedIds(ids => { const n = new Set(ids); n.delete(item.productId); return n; });
        }
      }
      const next = prev.filter((i) => i.id !== cartId);

      // Tính lại held từ next cart cho TẤT CẢ ingredients
      const newIngMap = {};
      for (const ci of next) {
        const prod = productsRef.current.find(p => p.id === ci.productId);
        if (!prod?.ingredients?.length) continue;
        const effectiveQty = (ci.saleType === 'BOX' && ci.unitsPerBox > 0)
          ? ci.quantity * ci.unitsPerBox : ci.quantity;
        for (const ing of prod.ingredients) {
          const k = String(ing.ingredientId);
          newIngMap[k] = (newIngMap[k] || 0) + effectiveQty * (Number(ing.quantity) || 1);
        }
      }

      // Update heldByAll local ngay — không chờ WS round-trip
      // Chỉ update các ingredient liên quan đến món bị xóa
      const deletedProd = productsRef.current.find(p => p.id === item?.productId);
      if (deletedProd?.ingredients?.length) {
        setHeldByAll(prev => {
          const updated = { ...prev };
          for (const ing of deletedProd.ingredients) {
            const k = String(ing.ingredientId);
            // Set về giá trị mới từ next cart, hoặc 0 nếu không còn
            updated[k] = newIngMap[k] ?? 0;
          }
          return updated;
        });
      }

      // Flush server để đồng bộ
      const holdItems = Object.entries(newIngMap).map(([ingredientId, qty]) => ({
        ingredientId: Number(ingredientId), qty
      }));
      setTimeout(() => {
        if (holdItems.length > 0) {
          cartHoldApi.update(selectedWarehouse?.id, holdItems).catch(() => { });
        } else {
          cartHoldApi.release().catch(() => { });
        }
      }, 0);

      return next;
    });
  }, [selectedWarehouse, setHeldByAll]);

  const clearCart = useCallback(() => {
    setCartItems([]); setCustomerState(null); setNotes(''); setDiscount(0);
    setSurchargeItems([]); setPriceChangedIds(new Set()); setCountdownSeconds(0);
    cartHoldApi.release().catch(() => { });
  }, []);

  const calcNet = (item) => calcNetPrice(item.unitPrice, item.vatRate, item.vatMode);
  const calcGross = (item) => Number(item.unitPrice);

  const promoTotal = cartItems.reduce((s, i) => {
    if (!i.isPromo) return s;
    const origPrice = Number(i._priceBeforePromo ?? i.unitPrice);
    return s + calcNetPrice(origPrice, i.vatRate, i.vatMode) * Number(i.quantity);
  }, 0);

  const subtotalNet = cartItems.reduce((s, i) => {
    if (i.isPromo) return s;
    const mode = i.vatMode ?? 'INCLUSIVE';
    return s + (mode === 'INCLUSIVE' ? calcGross(i) : calcNet(i)) * Number(i.quantity);
  }, 0);

  const itemDiscountTotal = cartItems.reduce((s, i) => {
    if (i.isPromo) return s;
    const d = i.itemDiscountRate ?? 0;
    if (!d) return s;
    const mode = i.vatMode ?? 'INCLUSIVE';
    const base = mode === 'INCLUSIVE' ? calcGross(i) * Number(i.quantity) : calcNet(i) * Number(i.quantity);
    return s + base * (d / 100);
  }, 0);

  const subtotalAfterItemDiscount = subtotalNet - itemDiscountTotal;
  const maxDiscountFixed = Math.round(subtotalAfterItemDiscount * 0.1);
  const discountAmt = discountFixedAmt !== null
    ? Math.min(discountFixedAmt, maxDiscountFixed)
    : Math.round(subtotalAfterItemDiscount * discount) / 100;
  const subtotalAfterAllDiscountNet = subtotalAfterItemDiscount - discountAmt;
  const surchargeNum = surchargeItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const vatBreakdown = useMemo(() => {
    const map = {};
    for (const i of cartItems) {
      if (i.isPromo) continue;
      const rate = i.vatRate ?? 0;
      const mode = i.vatMode ?? 'INCLUSIVE';
      if (rate === 0) continue;
      const qty = Number(i.quantity);
      const baseLine = mode === 'INCLUSIVE' ? calcGross(i) * qty : calcNet(i) * qty;
      const d = i.itemDiscountRate ?? 0;
      const lineItemDiscount = d > 0 ? baseLine * (d / 100) : 0;
      const proportion = subtotalNet > 0 ? baseLine / subtotalNet : 1;
      const lineBillDiscount = discountAmt * proportion;
      const lineAfterDiscount = baseLine - lineItemDiscount - lineBillDiscount;
      const vatAmt = mode === 'INCLUSIVE' ? lineAfterDiscount * rate / (100 + rate) : lineAfterDiscount * rate / 100;
      const key = `${rate}|${mode}`;
      if (!map[key]) map[key] = { rate, mode, vatAmt: 0 };
      map[key].vatAmt += vatAmt;
    }
    return Object.values(map).sort((a, b) => a.rate - b.rate);
  }, [cartItems, subtotalNet, itemDiscountTotal, discountAmt]);

  const exclusiveVatTotal = vatBreakdown.filter(g => g.mode === 'EXCLUSIVE').reduce((s, g) => s + g.vatAmt, 0);
  const total = subtotalAfterAllDiscountNet + exclusiveVatTotal + surchargeNum;

  const setCustomer = useCallback((newCustomer) => { setCustomerState(newCustomer); }, []);
  const handleDiscountFixedOpen = useCallback(() => { setDiscount(0); setDiscountFixedAmt(0); setDiscountFixedDisplay(''); }, []);
  const handleDiscountFixedClear = useCallback(() => { setDiscountFixedAmt(null); setDiscountFixedDisplay(''); }, []);
  const handleDiscountFixedChange = useCallback((e) => {
    const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    setDiscountFixedDisplay(raw);
    const num = raw === '' ? 0 : parseFloat(raw);
    setDiscountFixedAmt(isNaN(num) ? 0 : num);
  }, []);

  const handlePriceChanged = useCallback(async (message) => {
    const changedName = parseChangedProductName(message);
    const fresh = await productApi.getAll({ page: 0, size: 200, warehouseId: selectedWarehouse?.id });
    if (!fresh?.data?.data?.content) return;
    const freshProducts = fresh.data.data.content;
    setProducts(freshProducts);
    const newChangedIds = new Set();
    setCartItems(prev => prev.map(item => {
      if (item.isManualPrice || item.priceSource === 'MANUAL') return item;
      const freshProduct = freshProducts.find(p => p.id === item.productId);
      if (!freshProduct) return item;
      let freshPrice;
      if (item.priceSource === 'TIER' && item.tierId) {
        const freshTier = freshProduct.priceTiers?.find(t => t.id === item.tierId);
        freshPrice = freshTier ? Number(freshTier.price) : Number(freshProduct.basePrice);
      } else { freshPrice = Number(freshProduct.basePrice); }
      if (Math.abs(freshPrice - item.unitPrice) > 1) {
        newChangedIds.add(item.productId);
        return { ...item, unitPrice: freshPrice, originalUnitPrice: freshPrice, vatRate: freshProduct.vatRate ?? item.vatRate, vatMode: freshProduct.vatMode ?? item.vatMode };
      }
      return item;
    }));
    if (newChangedIds.size > 0) setPriceChangedIds(prev => new Set([...prev, ...newChangedIds]));
    toast(changedName ? `Giá "${changedName}" đã được cập nhật.` : 'Một số giá đã thay đổi.', 'warning');
  }, [selectedWarehouse, toast]);

  const handleSaveDraftConfirm = useCallback(async (opts) => {
    // opts = { type: 'DRAFT' } hoặc { type: 'SCHEDULED', scheduledAt, orderedByName, receiverName, showPrices, hideAllPrices }
    setSaveDraftModalOpen(false);

    if (cartItems.length === 0) { toast('Giỏ hàng trống', 'warning'); return; }
    setSavingDraft(true);

    try {
      const payload = {
        customerId: customer?.id || null,
        customerName: customer?.contactName || customer?.name || null,
        customerPhone: customer?.selectedReceiver?.receiverPhone || customer?.phone || null,
        customerEmail: customer?.email || null,
        shippingAddress: customer?.selectedReceiver?.receiverAddress || null,
        receiverName: opts.receiverName ?? (customer?.selectedReceiver?.receiverName || null),
        receiverPhone: customer?.selectedReceiver?.receiverPhone || null,
        receiverAddress: customer?.selectedReceiver?.receiverAddress || null,
        receiverInfoId: customer?.selectedReceiver?.id || null,
        notes,
        paymentMethod,
        discountRate: discountFixedAmt ? 0 : discount,
        discountAmount: discountFixedAmt ? Math.min(discountFixedAmt, maxDiscountFixed) : null,
        surchargeItems: surchargeItems.filter(i => Number(i.amount) > 0),
        warehouseId: selectedWarehouse?.id || null,
        warehouseName: selectedWarehouse?.name || null,
        // Chỉ dùng deliveryDatetime cho đơn thường, SCHEDULED dùng scheduledAt
        deliveryDatetime: opts.type === 'SCHEDULED' ? null : null,
        orderedByName: opts.orderedByName ?? null,
        showPrices: opts.showPrices ?? true,
        hideAllPrices: opts.hideAllPrices ?? false,
        // ── Scheduled ──────────────────────────────────────────────────────
        type: opts.type || 'DRAFT',
        scheduledAt: opts.scheduledAt ?? null,
        items: cartItems.map(i => ({
          productId: i.productId,
          productName: i.productName,
          productImageUrl: i.productImageUrl,
          unit: i.unit,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          basePrice: i.basePrice,
          priceMode: i.priceSource === 'MANUAL' ? 'BASE' : (i.priceSource === 'TIER' ? 'TIER' : 'BASE'),
          tierId: i.isPromo ? null : i.tierId,
          tierName: i.tierName,
          isManualPrice: i.priceSource === 'MANUAL',
          vatRate: i.vatRate,
          vatMode: i.vatMode,
          saleType: i.saleType || 'RETAIL',
          unitsPerBox: i.unitsPerBox,
          isPromo: i.isPromo,
          promoNote: i.promoNote,
          itemDiscountRate: i.itemDiscountRate || 0,
          notes: i.notes,
          subtotal: calcNet(i) * Number(i.quantity),
        })),
      };

      await cartHoldApi.release().catch(() => { });
      if (currentDraftId) await draftApi.delete(currentDraftId).catch(() => { });

      const res = await draftApi.save(payload);
      setCurrentDraftId(res?.data?.data?.id || null);

      const msg = opts.type === 'SCHEDULED'
        ? 'Đã lưu đơn hẹn giờ thành công'
        : 'Đã lưu đơn nháp thành công';
      toast(msg, 'success');
      clearCart();
      setCurrentDraftId(null);
    } catch (err) {
      toast(err?.response?.data?.message || 'Lỗi khi lưu đơn nháp', 'error');
    } finally {
      setSavingDraft(false);
    }
  }, [cartItems, customer, notes, paymentMethod, discount, discountFixedAmt, maxDiscountFixed,
    surchargeItems, selectedWarehouse, clearCart, toast, currentDraftId]);


  const handleOpenDeliveryModal = useCallback(() => {
    if (!customer) { toast('Vui lòng chọn khách hàng', 'warning'); return; }
    if (cartItems.length === 0) { toast('Giỏ hàng trống', 'warning'); return; }
    setDeliveryModalOpen(true);
  }, [customer, cartItems, toast]);

  const handleSubmit = useCallback(async (deliveryDatetime, orderedByName, showPrices = true, recipientName = null, hideAllPrices = false) => {
    setDeliveryModalOpen(false);
    if (!customer || cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const payload = {
        customerId: customer.id, customerName: customer.contactName || customer.name,
        customerPhone: customer.selectedReceiver?.receiverPhone || customer.phone,
        shippingAddress: customer.selectedReceiver?.receiverAddress || '',
        receiverName: recipientName !== null ? recipientName : (customer.selectedReceiver?.receiverName || null),
        receiverPhone: customer.selectedReceiver?.receiverPhone || customer.phone,
        receiverAddress: customer.selectedReceiver?.receiverAddress || '',
        notes, paymentMethod,
        discountRate: discountFixedAmt !== null ? 0 : discount,
        discountAmount: discountFixedAmt !== null ? Math.min(discountFixedAmt, maxDiscountFixed) : undefined,
        surchargeItems: surchargeItems.filter(i => Number(i.amount) > 0),
        warehouseId: selectedWarehouse?.id,
        deliveryDatetime: deliveryDatetime ?? null,
        orderedByName: orderedByName || undefined,
        showPrices: showPrices,
        hideAllPrices: hideAllPrices,
        items: cartItems.map((i) => ({
          productId: i.productId,
          tierId: (i.isPromo || i.priceSource !== 'TIER') ? undefined : i.tierId,
          quantity: i.quantity,
          sentUnitPrice: i.isPromo ? 0 : ((i.saleType === 'BOX' && i.unitsPerBox > 0) ? i.unitPrice / i.unitsPerBox : i.unitPrice),
          priceMode: i.isPromo ? 'BASE' : (i.priceSource === 'TIER' ? 'TIER' : 'BASE'),
          discountPercent: (!i.isPromo && (i.itemDiscountRate ?? 0) > 0) ? i.itemDiscountRate : undefined,
          isManualPrice: i.isPromo ? true : (i.priceSource === 'MANUAL'),
          saleType: i.saleType || 'RETAIL',
          notes: i.isPromo ? `[KM]${i.promoNote ? ' ' + i.promoNote : ''}` : (i.notes || undefined),
          vatRate: i.vatRate,
          vatMode: i.vatMode,
        })),
      };

      const res = await orderApi.create(payload);
      const body = res.data;
      if (body?.code === PRICE_CHANGED_CODE) { await handlePriceChanged(body.message); return; } // ❌ không xóa draft
      if (body?.code !== 900 || !body?.success) { toast(body?.message || 'Lỗi khi tạo đơn hàng', 'error'); return; } // ❌ không xóa draft
      await cartHoldApi.release().catch(() => { });
      // ✅ Chỉ xóa draft khi thành công
      if (currentDraftId) { await draftApi.delete(currentDraftId).catch(() => { }); }
      const orderCode = body?.data?.orderCode;
      toast(`Tạo đơn hàng thành công${orderCode ? ': ' + orderCode : ''}`, 'success');
      clearCart(); setMobileCartOpen(false);

      const fresh = await productApi.getAll({ page: 0, size: 200, warehouseId: selectedWarehouse?.id });
      if (fresh?.data?.data?.content) setProducts(fresh.data.data.content);
    } catch (err) {
      const body = err?.response?.data;
      if (body?.code === PRICE_CHANGED_CODE) { await handlePriceChanged(body.message); return; } // ❌ không xóa draft
      toast(body?.message || 'Lỗi khi tạo đơn hàng', 'error');
      // ❌ không có draftApi.delete ở đây
    } finally { setSubmitting(false); }
  }, [customer, cartItems, notes, paymentMethod, discount, discountFixedAmt, maxDiscountFixed, surchargeNum, selectedWarehouse, clearCart, handlePriceChanged, toast]);

  const [pendingSaleProduct, setPendingSaleProduct] = useState(null);

  const hasOutOfStockItems = useMemo(() => {
    return cartItems.some(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod?.ingredients?.length) return false;
      // Kiểm tra từng ingredient — so sánh actualStock với tổng held của mình
      for (const ing of prod.ingredients) {
        const key = String(ing.ingredientId);
        const actualStock = Number(ing.stockQuantity);
        const heldByOthers = Number(heldByAll[key] || 0);
        // held của mình = qty trong giỏ * qtyPerUnit
        const effectiveQty = (item.saleType === 'BOX' && item.unitsPerBox > 0)
          ? item.quantity * item.unitsPerBox : item.quantity;
        const myHeld = effectiveQty * (Number(ing.quantity) || 1);
        // Tồn thực tế cho item này = actualStock - (heldByOthers - myHeld)
        // Nếu myHeld > actualStock thì không đủ
        if (myHeld > actualStock) return true;
      }
      return false;
    });
  }, [cartItems, products, heldByAll]);

  const [updatingPrices, setUpdatingPrices] = useState(false);

  const handleRefreshPrices = useCallback(async () => {
    setUpdatingPrices(true);
    try { await handlePriceChanged(''); }
    finally { setUpdatingPrices(false); }
  }, [handlePriceChanged]);

  const cartPanelProps = {
    cartItems, customer, notes, paymentMethod, discount, surchargeItems,
    subtotalNet, discountAmt, surchargeNum, vatBreakdown, itemDiscountTotal, promoTotal, total,
    submitting, priceChangedIds, selectedWarehouse, maxDiscountFixed,
    exclusiveVatTotal: 0, inclusiveVatTotal: 0,
    onOpenCustomerModal: () => setCustomerModalOpen(true),
    onClearCustomer: () => setCustomerState(null),
    onClearCart: clearCart, onNotesChange: setNotes, onPaymentChange: setPaymentMethod,
    onDiscountChange: (d) => { setDiscount(d); setDiscountFixedAmt(null); setDiscountFixedDisplay(''); },
    onSurchargeItemsChange: setSurchargeItems,
    discountFixedAmt, discountFixedDisplay,
    onDiscountFixedOpen: handleDiscountFixedOpen,
    onDiscountFixedChange: handleDiscountFixedChange,
    onDiscountFixedClear: handleDiscountFixedClear,
    onUpdateQty: updateQty, onRemoveItem: removeItem, onPriceOverride: overridePrice,
    onItemDiscountChange: (cartId, pct) => {
      setCartItems(prev => prev.map(i => {
        if (i.id !== cartId) return i;
        const max = i.maxDiscountRate || 0;
        const capped = max > 0 ? Math.min(pct, max) : pct;
        return { ...i, itemDiscountRate: Math.max(0, Math.min(100, capped)) };
      }));
    },
    onPromoToggle: togglePromo, onVatRateChange: handleVatRateChange,
    onTierSelect: handleTierSelect, onSubmit: handleOpenDeliveryModal,
    onSaveDraft: () => setSaveDraftModalOpen(true), savingDraft, countdownSeconds,
    cartContainerRef,
    hasOutOfStockItems,
    onUpdatePrices: handleRefreshPrices,
    updatingPrices,
  };



  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-[#FAF7F2]">
      {/* Mobile cart bar */}
      <div className="lg:hidden flex-shrink-0">
        <button onClick={() => setMobileCartOpen(!mobileCartOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#1C1C1E] text-white">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-[#C9A84C]" />
            <span className="text-sm font-semibold">Giỏ hàng {cartItems.length > 0 && `(${cartItems.length})`}</span>
          </div>
          <div className="flex items-center gap-2">
            {countdownSeconds > 0 && (
              <div className="text-xs font-mono bg-amber-50 px-2 py-1 rounded-full text-amber-700">
                ⏱️ {Math.floor(countdownSeconds / 60)}:{Math.floor(countdownSeconds % 60).toString().padStart(2, '0')}
              </div>
            )}
            <span className="text-[#C9A84C] text-sm font-bold">{formatPrice(total)}</span>
            <ChevronDown size={16} className={`text-[#8E8878] transition-transform ${mobileCartOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {mobileCartOpen && (
          <div className="fixed inset-x-0 bottom-0 top-[57px] z-50 bg-white shadow-lg overflow-y-auto">
            <CartPanel {...cartPanelProps} />
            <button onClick={() => setMobileCartOpen(false)} className="sticky bottom-0 w-full py-3.5 bg-[#C9A84C] text-white text-sm font-semibold border-t border-[#b8963d]">
              ✕ Đóng giỏ hàng
            </button>
          </div>
        )}
      </div>

      {/* Product list */}
      <div className={`flex-1 flex flex-col overflow-hidden ${mobileCartOpen ? 'hidden lg:flex' : 'flex'}`}>
        <div className="flex-shrink-0 px-3 pt-3 pb-2 bg-white border-b border-[#F0EBE3] space-y-2">
          {warehouses.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8E8878] shrink-0">🏭 Kho:</span>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {warehouses.map(w => (
                  <button key={w.id} onClick={() => { setSelectedWarehouse(w); setCartItems([]); setPriceChangedIds(new Set()); setCountdownSeconds(0); cartHoldApi.release().catch(() => { }); }}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedWarehouse?.id === w.id ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8E8878]" />
              <input type="text" placeholder="Tìm món..." value={inputSearch}
                onChange={(e) => { setInputSearch(e.target.value); setSearchQuery(e.target.value); }}
                className="input-elegant w-full rounded-xl pl-9 pr-4 py-2 text-sm" />
            </div>
            {[{ field: 'name', label: 'Tên' }, { field: 'price', label: 'Giá' }].map(({ field, label }) => {
              const active = sortField === field;
              const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <button key={field} onClick={() => { if (!active) { setSortField(field); setSortDir('asc'); } else if (sortDir === 'asc') setSortDir('desc'); else { setSortField(null); setSortDir('asc'); } }}
                  className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${active ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-[#E8DDD0] text-[#8E8878] hover:border-[#C9A84C]'}`}>
                  <Icon size={13} />{label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            <button onClick={() => setActiveCategory('ALL')}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === 'ALL' ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
              Tất cả
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeCategory === cat.id ? 'bg-[#C9A84C] text-white' : 'bg-[#F0EBE3] text-[#8E8878] hover:bg-[#E8DDD0]'}`}>
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
              <span className="text-3xl">🔍</span><p className="text-sm">Không tìm thấy sản phẩm</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((p) => {
                const cartQty = cartItems.filter((i) => i.productId === p.id).reduce((s, i) => s + i.quantity, 0);
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

      {/* Desktop cart panel */}
      <div ref={desktopCartRef} className="hidden lg:block w-80 xl:w-96 border-l border-[#E8DDD0] overflow-y-auto">
        <CartPanel {...cartPanelProps} />
      </div>

      <CustomerSearchModal open={customerModalOpen} onClose={() => setCustomerModalOpen(false)} onSelect={setCustomer} selected={customer} />

      {pendingSaleProduct && (
        <SaleTypeModal
          product={pendingSaleProduct}
          customer={customer}
          onConfirm={({ saleType }) => {
            if (pendingSaleProduct.priceTiers?.length > 0) {
              setTierModalProduct({ ...pendingSaleProduct, _saleType: saleType });
              setTierModalCartId(null);
            } else {
              const upb = (saleType === 'BOX' && pendingSaleProduct.unitsPerBox > 0) ? pendingSaleProduct.unitsPerBox : 1;
              addToCartDirect(pendingSaleProduct, saleType, 'BASE', null, null, pendingSaleProduct.basePrice * upb);
            }
            setPendingSaleProduct(null);
          }}
          onClose={() => setPendingSaleProduct(null)}
        />
      )}

      {tierModalProduct && (
        <TierSelectModal
          product={tierModalProduct}
          currentTierId={tierModalCartId ? cartItems.find(i => i.id === tierModalCartId)?.tierId : null}
          currentPriceSource={tierModalCartId ? cartItems.find(i => i.id === tierModalCartId)?.priceSource : 'BASE'}
          onConfirm={handleTierConfirm}
          onClose={() => { setTierModalProduct(null); setTierModalCartId(null); }}
        />
      )}

      {saveDraftModalOpen && (
        <SaveDraftModal
          customer={customer}
          hasCustomer={!!customer}
          onClose={() => setSaveDraftModalOpen(false)}
          onConfirm={handleSaveDraftConfirm}
        />
      )}

      {deliveryModalOpen && (
        <DeliveryTimeModal
          onConfirm={(ts, orderedByName, showPrices, recipientName, hideAllPrices) =>
            handleSubmit(ts, orderedByName, showPrices, recipientName, hideAllPrices)
          }
          onClose={() => setDeliveryModalOpen(false)}
        />
      )}
    </div>
  );
}