import { useLang } from '../../context/LangContext';
import { useState, useRef } from 'react';
import { Trash2, Percent, Check, Gift, ChevronDown } from 'lucide-react';

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

// Đơn vị cho phép nhập số lẻ. 'mét'/'m' thêm 08/2026 — dây, màng bọc, ống
// nhựa đều cắt được theo mét lẻ. 'bó' KHÔNG có ở đây: bó là đơn vị nguyên.
const DECIMAL_UNITS = ['kg', 'kgs', 'lít', 'lit', 'l', 'liter', 'litre', 'mét', 'met', 'm'];
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
        bg-purple-100 dark:bg-purple-500/18 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/28 whitespace-nowrap">
        Thủ công
      </span>
    );
  }
  if (priceSource === 'TIER') {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold
        bg-orange-100 dark:bg-orange-500/18 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/28 whitespace-nowrap">
        {tierName || 'Giá sỉ'}
      </span>
    );
  }
  // BASE
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold
      bg-sky-100 dark:bg-sky-500/18 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/28 whitespace-nowrap">
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

  /**
   * ĐƠN GIÁ HIỂN THỊ trên dòng "đơn giá × SL = tổng".
   *
   * <p>Phải là con số mà nhân đúng với số lượng ra được thành tiền, nếu không người bán
   * nhìn vào phép tính ngay trước mắt lại thấy sai. Với VAT trong giá (INCLUSIVE) thì đó
   * là giá gộp thuế; với VAT ngoài giá (EXCLUSIVE) là giá chưa thuế — đúng bằng hai
   * nhánh mà {@code lineBaseTotal} đang dùng.
   */
  const displayUnitPrice = isInclusive ? Number(item.unitPrice) : netUnitPrice;


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
  /**
   * DÒ NGƯỢC GIÁ VỀ ĐÚNG NGUỒN.
   *
   * <p>Người bán sửa tay một con số, nhưng con số đó có thể trùng đúng giá lẻ hoặc một
   * khung giá sỉ có sẵn. Khi đó dòng hàng phải mang lại nhãn gốc ("Giá lẻ" / "Sỉ 3")
   * thay vì "Giá thủ công".
   *
   * <p>Không chỉ là chuyện nhãn hiển thị: {@code priceSource} và {@code tierId} đi thẳng
   * vào đơn hàng và báo cáo giá bán. Đánh dấu MANUAL cho một đơn thực chất bán đúng khung
   * sỉ sẽ làm thống kê "bao nhiêu đơn phá giá" phồng lên sai.
   *
   * <p>Ưu tiên khung SỈ trước giá lẻ khi cả hai cùng khớp: khung sỉ là thứ được thoả
   * thuận với khách, còn giá lẻ chỉ là mặc định.
   *
   * @returns {{priceSource: string, tierId: ?number, tierName: ?string}}
   */
  const resolvePriceSource = (price) => {
    const perBox = (item.saleType === 'BOX' && item.unitsPerBox > 0) ? item.unitsPerBox : 1;
    // Dung sai nửa xu — giá đi qua phép nhân perBox nên hay lệch ở chữ số cuối.
    const same = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005;

    const tiers = Array.isArray(item.priceTiers) ? item.priceTiers : [];
    const hit = tiers.find(tr => same(price, Number(tr.price) * perBox));
    if (hit) {
      return { priceSource: 'TIER', tierId: hit.id, tierName: hit.tierName };
    }

    if (same(price, Number(item.basePrice) * perBox)) {
      return { priceSource: 'BASE', tierId: null, tierName: null };
    }

    return { priceSource: 'MANUAL', tierId: null, tierName: null };
  };

  const commitPrice = () => {
    const val = parseFloat(priceDisplay.replace(',', '.'));
    const maxPrice = (item.originalUnitPrice ?? item.unitPrice) * 5;

    if (!isNaN(val) && val >= 0) {
      const next = Math.min(val, maxPrice);

      // Bấm vào giá để xem rồi bấm ra ngoài là thao tác rất thường gặp. Không có chốt
      // này thì mỗi lần như vậy dòng hàng lại bị ghi đè nguồn giá dù không sửa gì.
      const current = Number(item.unitPrice);
      const unchanged = Number.isFinite(current) && Math.abs(next - current) < 0.005;

      if (!unchanged) onPriceOverride(item.id, next, true, resolvePriceSource(next));
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
    <div className="flex items-start gap-2.5 py-3 border-b border-line-soft last:border-0">
      {/* Image */}
      <div className="w-10 h-10 rounded-lg bg-surface-2 overflow-hidden shrink-0 mt-0.5">
        {imgUrl
          ? <img src={imgUrl} alt={item.productName} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-ink truncate">{item.productName}</p>

        {/* Badges hàng 1: sale type + price source + VAT */}
        <div className="flex items-center gap-1 flex-wrap mt-0.5">
          {item.saleType === 'BOX' ? (
            <span className="text-[9px] rounded px-1.5 py-0.5 font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/28">
              📦 Thùng ({item.unitsPerBox} {item.unit}/thùng)
            </span>
          ) : (
            <span className="text-[9px] rounded px-1.5 py-0.5 font-semibold bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-500/28">
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
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/28 cursor-default'
                  : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/28 hover:bg-emerald-100 dark:bg-emerald-500/18 cursor-pointer'
                : isExclusive
                  ? 'bg-canvas text-muted border-line hover:bg-emerald-50 dark:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-300 hover:border-emerald-200 dark:border-emerald-500/28 cursor-pointer'
                  : 'bg-canvas text-faint border-line cursor-default'
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
          <div className="mt-1.5 flex items-center gap-1 flex-wrap bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-2 py-1.5 border border-emerald-200 dark:border-emerald-500/28">
            <span className="text-[9px] text-emerald-700 dark:text-emerald-300 font-semibold mr-1">Thuế %:</span>
            {EXCLUSIVE_VAT_OPTIONS.map(r => (
              <button
                key={r}
                onClick={() => selectVatRate(r)}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors
                  ${vatRate === r
                    ? 'bg-emerald-600 text-white'
                    : 'bg-surface text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/35 hover:bg-emerald-100 dark:bg-emerald-500/18'}`}
              >
                {r}%
              </button>
            ))}
          </div>
        )}

        {/*
          DÒNG GIÁ — gộp đơn giá, số lượng và thành tiền vào MỘT dòng.
          Trước đây đơn giá và thành tiền nằm ở hai dòng rời nhau, người bán phải tự
          nhẩm xem hai con số có khớp nhau không. Dạng "đơn giá × SL = tổng" đọc thẳng
          được phép tính.

          Cả dòng là vùng bấm để sửa giá, thay cho icon bút bé xíu bên cạnh — vùng bấm
          rộng hơn nhiều, quan trọng khi thao tác trên máy tính bảng ở quầy.
        */}
        <div className="mt-1">
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
                className="w-24 text-xs border-2 border-gold rounded-lg px-2 py-1 focus:outline-none font-semibold text-ink"
              />
              <span className="text-[10px] text-muted">đ</span>
            </div>
          ) : (
            <button onClick={handlePriceClick}
              title="Bấm để sửa đơn giá"
              className="w-full flex items-baseline gap-1 flex-wrap text-left rounded-md
                         px-1 -mx-1 py-0.5 hover:bg-gold/10 transition-colors">
              <span className={`text-xs font-bold transition-colors
                ${isPriceOverridden ? 'text-purple-600 dark:text-purple-300' : 'text-gold'}`}>
                {fmt(displayUnitPrice)}
              </span>
              <span className="text-[10px] text-muted">× {item.quantity}</span>
              <span className="text-[10px] text-muted">=</span>
              <span className="text-xs font-bold text-ink">
                {fmt(hasDiscount ? lineBaseTotal * (1 - itemDiscountPct / 100) : lineBaseTotal)}
              </span>
              {hasDiscount && (
                <span className="text-[9px] text-faint line-through">{fmt(lineBaseTotal)}</span>
              )}
            </button>
          )}
        </div>

        {/* CK + KM — xuống dòng riêng để dòng giá không bị bóp chữ khi tên hàng dài */}
        <div className="flex items-center gap-1 flex-wrap mt-1">
          {!isPromo && (hasDiscount ? (
            <button onClick={openDiscount}
              className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full
                bg-orange-100 dark:bg-orange-500/18 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-500/28 font-semibold hover:bg-orange-200 dark:bg-orange-500/28 transition-colors">
              <Percent size={8} />
              -{itemDiscountPct}%
            </button>
          ) : (
            <button onClick={openDiscount}
              className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full
                bg-surface-2 text-faint border border-line hover:bg-surface-2 hover:text-muted transition-colors">
              <Percent size={8} />
              CK
            </button>
          ))}
          <button onClick={togglePromo}
            className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full
              font-semibold border transition-colors
              ${isPromo
                ? 'bg-rose-100 dark:bg-rose-500/18 text-rose-600 dark:text-rose-300 border-rose-300 dark:border-rose-500/35 hover:bg-rose-200 dark:bg-rose-500/28'
                : 'bg-surface-2 text-faint border-line hover:bg-rose-50 dark:bg-rose-500/10 hover:text-rose-400 hover:border-rose-200 dark:border-rose-500/28'}`}>
            <Gift size={8} />
            KM
          </button>
        </div>

        {/* Discount panel */}
        {showDiscount && (
          <div className="mt-1.5 flex items-center gap-1.5 bg-canvas rounded-lg px-2 py-1.5 border border-line">
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
              className="w-10 text-xs text-center border border-line rounded-lg px-1 py-1
                focus:outline-none focus:border-gold bg-surface font-semibold"
            />
            <span className="text-[10px] text-muted flex-shrink-0">%</span>
            {maxDiscount > 0 && (
              <span className="text-[9px] text-faint flex-1">tối đa {maxDiscount}%</span>
            )}
            <button onClick={commitDiscount}
              className="w-5 h-5 rounded-full bg-gold text-white flex items-center justify-center hover:bg-gold-deep transition-colors flex-shrink-0">
              <Check size={10} />
            </button>
            {hasDiscount && (
              <button onClick={clearDiscount} className="text-[9px] text-red-400 hover:text-red-600 dark:text-red-300 flex-shrink-0">
                xóa
              </button>
            )}
          </div>
        )}

        {/* Promo note panel */}
        {showPromoNote && (
          <div className="mt-1.5 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-2 py-1.5 border border-rose-200 dark:border-rose-500/28">
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
              className="flex-1 text-[10px] border border-rose-200 dark:border-rose-500/28 rounded-lg px-2 py-1
                focus:outline-none focus:border-rose-400 bg-surface text-ink"
            />
            <button onClick={() => commitPromoNote()}
              className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-colors flex-shrink-0">
              <Check size={10} />
            </button>
          </div>
        )}
        {isPromo && promoNote && !showPromoNote && (
          <button onClick={openPromoNote}
            className="mt-0.5 text-[9px] text-rose-500 italic truncate max-w-full text-left hover:text-rose-700 dark:text-rose-300">
            📌 {promoNote}
          </button>
        )}

      </div>

      {/* Qty + delete */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <button onClick={() => onRemove(item.id)}
          className="w-5 h-5 rounded-full text-faint hover:text-red-400 hover:bg-red-50 dark:bg-red-500/10 flex items-center justify-center transition-colors">
          <Trash2 size={11} />
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => onUpdate(item.id, item.quantity - 1)}
            className="w-6 h-6 rounded-full bg-surface-2 text-ink text-sm font-bold flex items-center justify-center hover:bg-surface-3 transition-colors">
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
              className="w-14 text-xs font-bold text-center text-ink border-2 border-gold rounded-lg px-1 py-2 focus:outline-none"
            />
          ) : (
            <span onClick={handleQtyClick}
              className="text-xs font-bold w-14 text-center text-ink border border-line rounded-lg py-2 cursor-pointer hover:border-gold transition-colors block">
              {item.quantity}
            </span>
          )}
          <button onClick={() => onUpdate(item.id, item.quantity + 1)}
            className="w-6 h-6 rounded-full bg-surface-2 text-ink text-sm font-bold flex items-center justify-center hover:bg-surface-3 transition-colors">
            +
          </button>
        </div>
      </div>
    </div>
  );
}