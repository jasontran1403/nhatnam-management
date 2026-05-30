import { useLang } from '../../context/LangContext';
import { useState, useRef } from 'react';
import { Trash2, Pencil, Percent, Check, Gift, ChevronDown } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Format số tiền, tối đa 2 chữ số thập phân
function fmt(price) {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price || 0) + ' đ';
}

// Tính đơn giá chưa thuế từ giá gốc
// INCLUSIVE: netPrice = price / (1 + rate/100)
// EXCLUSIVE: netPrice = price (thuế tính thêm)
function calcNetPrice(price, vatRate, vatMode) {
  const rate = vatRate ?? 0;
  const mode = vatMode ?? 'INCLUSIVE';
  if (rate === 0) return price;
  if (mode === 'INCLUSIVE') {
    return price / (1 + rate / 100);
  }
  // EXCLUSIVE: giá gốc chưa thuế
  return price;
}

const DECIMAL_UNITS = ['kg', 'kgs', 'lít', 'lit', 'l', 'liter', 'litre'];
function allowDecimal(unit, saleType) {
  if (saleType === 'BOX') return false;
  return DECIMAL_UNITS.includes((unit || '').toLowerCase().trim());
}

// VAT rates cho EXCLUSIVE
const EXCLUSIVE_VAT_OPTIONS = [0, 5, 8, 10, 12];

// Badge màu theo priceSource
function PriceBadge({ priceSource, tierName }) {
  if (priceSource === 'MANUAL') {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold
        bg-purple-100 text-purple-700 border border-purple-200 whitespace-nowrap">
        Thủ công
      </span>
    );
  }
  if (priceSource === 'TIER') {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold
        bg-orange-100 text-orange-700 border border-orange-200 whitespace-nowrap">
        {tierName || 'Giá sỉ'}
      </span>
    );
  }
  // BASE
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold
      bg-sky-100 text-sky-700 border border-sky-200 whitespace-nowrap">
      Giá lẻ
    </span>
  );
}

export default function CartItem({
  item, onUpdate, onRemove, onPriceOverride, onDiscountChange, onPromoToggle,
  onVatRateChange,   // (cartId, newRate) — chỉ cho EXCLUSIVE
  onTierSelect,      // () → mở TierSelectModal từ cha
}) {
  const { t } = useLang();

  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDisplay, setPriceDisplay] = useState('');
  const [editingQty, setEditingQty] = useState(false);
  const [qtyDisplay, setQtyDisplay] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [showPromoNote, setShowPromoNote] = useState(false);
  const [promoNoteInput, setPromoNoteInput] = useState('');
  const [showVatPicker, setShowVatPicker] = useState(false);

  const inputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const discountInputRef = useRef(null);
  const promoNoteRef = useRef(null);

  const isPriceOverridden = item.priceSource === 'MANUAL';
  const itemDiscountPct = item.itemDiscountRate ?? 0;
  const maxDiscount = item.maxDiscountRate ?? 0;
  const isPromo = item.isPromo === true;
  const promoNote = item.promoNote || '';

  const vatRate = item.vatRate ?? 0;
  const vatMode = item.vatMode ?? 'INCLUSIVE';
  const isInclusive = vatMode === 'INCLUSIVE';
  const isExclusive = vatMode === 'EXCLUSIVE';

  // Đơn giá chưa thuế để hiển thị
  const netUnitPrice = calcNetPrice(item.unitPrice, vatRate, vatMode);
  // Thành tiền dòng = netUnitPrice × qty
  const lineBaseTotal = isInclusive
    ? Number(item.unitPrice) * item.quantity   // INCLUSIVE: dùng gross
    : calcNetPrice(item.unitPrice, vatRate, vatMode) * item.quantity; // EXCLUSIVE: dùng net


  // ── Qty ───────────────────────────────────────────────────────────
  const handleQtyClick = () => {
    setQtyDisplay(String(item.quantity));
    setEditingQty(true);
    setTimeout(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); }, 30);
  };
  const commitQty = () => {
    let val = parseFloat(qtyDisplay);
    if (!isNaN(val) && val > 0) {
      if (!allowDecimal(item.unit, item.saleType)) val = Math.max(1, Math.round(val));
      onUpdate(item.id, val);
    }
    setEditingQty(false);
  };

  // ── Price override → set priceSource = MANUAL ────────────────────
  const handlePriceClick = () => {
    // Hiển thị giá gốc (trước khi trừ VAT) để user nhập
    setPriceDisplay(String(item.unitPrice));
    setEditingPrice(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
  };
  const commitPrice = () => {
    const val = parseFloat(priceDisplay.replace(',', '.'));
    const maxPrice = (item.originalUnitPrice ?? item.unitPrice) * 5;
    if (!isNaN(val) && val >= 0) {
      onPriceOverride(item.id, Math.min(val, maxPrice), true);
    }
    setEditingPrice(false);
  };

  // ── Discount ──────────────────────────────────────────────────────
  const openDiscount = () => {
    setDiscountInput(itemDiscountPct > 0 ? String(itemDiscountPct) : '');
    setShowDiscount(true);
    setTimeout(() => { discountInputRef.current?.focus(); discountInputRef.current?.select(); }, 30);
  };
  const commitDiscount = () => {
    const val = parseInt(discountInput, 10);
    const max = maxDiscount > 0 ? maxDiscount : 100;
    if (!isNaN(val) && val >= 0) {
      if (onDiscountChange) onDiscountChange(item.id, Math.min(val, max));
    }
    setShowDiscount(false);
  };
  const clearDiscount = () => {
    if (onDiscountChange) onDiscountChange(item.id, 0);
    setDiscountInput('');
    setShowDiscount(false);
  };

  // ── Promo ─────────────────────────────────────────────────────────
  const openPromoNote = () => {
    setPromoNoteInput(promoNote);
    setShowPromoNote(true);
    setTimeout(() => { promoNoteRef.current?.focus(); }, 30);
  };
  const commitPromoNote = (note) => {
    if (onPromoToggle) onPromoToggle(item.id, true, note ?? promoNoteInput);
    setShowPromoNote(false);
  };
  const togglePromo = () => {
    if (isPromo) {
      if (onPromoToggle) onPromoToggle(item.id, false, '');
      setShowPromoNote(false);
    } else {
      openPromoNote();
    }
  };

  // ── VAT picker (chỉ EXCLUSIVE) ────────────────────────────────────
  const handleVatBadgeClick = () => {
    if (isInclusive) return; // không cho đổi
    setShowVatPicker(p => !p);
  };
  const selectVatRate = (rate) => {
    if (onVatRateChange) onVatRateChange(item.id, rate);
    setShowVatPicker(false);
  };

  const imgUrl = item.imageUrl
    ? item.imageUrl.startsWith('http') ? item.imageUrl : `${BASE_URL}/api/auth${item.imageUrl}`
    : null;

  const hasDiscount = itemDiscountPct > 0;

  return (
    <div className="flex items-start gap-2.5 py-3 border-b border-[#F0EBE3] last:border-0">
      {/* Image */}
      <div className="w-10 h-10 rounded-lg bg-[#F0EBE3] overflow-hidden shrink-0 mt-0.5">
        {imgUrl
          ? <img src={imgUrl} alt={item.productName} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#1C1C1E] truncate">{item.productName}</p>

        {/* Badges hàng 1: sale type + price source + VAT */}
        <div className="flex items-center gap-1 flex-wrap mt-0.5">
          {item.saleType === 'BOX' ? (
            <span className="text-[9px] rounded px-1.5 py-0.5 font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              📦 Thùng ({item.unitsPerBox} {item.unit}/thùng)
            </span>
          ) : (
            <span className="text-[9px] rounded px-1.5 py-0.5 font-semibold bg-sky-50 text-sky-600 border border-sky-200">
              Lẻ
            </span>
          )}

          {/* Badge trạng thái giá — click mở lại tier selector */}
          <button
            onClick={() => { if (onTierSelect) onTierSelect(item.id); }}
            className="flex items-center gap-0.5 hover:opacity-80 transition-opacity"
            title="Đổi khung giá"
          >
            <PriceBadge priceSource={item.priceSource} tierName={item.tierName} />
          </button>

          {/* VAT badge */}
          <button
            onClick={handleVatBadgeClick}
            className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold border transition-colors
              ${vatRate > 0
                ? isInclusive
                  ? 'bg-amber-50 text-amber-700 border-amber-200 cursor-default'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                : isExclusive
                  ? 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 cursor-pointer'
                  : 'bg-gray-50 text-gray-400 border-gray-200 cursor-default'
              }`}
            title={isInclusive ? 'VAT đã bao gồm trong giá, không thể đổi' : 'Chọn thuế VAT cộng thêm'}
          >
            {vatRate > 0
              ? `VAT ${vatRate}% ${isInclusive ? '(trong)' : '(ngoài)'}`
              : isExclusive ? 'Chọn VAT' : 'Không VAT'
            }
            {isExclusive && <ChevronDown size={8} />}
          </button>
        </div>

        {/* VAT picker dropdown (EXCLUSIVE only) */}
        {showVatPicker && isExclusive && (
          <div className="mt-1.5 flex items-center gap-1 flex-wrap bg-emerald-50 rounded-lg px-2 py-1.5 border border-emerald-200">
            <span className="text-[9px] text-emerald-700 font-semibold mr-1">Thuế %:</span>
            {EXCLUSIVE_VAT_OPTIONS.map(r => (
              <button
                key={r}
                onClick={() => selectVatRate(r)}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors
                  ${vatRate === r
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'}`}
              >
                {r}%
              </button>
            ))}
          </div>
        )}

        {/* VAT inclusive info */}
        {isInclusive && vatRate > 0 && (
          <p className="text-[9px] text-amber-600 mt-0.5">
            Đơn giá đã trừ ngược VAT {vatRate}%
          </p>
        )}

        {/* Price row */}
        <div className="flex items-center gap-1.5 mt-1">
          <div className="flex flex-col">
            {isPromo ? (
              <span className="text-xs font-bold text-rose-500 flex items-center gap-1">
                <Gift size={10} className="text-rose-400" /> 0 đ
              </span>
            ) : editingPrice ? (
              <div className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={priceDisplay}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = raw.split('.');
                    if (parts.length > 2) return;
                    if (parts[1]?.length > 2) return;
                    setPriceDisplay(raw);
                  }}
                  onBlur={commitPrice}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitPrice();
                    if (e.key === 'Escape') setEditingPrice(false);
                  }}
                  className="w-24 text-xs border-2 border-[#C9A84C] rounded-lg px-2 py-1 focus:outline-none font-semibold text-[#1C1C1E]"
                />
                <span className="text-[10px] text-[#8E8878]">đ</span>
              </div>
            ) : (
              <button onClick={handlePriceClick} className="flex items-center gap-1 group">
                {/* Hiển thị đơn giá CHƯA thuế */}
                <span className={`text-xs font-bold transition-colors
                  ${isPriceOverridden ? 'text-purple-600' : 'text-[#C9A84C] group-hover:text-[#A07830]'}`}>
                  {fmt(netUnitPrice)}
                </span>
                <Pencil size={9} className="text-[#C4B9A8] group-hover:text-[#C9A84C] transition-colors" />
              </button>
            )}
          </div>

          {/* Discount + Promo buttons */}
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            {!isPromo && (hasDiscount ? (
              <button onClick={openDiscount}
                className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full
                  bg-orange-100 text-orange-600 border border-orange-200 font-semibold hover:bg-orange-200 transition-colors">
                <Percent size={8} />
                -{itemDiscountPct}%
              </button>
            ) : (
              <button onClick={openDiscount}
                className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full
                  bg-[#F5F0E8] text-[#C4B9A8] border border-[#E8DDD0] hover:bg-[#EDE8DF] hover:text-[#8E8878] transition-colors">
                <Percent size={8} />
                CK
              </button>
            ))}
            <button onClick={togglePromo}
              className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full
                font-semibold border transition-colors
                ${isPromo
                  ? 'bg-rose-100 text-rose-600 border-rose-300 hover:bg-rose-200'
                  : 'bg-[#F5F0E8] text-[#C4B9A8] border-[#E8DDD0] hover:bg-rose-50 hover:text-rose-400 hover:border-rose-200'}`}>
              <Gift size={8} />
              KM
            </button>
          </div>
        </div>

        {/* Discount panel */}
        {showDiscount && (
          <div className="mt-1.5 flex items-center gap-1.5 bg-[#FAF7F2] rounded-lg px-2 py-1.5 border border-[#E8DDD0]">
            <input
              ref={discountInputRef}
              type="text" inputMode="numeric"
              value={discountInput}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                const max = maxDiscount > 0 ? maxDiscount : 100;
                if (raw === '' || Number(raw) <= max) setDiscountInput(raw);
              }}
              onKeyDown={e => { if (e.key === 'Enter') commitDiscount(); if (e.key === 'Escape') setShowDiscount(false); }}
              placeholder="0"
              className="w-10 text-xs text-center border border-[#E8DDD0] rounded-lg px-1 py-1
                focus:outline-none focus:border-[#C9A84C] bg-white font-semibold"
            />
            <span className="text-[10px] text-[#8E8878] flex-shrink-0">%</span>
            {maxDiscount > 0 && (
              <span className="text-[9px] text-[#C4B9A8] flex-1">tối đa {maxDiscount}%</span>
            )}
            <button onClick={commitDiscount}
              className="w-5 h-5 rounded-full bg-[#C9A84C] text-white flex items-center justify-center hover:bg-[#A07830] transition-colors flex-shrink-0">
              <Check size={10} />
            </button>
            {hasDiscount && (
              <button onClick={clearDiscount} className="text-[9px] text-red-400 hover:text-red-600 flex-shrink-0">
                xóa
              </button>
            )}
          </div>
        )}

        {/* Promo note panel */}
        {showPromoNote && (
          <div className="mt-1.5 flex items-center gap-1.5 bg-rose-50 rounded-lg px-2 py-1.5 border border-rose-200">
            <input
              ref={promoNoteRef}
              type="text"
              value={promoNoteInput}
              onChange={e => setPromoNoteInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitPromoNote();
                if (e.key === 'Escape') setShowPromoNote(false);
              }}
              placeholder="Ghi chú KM..."
              className="flex-1 text-[10px] border border-rose-200 rounded-lg px-2 py-1
                focus:outline-none focus:border-rose-400 bg-white text-[#1C1C1E]"
            />
            <button onClick={() => commitPromoNote()}
              className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-colors flex-shrink-0">
              <Check size={10} />
            </button>
          </div>
        )}
        {isPromo && promoNote && !showPromoNote && (
          <button onClick={openPromoNote}
            className="mt-0.5 text-[9px] text-rose-500 italic truncate max-w-full text-left hover:text-rose-700">
            📌 {promoNote}
          </button>
        )}

        {/* Thành tiền dòng */}
        {!isPromo && (
          <p className="text-[10px] text-[#8E8878] mt-0.5">
            = {fmt(lineBaseTotal)}
            {hasDiscount && (
              <span className="text-emerald-600 ml-1">
                → {fmt(lineBaseTotal * (1 - itemDiscountPct / 100))}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Qty + delete */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <button onClick={() => onRemove(item.id)}
          className="w-5 h-5 rounded-full text-[#C4B9A8] hover:text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors">
          <Trash2 size={11} />
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => onUpdate(item.id, item.quantity - 1)}
            className="w-6 h-6 rounded-full bg-[#F0EBE3] text-[#1C1C1E] text-sm font-bold flex items-center justify-center hover:bg-[#E8DDD0] transition-colors">
            −
          </button>
          {editingQty ? (
            <input
              ref={qtyInputRef}
              type="text"
              inputMode={allowDecimal(item.unit, item.saleType) ? 'decimal' : 'numeric'}
              value={qtyDisplay}
              onChange={e => {
                if (allowDecimal(item.unit, item.saleType)) {
                  const raw = e.target.value.replace(/[^0-9.]/g, '');
                  const parts = raw.split('.');
                  if (parts.length > 2) return;
                  if (parts[1]?.length > 3) return;
                  setQtyDisplay(raw);
                } else {
                  setQtyDisplay(e.target.value.replace(/[^0-9]/g, ''));
                }
              }}
              onBlur={commitQty}
              onKeyDown={e => { if (e.key === 'Enter') commitQty(); if (e.key === 'Escape') setEditingQty(false); }}
              className="w-14 text-xs font-bold text-center text-[#1C1C1E] border-2 border-[#C9A84C] rounded-lg px-1 py-2 focus:outline-none"
            />
          ) : (
            <span onClick={handleQtyClick}
              className="text-xs font-bold w-14 text-center text-[#1C1C1E] border border-[#E8DDD0] rounded-lg py-2 cursor-pointer hover:border-[#C9A84C] transition-colors block">
              {item.quantity}
            </span>
          )}
          <button onClick={() => onUpdate(item.id, item.quantity + 1)}
            className="w-6 h-6 rounded-full bg-[#F0EBE3] text-[#1C1C1E] text-sm font-bold flex items-center justify-center hover:bg-[#E8DDD0] transition-colors">
            +
          </button>
        </div>
      </div>
    </div>
  );
}