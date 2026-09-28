// src/components/seller/OrderExchangeModal.jsx
// Modal Hoàn / Đổi sản phẩm — 2 bước:
//   Bước 1: Chọn SP → Hoàn tiền hoặc Đổi SP mới
//   Bước 2: Xử lý hàng nhận về (Tiêu hủy | Nhập kho)
//
// THAY ĐỔI SO VỚI BẢN CŨ:
//  1. Bước 1: Hiển thị đúng quy cách (Thùng/hộp/kg). Số lượng hoàn:
//     - saleType=BOX (thùng): chỉ nhập nguyên, min=1 hộp, max=unitsPerBox*qty thùng.
//       Hiển thị "N thùng + M hộp" để dễ đọc.
//     - saleType=RETAIL (hộp/đơn vị số nguyên): chỉ nhập nguyên.
//     - unit là kg/g/... (số thực): cho phép nhập số thập phân.
//  2. Bước 2 (Đổi SP): ô tên sản phẩm thay bằng search-dropdown, tự điền
//     unit/đơn giá/vatRate/discountPct từ sản phẩm được chọn, chỉ tìm
//     trong kho của đơn gốc (order.warehouseId).
//  3. onSuccess gọi sau khi Bước 3 (Xử lý hàng) hoàn tất, không gọi sớm.
//
// THAY ĐỔI MỚI NHẤT:
//  A. Ô "Lý do hoàn / đổi" là BẮT BUỘC — validate trước khi gọi API.
//  B. Bỏ màn hình trung gian "Đã ghi nhận hoàn tiền / Đã tạo đơn đổi SP":
//     sau khi gọi API thành công → chuyển thẳng sang Bước 3 (Xử lý hàng nhận về).
//  C. Ở Bước 3, nút "Bỏ qua" đổi thành "Quay lại" → quay về Bước 2 (Chọn hình thức xử lý).

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  X, RotateCcw, RefreshCw, Trash2, Package, ChevronRight,
  ArrowLeft, CheckCircle2, Plus, Minus, Search, Loader2,
} from 'lucide-react';
import { productApi } from '../../api/services';
import api from '../../api/axios';
import { useToast } from '../common/Toast';

const fmtVnd = v => {
  const n = Math.round(Number(v) || 0);
  return n.toLocaleString('vi-VN') + ' đ';
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Đơn vị cơ bản của sản phẩm là số thực (kg, g, lít...) hay nguyên (hộp, cái...)? */
function isWeightUnit(unit) {
  if (!unit) return false;
  const u = unit.toLowerCase();
  return ['kg', 'g', 'gram', 'lít', 'lit', 'l', 'ml'].includes(u);
}

/**
 * Với một order item, trả về:
 *  - baseUnit : đơn vị cơ bản (hộp, cái, kg...)
 *  - displayUnit : chuỗi hiển thị (vd "Thùng (12 hộp/thùng)" hoặc "hộp")
 *  - isBox : bán theo thùng
 *  - isWeight : đơn vị tính theo khối lượng (cho phép số lẻ)
 *  - unitsPerBox : số hộp / thùng (null nếu không phải thùng)
 *  - totalBaseUnits : tổng số đơn vị cơ bản trong đơn (dùng làm max cho input hoàn)
 */
function itemMeta(it) {
  const saleType = it.saleType || 'RETAIL';
  const isBox = saleType === 'BOX';
  const unitsPerBox = isBox ? (it.unitsPerBox || 1) : null;
  const baseUnit = it.unit || 'SP';
  const weight = isWeightUnit(baseUnit);

  const totalBaseUnits = isBox
    ? Number(it.quantity) * unitsPerBox
    : Number(it.quantity);

  const displayUnit = isBox
    ? `Thùng (${unitsPerBox} ${baseUnit}/thùng)`
    : baseUnit;

  return { baseUnit, displayUnit, isBox, isWeight: weight, unitsPerBox, totalBaseUnits };
}

/**
 * Hiển thị số lượng hoàn dạng "N thùng + M hộp" cho sản phẩm thùng,
 * hoặc đơn giản "N hộp" / "N.xxx kg".
 */
function formatReturnQty(qty, meta) {
  if (!qty || Number(qty) <= 0) return '—';
  const n = Number(qty);
  if (meta.isBox) {
    const boxes = Math.floor(n / meta.unitsPerBox);
    const rem = n % meta.unitsPerBox;
    const parts = [];
    if (boxes > 0) parts.push(`${boxes} thùng`);
    if (rem > 0) parts.push(`${rem} ${meta.baseUnit}`);
    return parts.join(' + ') || '0';
  }
  return `${n} ${meta.baseUnit}`;
}

// ── Step 1: Chọn sản phẩm và số lượng ────────────────────────────────────────
function Step1SelectItems({ order, onNext, onClose }) {
  const [rows, setRows] = useState(() => {
    // Tính bill-discount ratio của đơn gốc để phân bổ vào từng item (giống BE)
    const orderSubtotal = (order.items || []).reduce((s, it) => s + Number(it.subtotal || 0), 0);
    const billDiscount  = Number(order.discountAmount || 0);
    const discountRatio = orderSubtotal > 0 ? billDiscount / orderSubtotal : 0;

    return (order.items || []).map(it => {
      const meta = itemMeta(it);
      const itemSub = Number(it.subtotal || 0);
      // creditSubtotal = giá trị thực tế của item sau khi trừ phần bill-discount phân bổ
      const creditSubtotal = Math.round(itemSub * (1 - discountRatio));
      return {
        orderItemId: it.id,
        productName: it.productName,
        meta,
        fullSubtotal: itemSub,
        creditSubtotal,     // ← dùng cho totalCredit gửi lên BE và hiển thị
        inputBoxes: '',
        inputLoose: '',
        checked: false,
      };
    });
  });

  const calcTotalBaseUnits = (r) => {
    const { meta } = r;
    if (!meta.isBox) return parseFloat(r.inputBoxes) || 0;
    const boxes = parseInt(r.inputBoxes, 10) || 0;
    const loose = parseInt(r.inputLoose, 10) || 0;
    return boxes * meta.unitsPerBox + loose;
  };

  const toggle = idx =>
    setRows(p => p.map((r, i) => i !== idx ? r : (() => {
      if (r.checked) return { ...r, checked: false, inputBoxes: '', inputLoose: '' };
      const meta = r.meta;
      if (meta.isBox) {
        const totalBoxes = Math.floor(meta.totalBaseUnits / meta.unitsPerBox);
        return { ...r, checked: true, inputBoxes: String(totalBoxes), inputLoose: '0' };
      }
      return { ...r, checked: true, inputBoxes: String(meta.totalBaseUnits) };
    })()));

  const setMax = idx =>
    setRows(p => p.map((r, i) => i !== idx ? r : (() => {
      const meta = r.meta;
      if (meta.isBox) {
        const totalBoxes = Math.floor(meta.totalBaseUnits / meta.unitsPerBox);
        const looseRem   = meta.totalBaseUnits % meta.unitsPerBox;
        return { ...r, checked: true, inputBoxes: String(totalBoxes), inputLoose: String(looseRem) };
      }
      return { ...r, checked: true, inputBoxes: String(meta.totalBaseUnits) };
    })()));

  const setBoxes = (idx, raw) => {
    setRows(p => p.map((r, i) => {
      if (i !== idx) return r;
      const { meta } = r;
      const maxBoxes = Math.floor(meta.totalBaseUnits / meta.unitsPerBox);
      const v = Math.min(Math.max(parseInt(raw, 10) || 0, 0), maxBoxes);
      const currentLoose = parseInt(r.inputLoose, 10) || 0;
      const remainHộp = meta.totalBaseUnits - v * meta.unitsPerBox;
      const newLoose = Math.min(currentLoose, remainHộp);
      const total = v * meta.unitsPerBox + newLoose;
      return { ...r, inputBoxes: raw === '' ? '' : String(v), inputLoose: String(newLoose), checked: total > 0 };
    }));
  };

  const setLoose = (idx, raw) => {
    setRows(p => p.map((r, i) => {
      if (i !== idx) return r;
      const { meta } = r;
      const currentBoxes = parseInt(r.inputBoxes, 10) || 0;
      const maxLoose = meta.totalBaseUnits - currentBoxes * meta.unitsPerBox;
      const v = Math.min(Math.max(parseInt(raw, 10) || 0, 0), maxLoose);
      const total = currentBoxes * meta.unitsPerBox + v;
      return { ...r, inputLoose: raw === '' ? '' : String(v), checked: total > 0 };
    }));
  };

  const setQty = (idx, raw) => {
    setRows(p => p.map((r, i) => {
      if (i !== idx) return r;
      const { meta } = r;
      if (meta.isWeight) {
        const v = parseFloat(raw) || 0;
        return { ...r, inputBoxes: raw, checked: v > 0 };
      }
      const v = Math.min(Math.max(parseInt(raw, 10) || 0, 0), meta.totalBaseUnits);
      return { ...r, inputBoxes: raw === '' ? '' : String(v), checked: v > 0 };
    }));
  };

  const blurQty = idx => {
    setRows(p => p.map((r, i) => {
      if (i !== idx) return r;
      const { meta } = r;
      if (meta.isBox) {
        const boxes = Math.min(Math.max(parseInt(r.inputBoxes, 10) || 0, 0), Math.floor(meta.totalBaseUnits / meta.unitsPerBox));
        const maxLoose = meta.totalBaseUnits - boxes * meta.unitsPerBox;
        const loose = Math.min(Math.max(parseInt(r.inputLoose, 10) || 0, 0), maxLoose);
        const total = boxes * meta.unitsPerBox + loose;
        return { ...r, inputBoxes: String(boxes), inputLoose: String(loose), checked: total > 0 };
      }
      const v = meta.isWeight
        ? Math.min(parseFloat(r.inputBoxes) || 0, meta.totalBaseUnits)
        : Math.min(Math.max(parseInt(r.inputBoxes, 10) || 0, 0), meta.totalBaseUnits);
      return { ...r, inputBoxes: v > 0 ? String(v) : '', checked: v > 0 };
    }));
  };

  const checkedRows = rows.filter(r => r.checked && calcTotalBaseUnits(r) > 0);
  const totalCredit = checkedRows.reduce((s, r) => s + r.creditSubtotal, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-hairline flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Hoàn / Đổi sản phẩm</h2>
          <p className="text-xs text-muted mt-0.5">Đơn {order.orderCode}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-canvas text-muted">
          <X size={18} />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 divide-y divide-hairline">
        {rows.map((r, idx) => {
          const { meta } = r;
          const totalHop = calcTotalBaseUnits(r);
          const qty = totalHop;
          const unitSubtotal = meta.totalBaseUnits > 0
            ? r.creditSubtotal / meta.totalBaseUnits
            : 0;
          return (
            <div key={r.orderItemId} className="px-5 py-3.5 flex items-start gap-3">
              <input
                type="checkbox"
                checked={r.checked}
                onChange={() => toggle(idx)}
                className="w-4 h-4 rounded accent-gold mt-1 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{r.productName}</p>
                <p className="text-xs text-muted mt-0.5">
                  {fmtVnd(unitSubtotal)}/{meta.baseUnit}
                  {meta.isBox && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10
                      text-amber-700 dark:text-amber-300 text-[10px] font-semibold border
                      border-amber-200 dark:border-amber-500/28">
                      {meta.displayUnit}
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-faint mt-0.5">
                  SL đơn: {Number(order.items?.find(it => it.id === r.orderItemId)?.quantity)} {meta.isBox ? 'thùng' : meta.baseUnit}
                  {meta.isBox && ` = ${meta.totalBaseUnits} ${meta.baseUnit}`}
                </p>
                {qty > 0 && meta.isBox && (
                  <p className="text-[10px] text-gold font-semibold mt-0.5">
                    → Trả: {formatReturnQty(qty, meta)}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {meta.isBox ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setBoxes(idx, String(Math.max(0, (parseInt(r.inputBoxes,10)||0) - 1)))}
                        className="w-6 h-6 rounded-lg border border-hairline-2 flex items-center justify-center text-muted hover:bg-canvas disabled:opacity-30"
                        disabled={(parseInt(r.inputBoxes,10)||0) <= 0}
                      ><Minus size={10} /></button>
                      <input
                        type="number" min="0"
                        max={Math.floor(meta.totalBaseUnits / meta.unitsPerBox)}
                        value={r.inputBoxes}
                        onChange={e => setBoxes(idx, e.target.value)}
                        onBlur={() => blurQty(idx)}
                        placeholder="0"
                        className="w-12 text-right px-1.5 py-1 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:border-gold"
                      />
                      <button
                        onClick={() => setBoxes(idx, String(Math.min(Math.floor(meta.totalBaseUnits/meta.unitsPerBox), (parseInt(r.inputBoxes,10)||0)+1)))}
                        className="w-6 h-6 rounded-lg border border-hairline-2 flex items-center justify-center text-muted hover:bg-canvas disabled:opacity-30"
                        disabled={(parseInt(r.inputBoxes,10)||0) >= Math.floor(meta.totalBaseUnits/meta.unitsPerBox)}
                      ><Plus size={10} /></button>
                      <span className="text-xs text-muted">thùng</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setLoose(idx, String(Math.max(0, (parseInt(r.inputLoose,10)||0) - 1)))}
                        className="w-6 h-6 rounded-lg border border-hairline-2 flex items-center justify-center text-muted hover:bg-canvas disabled:opacity-30"
                        disabled={(parseInt(r.inputLoose,10)||0) <= 0}
                      ><Minus size={10} /></button>
                      <input
                        type="number" min="0"
                        max={meta.totalBaseUnits - (parseInt(r.inputBoxes,10)||0)*meta.unitsPerBox}
                        value={r.inputLoose}
                        onChange={e => setLoose(idx, e.target.value)}
                        onBlur={() => blurQty(idx)}
                        placeholder="0"
                        className="w-12 text-right px-1.5 py-1 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:border-gold"
                      />
                      <button
                        onClick={() => { const maxL = meta.totalBaseUnits-(parseInt(r.inputBoxes,10)||0)*meta.unitsPerBox; setLoose(idx, String(Math.min(maxL,(parseInt(r.inputLoose,10)||0)+1))); }}
                        className="w-6 h-6 rounded-lg border border-hairline-2 flex items-center justify-center text-muted hover:bg-canvas disabled:opacity-30"
                        disabled={(parseInt(r.inputLoose,10)||0) >= meta.totalBaseUnits-(parseInt(r.inputBoxes,10)||0)*meta.unitsPerBox}
                      ><Plus size={10} /></button>
                      <span className="text-xs text-muted">{meta.baseUnit}</span>
                    </div>
                    <button onClick={() => setMax(idx)}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-canvas hover:bg-hairline text-muted font-semibold self-end">
                      Max
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    {!meta.isWeight && (
                      <button
                        onClick={() => setQty(idx, String(Math.max(0, (parseFloat(r.inputBoxes)||0) - 1)))}
                        className="w-7 h-7 rounded-lg border border-hairline-2 flex items-center justify-center text-muted hover:bg-canvas disabled:opacity-30"
                        disabled={(parseFloat(r.inputBoxes)||0) <= 0}
                      ><Minus size={12} /></button>
                    )}
                    <input
                      type="number" min="0" max={meta.totalBaseUnits}
                      step={meta.isWeight ? '0.001' : 1}
                      value={r.inputBoxes}
                      onChange={e => setQty(idx, e.target.value)}
                      onBlur={() => blurQty(idx)}
                      placeholder="0"
                      className="w-16 text-right px-2 py-1.5 rounded-lg border border-hairline-2 text-sm focus:outline-none focus:border-gold"
                    />
                    {!meta.isWeight && (
                      <button
                        onClick={() => setQty(idx, String(Math.min(meta.totalBaseUnits, (parseFloat(r.inputBoxes)||0)+1)))}
                        className="w-7 h-7 rounded-lg border border-hairline-2 flex items-center justify-center text-muted hover:bg-canvas disabled:opacity-30"
                        disabled={(parseFloat(r.inputBoxes)||0) >= meta.totalBaseUnits}
                      ><Plus size={12} /></button>
                    )}
                    <span className="text-xs text-muted w-8 text-left">{meta.baseUnit}</span>
                  </div>
                )}
                {!meta.isBox && (
                  <button onClick={() => setMax(idx)}
                    className="text-[10px] px-2 py-1 rounded-lg bg-canvas hover:bg-hairline text-muted font-semibold">
                    Max
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {checkedRows.length > 0 && (
        <div className="px-5 py-3 border-t border-hairline bg-canvas">
          <div className="flex justify-between text-sm">
            <span className="text-muted">{checkedRows.length} sản phẩm đã chọn</span>
            <span className="font-bold text-ink">Giá trị khấu trừ: {fmtVnd(totalCredit)}</span>
          </div>
          <p className="text-[10px] text-faint mt-0.5">
            * Khấu trừ theo giá trị toàn bộ sản phẩm đó trong đơn, không phụ thuộc vào số lượng trả thực tế.
          </p>
        </div>
      )}

      <div className="p-5 border-t border-hairline flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-hairline-2 text-sm font-semibold
            text-muted hover:bg-canvas"
        >
          Huỷ
        </button>
        <button
          disabled={checkedRows.length === 0}
          onClick={() => onNext({
            items: checkedRows.map(r => {
              const { meta } = r;
              if (meta.isBox) {
                const boxes = parseInt(r.inputBoxes, 10) || 0;
                const loose = parseInt(r.inputLoose, 10) || 0;
                const totalHop = boxes * meta.unitsPerBox + loose;
                const qtyForBE = String(totalHop / meta.unitsPerBox);
                const qtyDisplayBoxes = boxes;
                const qtyDisplayLoose = loose;
                // Số đơn vị gốc (để tính khách đã dùng bao nhiêu)
                const originalBaseUnits = meta.totalBaseUnits;
                const usedBaseUnits = originalBaseUnits - totalHop;
                return {
                  orderItemId: r.orderItemId,
                  productName: r.productName,
                  qty:          qtyForBE,
                  qtyBoxes:     qtyDisplayBoxes,
                  qtyLoose:     qtyDisplayLoose,
                  qtyDisplay:   String(totalHop),
                  unit:         meta.baseUnit,
                  fullSubtotal:  r.fullSubtotal,
                  creditSubtotal: r.creditSubtotal,
                  meta,
                  originalBaseUnits,
                  usedBaseUnits: usedBaseUnits > 0 ? usedBaseUnits : 0,
                };
              } else {
                const qtyVal = r.inputBoxes;
                const returnedQty = parseFloat(qtyVal) || 0;
                const originalQty = meta.totalBaseUnits;
                const usedQty = originalQty - returnedQty;
                return {
                  orderItemId:  r.orderItemId,
                  productName:  r.productName,
                  qty:          qtyVal,
                  qtyDisplay:   qtyVal,
                  originalBaseUnits: originalQty,
                  usedBaseUnits: usedQty > 0 ? usedQty : 0,
                  unit:         meta.baseUnit,
                  fullSubtotal:  r.fullSubtotal,
                  creditSubtotal: r.creditSubtotal,
                  meta,
                };
              }
            }),
            totalCredit,
          })}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gold
            text-white font-bold disabled:opacity-40 hover:bg-gold-strong"
        >
          Tiếp theo <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Product Search Dropdown ───────────────────────────────────────────────────
const _productCache = {};

function ProductSearchDropdown({ warehouseId, value, onSelect, placeholder = 'Tìm sản phẩm...' }) {
  const [query, setQuery]   = useState(value?.name || '');
  const [allProducts, setAllProducts] = useState([]);
  const [results, setResults]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!warehouseId) return;
    if (_productCache[warehouseId]) {
      setAllProducts(_productCache[warehouseId]);
      return;
    }
    setLoading(true);
    productApi.getAll({ page: 0, size: 1000, warehouseId, sortBy: 'name', sortDir: 'asc' })
      .then(res => {
        const list = (res.data?.data?.content || []).filter(p => p.isActive !== false);
        _productCache[warehouseId] = list;
        setAllProducts(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [warehouseId]);

  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = e => {
    const v = e.target.value;
    setQuery(v);
    if (!v) { onSelect(null); setResults([]); setOpen(false); return; }
    const lower = v.toLowerCase();
    const filtered = allProducts.filter(p => p.name?.toLowerCase().includes(lower));
    setResults(filtered);
    setOpen(filtered.length > 0);
  };

  const handleSelect = p => {
    setQuery(p.name);
    setOpen(false);
    onSelect(p);
  };

  useEffect(() => {
    if (!value) setQuery('');
  }, [value]);

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => {
            if (query && allProducts.length > 0) {
              const lower = query.toLowerCase();
              const filtered = allProducts.filter(p => p.name?.toLowerCase().includes(lower));
              setResults(filtered);
              if (filtered.length > 0) setOpen(true);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-8 pr-8 py-2 rounded-lg border border-hairline-2 text-sm
            focus:outline-none focus:border-gold bg-surface text-ink placeholder:text-faint"
        />
        {loading && (
          <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin" />
        )}
        {!loading && query && (
          <button
            onClick={() => { setQuery(''); onSelect(null); setResults([]); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-xl border border-hairline-2 bg-surface
          shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              className="w-full text-left px-3.5 py-2.5 hover:bg-canvas transition-colors
                border-b border-hairline last:border-0"
            >
              <p className="text-sm font-medium text-ink">{p.name}</p>
              <p className="text-[10px] text-muted mt-0.5">
                {fmtVnd(p.basePrice)} / {p.unit}
                {p.unitsPerBox ? ` · ${p.unitsPerBox} ${p.unit}/thùng` : ''}
                {p.vatRate ? ` · VAT ${p.vatRate}%` : ''}
              </p>
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && query.length >= 1 && (
        <div className="absolute z-50 w-full mt-1 rounded-xl border border-hairline-2 bg-surface
          shadow-lg px-4 py-3 text-sm text-muted">
          Không tìm thấy sản phẩm
        </div>
      )}
    </div>
  );
}

// ── Step 2: Chọn Hoàn tiền / Đổi SP ──────────────────────────────────────────
function Step2ChooseAction({ order, selectedData, onBack, onDone, onClose }) {
  const toast = useToast();
  const [action, setAction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');

  const emptyDraft = () => ({
    productId: null, product: null, productName: '',
    unit: '', quantity: '', unitPrice: '', vatRate: '0', discountPct: '0',
    saleType: 'RETAIL', unitsPerBox: null, selectedTierId: '', tiers: [],
  });

  const [draft, setDraft]         = useState(emptyDraft());
  const [confirmedItems, setConfirmedItems] = useState([]);
  const [extraDiscount, setExtraDiscount]   = useState('');

  const patchDraft = patch => setDraft(prev => ({ ...prev, ...patch }));

  const calcItemTotals = it => {
    const qty       = Number(it.quantity) || 0;
    const price     = Number(it.unitPrice) || 0;
    const rate      = Number(it.vatRate) || 0;
    const mode      = it.product?.vatMode ?? 'INCLUSIVE';
    const discPct   = Number(it.discountPct) || 0;
    const gross     = price * qty;
    const disc      = gross * discPct / 100;
    const afterDisc = gross - disc;
    const vatAmt    = rate === 0 ? 0
      : mode === 'INCLUSIVE'
        ? afterDisc * rate / (100 + rate)
        : afterDisc * rate / 100;
    const lineTotal = mode === 'EXCLUSIVE' ? afterDisc + vatAmt : afterDisc;
    return { gross, disc, afterDisc, vatAmt, lineTotal, mode, rate };
  };

  const newTotal = useMemo(() => {
    const sum = confirmedItems.reduce((s, it) => s + calcItemTotals(it).lineTotal, 0);
    return Math.round(sum - (Number(extraDiscount) || 0));
  }, [confirmedItems, extraDiscount]);

  const balance = selectedData.totalCredit - newTotal;

  const removeConfirmed = idx => setConfirmedItems(p => p.filter((_, i) => i !== idx));

  const handleAddDraft = () => {
    if (!draft.product) { toast('Vui lòng chọn sản phẩm', 'error'); return; }
    if (!(Number(draft.quantity) > 0)) { toast('Vui lòng nhập số lượng', 'error'); return; }
    if (!(Number(draft.unitPrice) >= 0)) { toast('Vui lòng nhập đơn giá', 'error'); return; }
    setConfirmedItems(prev => [...prev, { ...draft }]);
    setDraft(emptyDraft());
  };

  const handleSelectProduct = product => {
    if (!product) { setDraft(emptyDraft()); return; }
    const tiers = (product.priceTiers || []).filter(t => t.isActive !== false);
    setDraft(prev => ({
      ...prev,
      productId: product.id, product, productName: product.name,
      unit: product.unit || '',
      unitPrice: product.basePrice != null ? String(product.basePrice) : '',
      vatRate: product.vatRate != null ? String(product.vatRate) : '0',
      discountPct: '0', saleType: 'RETAIL',
      unitsPerBox: product.unitsPerBox || null,
      selectedTierId: '', tiers,
    }));
  };

  const handleChangeSaleType = saleType => {
    const p = draft.product; if (!p) return;
    const isBox     = saleType === 'BOX';
    const upb       = p.unitsPerBox || 1;
    const boxTier   = draft.tiers.find(t => t.tierName?.toLowerCase().includes('thùng'));
    const boxPrice  = isBox
      ? (boxTier ? String(boxTier.price) : String((Number(p.basePrice) || 0) * upb))
      : String(p.basePrice || '');
    patchDraft({ saleType, unit: isBox ? 'thùng' : (p.unit || ''), unitPrice: boxPrice,
      selectedTierId: '', unitsPerBox: isBox ? upb : null });
  };

  const handleChangeTier = tierId => {
    if (tierId === '') {
      patchDraft({ selectedTierId: '',
        unitPrice: draft.product?.basePrice != null ? String(draft.product.basePrice) : '' });
    } else {
      const tier = draft.tiers.find(t => String(t.id) === String(tierId));
      if (tier) patchDraft({ selectedTierId: tierId, unitPrice: String(tier.price) });
    }
  };

  // ── REFUND: validate note bắt buộc, gọi API, chuyển thẳng Step 3 ────────────
  const handleRefund = async () => {
    if (!note.trim()) {
      toast('Vui lòng nhập lý do hoàn / đổi', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/api/orders/${order.id}/refund`, {
        items: selectedData.items.map(it => ({
          orderItemId: it.orderItemId,
          quantity: Number(it.qty),
        })),
        note: note.trim(),
      });
      // FIX: bỏ màn hình kết quả trung gian — chuyển thẳng Step 3
      onDone(selectedData.items, 'REFUND');
    } catch (e) {
      toast(e?.response?.data?.message || e?.message || 'Lỗi hoàn tiền', 'error');
    } finally { setLoading(false); }
  };

  // ── EXCHANGE: validate note bắt buộc, gọi API, chuyển thẳng Step 3 ──────────
  const handleExchange = async () => {
    if (confirmedItems.length === 0) {
      toast('Vui lòng thêm ít nhất 1 sản phẩm đổi', 'error');
      return;
    }
    if (!note.trim()) {
      toast('Vui lòng nhập lý do hoàn / đổi', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/api/orders/${order.id}/exchange`, {
        sourceItems: selectedData.items.map(it => ({
          orderItemId: it.orderItemId,
          quantity: Number(it.qty),
        })),
        newItems: confirmedItems.map(it => ({
          productId: it.productId || null,
          productName: it.productName,
          unit: it.unit || 'SP',
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          vatRate: Number(it.vatRate) / 100,
          vatMode: it.product?.vatMode ?? 'INCLUSIVE',  // ← FIX: gửi vatMode để BE tính đúng INCLUSIVE/EXCLUSIVE
          discountPct: Number(it.discountPct),
          saleType: it.saleType || 'RETAIL',
          unitsPerBox: it.unitsPerBox || null,
          tierId: it.selectedTierId ? Number(it.selectedTierId) : null,
          tierName: it.selectedTierId
            ? (it.tiers.find(t => String(t.id) === String(it.selectedTierId))?.tierName || null)
            : null,
        })),
        discount: Number(extraDiscount) || 0,
        note: note.trim(),
      });
      // FIX: bỏ màn hình kết quả trung gian — chuyển thẳng Step 3
      onDone(selectedData.items, 'EXCHANGE');
    } catch (e) {
      toast(e?.response?.data?.message || e?.message || 'Lỗi đổi sản phẩm', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-hairline flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-canvas text-muted">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-base font-bold text-ink">Chọn hình thức xử lý</h2>
          <p className="text-xs text-muted">Giá trị SP hoàn: {fmtVnd(selectedData.totalCredit)}</p>
        </div>
        <button onClick={onClose} className="ml-auto p-2 rounded-xl hover:bg-canvas text-muted">
          <X size={18} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex">
        {/* Cột trái */}
        <div className={`flex flex-col overflow-y-auto
          ${action === 'EXCHANGE' ? 'w-1/2 border-r border-hairline' : 'w-full'}`}>
          <div className="p-5 space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAction('REFUND')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all
                  ${action === 'REFUND' ? 'border-gold bg-gold/5' : 'border-hairline-2 hover:border-gold/40'}`}
              >
                <RotateCcw size={16} className={action === 'REFUND' ? 'text-gold' : 'text-muted'} />
                <p className="text-sm font-bold text-ink mt-1.5">Hoàn tiền</p>
                <p className="text-xs text-muted mt-0.5">Hoàn {fmtVnd(selectedData.totalCredit)}</p>
              </button>
              <button
                onClick={() => setAction('EXCHANGE')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all
                  ${action === 'EXCHANGE' ? 'border-gold bg-gold/5' : 'border-hairline-2 hover:border-gold/40'}`}
              >
                <RefreshCw size={16} className={action === 'EXCHANGE' ? 'text-gold' : 'text-muted'} />
                <p className="text-sm font-bold text-ink mt-1.5">Đổi sản phẩm</p>
                <p className="text-xs text-muted mt-0.5">Tạo đơn mới thay thế</p>
              </button>
            </div>

            {action === 'REFUND' && (
              <div className="rounded-xl bg-canvas px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Số tiền hoàn khách</span>
                  <span className="font-bold text-emerald-600">{fmtVnd(selectedData.totalCredit)}</span>
                </div>
              </div>
            )}

            {action === 'EXCHANGE' && (
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Thêm sản phẩm đổi</p>

                <div className="rounded-xl border border-hairline-2 p-3 space-y-2.5 bg-canvas/40">
                  <ProductSearchDropdown
                    warehouseId={order.warehouseId}
                    value={draft.product}
                    onSelect={handleSelectProduct}
                    placeholder="Tìm sản phẩm trong kho đơn..."
                  />

                  {draft.product && (
                    <div className="space-y-2">
                      {draft.product.unitsPerBox > 0 && (
                        <div>
                          <label className="text-[10px] text-muted mb-1 block">Quy cách</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { key: 'RETAIL', label: `Lẻ (${draft.product.unit})` },
                              { key: 'BOX',    label: `Thùng (${draft.product.unitsPerBox} ${draft.product.unit})` },
                            ].map(opt => (
                              <button key={opt.key}
                                onClick={() => handleChangeSaleType(opt.key)}
                                className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all
                                  ${draft.saleType === opt.key
                                    ? 'border-gold bg-gold/5 text-gold'
                                    : 'border-hairline-2 text-muted hover:border-gold/40'}`}
                              >{opt.label}</button>
                            ))}
                          </div>
                        </div>
                      )}

                      {draft.tiers.length > 0 && (
                        <div>
                          <label className="text-[10px] text-muted mb-1 block">Khung giá</label>
                          <select value={draft.selectedTierId}
                            onChange={e => handleChangeTier(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-hairline-2 text-sm
                              focus:outline-none focus:border-gold bg-surface">
                            <option value="">Giá lẻ — {fmtVnd(draft.product.basePrice)}/{draft.product.unit}</option>
                            {draft.tiers.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.tierName}{t.minQuantity != null ? ` (≥${t.minQuantity})` : ''} — {fmtVnd(t.price)}/{draft.product.unit}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted mb-0.5 block">ĐVT</label>
                          <input value={draft.unit} readOnly
                            className="w-full px-2.5 py-1.5 rounded-lg border border-hairline-2 text-sm
                              bg-canvas text-muted cursor-default" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted mb-0.5 block">Số lượng *</label>
                          <input type="number" min="0"
                            step={isWeightUnit(draft.product.unit) ? '0.001' : '1'}
                            value={draft.quantity}
                            onChange={e => patchDraft({ quantity: e.target.value })}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-hairline-2 text-sm
                              focus:outline-none focus:border-gold bg-surface" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted mb-0.5 block">Đơn giá *</label>
                          <input type="number" value={draft.unitPrice}
                            onChange={e => patchDraft({ unitPrice: e.target.value })}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-hairline-2 text-sm
                              focus:outline-none focus:border-gold bg-surface" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted mb-0.5 block">Chiết khấu %</label>
                          <input type="number" min="0"
                            max={draft.product.maxDiscountRate ?? 100}
                            value={draft.discountPct}
                            onChange={e => patchDraft({ discountPct: e.target.value })}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-hairline-2 text-sm
                              focus:outline-none focus:border-gold bg-surface" />
                          {draft.product.maxDiscountRate != null && (
                            <p className="text-[9px] text-faint mt-0.5">Tối đa: {draft.product.maxDiscountRate}%</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-muted mb-0.5 block">VAT</label>
                        {draft.product.vatMode === 'INCLUSIVE' ? (
                          <div className="px-2.5 py-1.5 rounded-lg border border-hairline-2 bg-canvas text-sm text-muted">
                            VAT {draft.product.vatRate}% (đã tính trong giá)
                          </div>
                        ) : (
                          <select value={draft.vatRate}
                            onChange={e => patchDraft({ vatRate: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-hairline-2 text-sm
                              focus:outline-none focus:border-gold bg-surface">
                            <option value="0">Không VAT</option>
                            <option value="5">VAT 5%</option>
                            <option value="8">VAT 8%</option>
                            <option value="10">VAT 10%</option>
                            <option value="12">VAT 12%</option>
                          </select>
                        )}
                      </div>
                    </div>
                  )}

                  <button onClick={handleAddDraft}
                    disabled={!draft.product || !(Number(draft.quantity) > 0)}
                    className="w-full py-2 rounded-xl border border-gold/50 text-sm font-semibold
                      text-gold hover:bg-gold/5 disabled:opacity-40 disabled:cursor-not-allowed
                      flex items-center justify-center gap-1.5 transition-colors">
                    <Plus size={14} /> Thêm vào danh sách
                  </button>
                </div>

                <div>
                  <label className="text-xs text-muted mb-1 block">Giảm giá thêm (đơn mới)</label>
                  <input type="number" value={extraDiscount}
                    onChange={e => setExtraDiscount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-hairline-2 text-sm
                      focus:outline-none focus:border-gold bg-surface" />
                </div>
              </div>
            )}

            {/* ── Ghi chú — BẮT BUỘC khi đã chọn action ── */}
            {action && (
              <div>
                <label className="text-xs text-muted mb-1 block">
                  Lý do hoàn / đổi <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder="Nhập lý do hoàn / đổi..."
                  className={`w-full px-3 py-2 rounded-xl border text-sm
                    focus:outline-none focus:border-gold resize-none bg-surface
                    ${!note.trim() ? 'border-hairline-2' : 'border-hairline-2'}`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Cột phải — chỉ khi EXCHANGE */}
        {action === 'EXCHANGE' && (
          <div className="w-1/2 flex flex-col border-l border-hairline">
            <div className="px-4 py-3 border-b border-hairline shrink-0">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                Danh sách sản phẩm đổi
              </p>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {confirmedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-10 text-center px-6">
                  <Package size={26} strokeWidth={1} className="text-faint mb-2" />
                  <p className="text-xs text-faint">Chưa có sản phẩm nào</p>
                  <p className="text-[10px] text-faint mt-0.5">Điền form bên trái rồi bấm "Thêm vào danh sách"</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-canvas border-b border-hairline sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-4 py-2 text-[10px] font-bold text-muted">Sản phẩm</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-muted whitespace-nowrap">SL</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-muted whitespace-nowrap">Đơn giá</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold text-muted whitespace-nowrap">CK / VAT</th>
                      <th className="text-right px-4 py-2 text-[10px] font-bold text-muted whitespace-nowrap">Thành tiền</th>
                      <th className="px-2 py-2 w-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {confirmedItems.map((it, idx) => {
                      const { disc, vatAmt, lineTotal: lineTotalRaw, mode, rate } = calcItemTotals(it);
                      const qty      = Number(it.quantity);
                      const price    = Number(it.unitPrice) || 0;
                      const lineTotal = Math.round(lineTotalRaw);
                      const hasDisc  = disc > 0.005;
                      const hasVat   = vatAmt > 0.005 && rate > 0;
                      return (
                        <tr key={idx} className="hover:bg-canvas/50 group align-top">
                          <td className="px-4 py-2.5">
                            <p className="text-xs font-medium text-ink leading-snug">{it.productName}</p>
                            <p className="text-[10px] text-muted mt-0.5">{it.unit}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs font-medium text-ink whitespace-nowrap">{qty}</td>
                          <td className="px-3 py-2.5 text-right text-xs text-muted whitespace-nowrap">{fmtVnd(price)}</td>
                          <td className="px-3 py-2.5 text-right text-[10px] whitespace-nowrap">
                            {hasDisc && (
                              <p className="text-red-500 font-medium">giảm {fmtVnd(disc)}</p>
                            )}
                            {hasVat && (
                              <p className="text-muted">
                                VAT {rate}% {mode === 'EXCLUSIVE' ? '+' : ''}{fmtVnd(vatAmt)}
                              </p>
                            )}
                            {!hasDisc && !hasVat && <span className="text-faint">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-bold text-ink whitespace-nowrap">{fmtVnd(lineTotal)}</td>
                          <td className="px-2 py-2.5 text-center">
                            <button onClick={() => removeConfirmed(idx)}
                              className="p-1 rounded-md text-faint hover:text-red-400 hover:bg-red-50
                                dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="shrink-0 border-t border-hairline">
              <div className="bg-canvas px-4 py-3 space-y-1.5">
                {(() => {
                  let subtotal = 0, totalDisc = 0;
                  const vatMap = {};
                  confirmedItems.forEach(it => {
                    const { gross, disc, vatAmt, mode, rate } = calcItemTotals(it);
                    subtotal  += gross;
                    totalDisc += disc;
                    if (rate === 0) return;
                    const key = `${rate}|${mode}`;
                    if (!vatMap[key]) vatMap[key] = { rate, mode, amt: 0 };
                    vatMap[key].amt += vatAmt;
                  });
                  const vatEntries = Object.entries(vatMap).sort(([a],[b]) => a.localeCompare(b));
                  const finalBeforeCredit = Math.round(subtotal - totalDisc + 
                    vatEntries.filter(([k]) => k.includes('EXCLUSIVE')).reduce((s,[,v]) => s + v.amt, 0)
                    - (Number(extraDiscount) || 0));
                  const totalVatExOnly = vatEntries
                    .filter(([, v]) => v.mode === 'EXCLUSIVE')
                    .reduce((s, [, v]) => s + v.amt, 0);
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Tạm tính</span>
                        <span className="font-semibold text-ink">{fmtVnd(subtotal)}</span>
                      </div>
                      {(totalDisc > 0 || Number(extraDiscount) > 0) && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted">Tổng chiết khấu</span>
                          <span className="font-semibold text-red-500">
                            −{fmtVnd(totalDisc + (Number(extraDiscount) || 0))}
                          </span>
                        </div>
                      )}
                      {totalVatExOnly > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted">Tổng VAT (tính thêm)</span>
                          <span className="font-semibold text-muted">+{fmtVnd(totalVatExOnly)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold border-t border-hairline pt-1.5 mt-0.5">
                        <span className="text-ink">Tổng đơn mới</span>
                        <span className="text-ink">{fmtVnd(finalBeforeCredit)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-hairline/60 pt-1.5">
                        <span className="text-muted">Giá trị SP hoàn từ đơn cũ</span>
                        <span className="font-semibold text-gold">{fmtVnd(selectedData.totalCredit)}</span>
                      </div>
                      <div className={`flex justify-between text-sm font-bold pt-0.5
                        ${balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        <span>{balance >= 0 ? 'Cần hoàn lại cho khách:' : 'Khách cần thanh toán thêm:'}</span>
                        <span>{fmtVnd(Math.abs(balance))}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="px-4 py-3 flex gap-2.5 border-t border-hairline">
                <button onClick={onBack}
                  className="flex-1 py-2.5 rounded-xl border border-hairline-2 text-sm font-semibold
                    text-muted hover:bg-canvas">
                  Quay lại
                </button>
                <button
                  disabled={loading}
                  onClick={handleExchange}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold
                    text-white font-bold disabled:opacity-40">
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <ChevronRight size={16} />}
                  {loading ? 'Đang xử lý...' : 'Tạo đơn đổi SP'}
                </button>
              </div>
            </div>
          </div>
        )}

        {action === 'REFUND' && <div className="hidden" />}
      </div>

      {/* ── Footer cho REFUND (và khi chưa chọn action) ── */}
      {action !== 'EXCHANGE' && (
        <div className="px-5 py-4 border-t border-hairline flex gap-3 shrink-0">
          <button onClick={onBack}
            className="flex-1 py-2.5 rounded-xl border border-hairline-2 text-sm font-semibold
              text-muted hover:bg-canvas">
            Quay lại
          </button>
          <button
            disabled={!action || loading}
            onClick={handleRefund}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold
              text-white font-bold disabled:opacity-40">
            {loading
              ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <ChevronRight size={16} />}
            {loading ? 'Đang xử lý...' : action === 'REFUND' ? 'Xác nhận hoàn tiền' : 'Tiếp tục'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Xử lý hàng nhận về ────────────────────────────────────────────────
// FIX Bug 2: Thêm cảnh báo "⚠ Khách đã sử dụng X đơn vị" khi khách trả ít hơn
// số lượng nguyên đơn, và tự động điền note ghi chú số lượng đã dùng.
function Step3Restock({ order, returnedItems, onClose, onSuccess, onBack }) {
  const toast = useToast();
  const [action, setAction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Tính các item có khách đã dùng 1 phần (usedBaseUnits > 0)
  const partialItems = returnedItems.filter(it => Number(it.usedBaseUnits) > 0);

  // Auto-fill note từ danh sách SP mà khách đã dùng một phần
  const autoNote = partialItems.length > 0
    ? 'Khách đã sử dụng: ' + partialItems
        .map(it => `${it.productName}: ${Number(it.usedBaseUnits)} ${it.unit || it.meta?.baseUnit || 'SP'}`)
        .join(', ')
    : '';

  const [note, setNote] = useState(autoNote);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post(`/api/orders/${order.id}/restock`, {
        items: returnedItems.map(it => ({
          orderItemId: it.orderItemId,
          quantity: Number(it.qty),
        })),
        action,
        note: note.trim() || null,
      });
      setDone(true);
      toast(action === 'RESTOCK' ? 'Đã nhập lại vào kho' : 'Đã ghi nhận tiêu hủy', 'success');
      if (onSuccess) onSuccess();
    } catch (e) {
      toast(e?.response?.data?.message || e?.message || 'Lỗi xử lý hàng', 'error');
    } finally { setLoading(false); }
  };

  if (done) return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-hairline flex items-center gap-3">
        <CheckCircle2 size={20} className="text-emerald-500" />
        <h2 className="text-base font-bold text-ink">Hoàn tất</h2>
        <button onClick={onClose} className="ml-auto p-2 rounded-xl hover:bg-canvas text-muted">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-ink">
            {action === 'RESTOCK' ? 'Hàng đã được nhập lại vào kho' : 'Đã ghi nhận tiêu hủy'}
          </p>
        </div>
      </div>
      <div className="p-5">
        <button onClick={onClose} className="w-full py-3 rounded-xl bg-gold text-white font-bold">
          Đóng
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-hairline flex items-center gap-3">
        <Package size={18} className="text-gold shrink-0" />
        <div>
          <h2 className="text-base font-bold text-ink">Xử lý hàng nhận về</h2>
          <p className="text-xs text-muted">{returnedItems.length} sản phẩm từ đơn {order.orderCode}</p>
        </div>
        <button onClick={onClose} className="ml-auto p-2 rounded-xl hover:bg-canvas text-muted">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Danh sách SP trả + cảnh báo đã dùng một phần */}
        <div className="rounded-xl bg-canvas px-4 py-3 divide-y divide-hairline">
          {returnedItems.map(it => {
            const displayQty = (() => {
              if (it.meta?.isBox) {
                const boxes = it.qtyBoxes ?? Math.floor(Number(it.qtyDisplay || 0) / (it.meta.unitsPerBox || 1));
                const loose = it.qtyLoose ?? (Number(it.qtyDisplay || 0) % (it.meta.unitsPerBox || 1));
                const parts = [];
                if (boxes > 0) parts.push(`${boxes} thùng`);
                if (loose > 0) parts.push(`${loose} ${it.unit || it.meta.baseUnit}`);
                return parts.join(' + ') || '0';
              }
              return `${Number(it.qtyDisplay || it.qty)} ${it.unit || it.meta?.baseUnit || 'SP'}`;
            })();

            const usedQty = Number(it.usedBaseUnits) || 0;
            const unitLabel = it.unit || it.meta?.baseUnit || 'SP';

            return (
              <div key={it.orderItemId} className="py-2.5 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-ink font-medium">{it.productName}</span>
                  <span className="text-muted font-medium">{displayQty}</span>
                </div>
                {/* [FIX Bug 2] Cảnh báo khi khách trả ít hơn số lượng đơn */}
                {usedQty > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400
                    bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25
                    rounded-lg px-2.5 py-1.5">
                    <span className="text-base leading-none">⚠</span>
                    <span>Khách đã sử dụng <strong>{usedQty} {unitLabel}</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Chọn hành động */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAction('DESTROY')}
            className={`p-4 rounded-2xl border-2 text-left transition-all
              ${action === 'DESTROY'
                ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                : 'border-hairline-2 hover:border-red-200'}`}
          >
            <Trash2 size={18} className={action === 'DESTROY' ? 'text-red-500' : 'text-muted'} />
            <p className="text-sm font-bold text-ink mt-2">Tiêu hủy</p>
            <p className="text-xs text-muted mt-0.5">Ghi lịch sử, không nhập kho</p>
          </button>
          <button
            onClick={() => setAction('RESTOCK')}
            className={`p-4 rounded-2xl border-2 text-left transition-all
              ${action === 'RESTOCK'
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                : 'border-hairline-2 hover:border-emerald-200'}`}
          >
            <Package size={18} className={action === 'RESTOCK' ? 'text-emerald-500' : 'text-muted'} />
            <p className="text-sm font-bold text-ink mt-2">Nhập lại kho</p>
            <p className="text-xs text-muted mt-0.5">Cộng lại lô đã xuất</p>
          </button>
        </div>

        {/* [FIX Bug 2] Ô ghi chú — tự động điền khi có SP đã dùng một phần */}
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 block">
            Ghi chú xử lý
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Ghi chú thêm (tuỳ chọn)..."
            className="w-full px-3 py-2.5 rounded-xl border border-hairline-2 text-sm
              focus:outline-none focus:border-gold resize-none bg-surface text-ink
              placeholder:text-faint"
          />
          {partialItems.length > 0 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
              ✦ Đã điền tự động từ số lượng khách đã sử dụng
            </p>
          )}
        </div>
      </div>

      <div className="p-5 border-t border-hairline flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-hairline-2
            text-sm font-semibold text-muted hover:bg-canvas"
        >
          <ArrowLeft size={14} /> Quay lại
        </button>
        <button
          disabled={!action || loading}
          onClick={handleSubmit}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gold
            text-white font-bold disabled:opacity-40"
        >
          {loading
            ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <CheckCircle2 size={16} />}
          {loading
            ? 'Đang xử lý...'
            : action === 'DESTROY'
              ? 'Xác nhận tiêu hủy'
              : 'Nhập lại kho'}
        </button>
      </div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function OrderExchangeModal({ order, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState(null);
  const [returnedItems, setReturnedItems] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
      bg-black/40 backdrop-blur-sm">
      <div className="w-full sm:max-w-[79rem] bg-surface rounded-t-3xl sm:rounded-3xl
        shadow-2xl flex flex-col max-h-[92vh] sm:min-h-[80dvh]">
        {step === 1 && (
          <Step1SelectItems
            order={order}
            onClose={onClose}
            onNext={data => { setStep1Data(data); setStep(2); }}
          />
        )}
        {step === 2 && (
          <Step2ChooseAction
            order={order}
            selectedData={step1Data}
            onBack={() => setStep(1)}
            onClose={onClose}
            // FIX: API thành công → chuyển thẳng sang Step 3 (không qua màn hình kết quả)
            onDone={(items) => { setReturnedItems(items); setStep(3); }}
          />
        )}
        {step === 3 && (
          <Step3Restock
            order={order}
            returnedItems={returnedItems}
            onClose={onClose}
            // FIX: onSuccess chỉ gọi sau khi submit bước 3 xong
            onSuccess={onSuccess}
            // FIX: nút "Quay lại" → quay về Bước 2
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}