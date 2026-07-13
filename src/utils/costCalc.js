// src/utils/costCalc.js
// ─────────────────────────────────────────────────────────────────────────────
// PHÂN BỔ THUẾ/PHÍ VÀO GIÁ VỐN — bản sao y hệt logic backend
// (com.nhatnam.server.utils.CostAllocation). Dùng cho PREVIEW trên UI.
// Backend vẫn là nguồn chân lý khi LƯU — FE chỉ tính để hiển thị tạm tính.
//
// QUY TẮC
//  1. Giá trị 1 dòng:        lineValue = unitPrice × quantity
//  2. Phí dòng i phải gánh:  fee × lineValue_i / Σ lineValue (trong phạm vi áp dụng)
//  3. Giá vốn 1 đơn vị:      unitPrice + (tổng phí gánh) / quantity
//  4. CHỈ làm tròn ở BƯỚC CUỐI → giá vốn làm tròn tới hàng ĐƠN VỊ ĐỒNG (HALF_UP).
//     Các bước trung gian giữ nguyên phần thập phân.
//  5. Không có thuế/phí → giá vốn = đơn giá nhập.
//
// VÍ DỤ
//   A=1.000.000 B=1.200.000 C=900.000 (qty=1), phí = 500.000
//   → A: 1.000.000/3.100.000 × 500.000 = 161.290,32…  → giá vốn 1.161.290
//   → B: 1.393.548 ; C: 1.045.161
// ─────────────────────────────────────────────────────────────────────────────

/** Số chữ số thập phân tối đa cho tiền người dùng nhập */
export const MONEY_DECIMALS = 3;

/** Làm tròn HALF_UP tới n chữ số thập phân (tránh lỗi -0 và sai số nhị phân nhỏ) */
export function roundTo(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, decimals);
  // + Number.EPSILON để 2.675 * 100 = 267.49999… vẫn tròn thành 267.5
  const r = Math.round((n * f) * (1 + Number.EPSILON)) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** Chuẩn hoá số tiền nhập tay → tối đa 3 số thập phân */
export const normalizeMoney = (v) => roundTo(v, MONEY_DECIMALS);

/** Làm tròn tới hàng ĐƠN VỊ ĐỒNG — chỉ dùng ở bước cuối (giá vốn) */
export const roundToDong = (v) => roundTo(v, 0);

/**
 * Đơn giá suy ra từ TỔNG TIỀN của 1 mặt hàng.
 * total / quantity, làm tròn 3 số thập phân.
 */
export function unitPriceFromTotal(total, quantity) {
  const q = Number(quantity) || 0;
  if (q <= 0) return 0;
  return roundTo(Number(total) / q, MONEY_DECIMALS);
}

/**
 * Parse chuỗi người dùng gõ → number, chấp nhận tối đa 3 số thập phân.
 * Cho phép cả "1.234,5" (VN) lẫn "1234.5".
 */
export function parseMoneyInput(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).trim().replace(/\s/g, '');
  // Nếu có cả "." và "," → "." là phân cách nghìn, "," là thập phân (kiểu VN)
  let cleaned;
  if (s.includes('.') && s.includes(',')) cleaned = s.replace(/\./g, '').replace(',', '.');
  else cleaned = s.replace(',', '.');
  const n = Number(cleaned.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Chặn nhập quá 3 số thập phân ngay khi gõ (dùng cho onChange của input text).
 * Trả về chuỗi hợp lệ để set lại vào state, hoặc null nếu ký tự không hợp lệ.
 */
export function clampDecimalInput(raw, decimals = MONEY_DECIMALS) {
  let s = String(raw ?? '').replace(/[^0-9.]/g, '');
  const parts = s.split('.');
  if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
  const [int, dec] = s.split('.');
  if (dec !== undefined) return int + '.' + dec.slice(0, decimals);
  return s;
}

/**
 * Tính giá vốn cho toàn bộ các dòng.
 *
 * @param {Array<{id:any, quantity:number, unitPrice:number}>} lines
 * @param {Array<{label:string, amount:number, itemIds?:Array}>} fees
 *        itemIds rỗng/null = áp dụng cho TẤT CẢ các dòng
 * @returns {Map<any, {id, quantity, unitPrice, lineValue, feeShare, unitCost, lineCost, feeBreakdown}>}
 */
export function allocateCost(lines, fees = []) {
  const qty = new Map();
  const price = new Map();
  const lineValue = new Map();

  for (const l of lines) {
    const q = Number(l.quantity) || 0;
    const p = Number(l.unitPrice) || 0;
    qty.set(l.id, q);
    price.set(l.id, p);
    lineValue.set(l.id, p * q);
  }

  const feeShare = new Map();
  const breakdown = new Map();
  for (const id of qty.keys()) {
    feeShare.set(id, 0);
    breakdown.set(id, {});
  }

  for (const fee of fees || []) {
    const amount = Number(fee.amount) || 0;
    if (!amount) continue;

    const scope = (!fee.itemIds || fee.itemIds.length === 0)
      ? [...qty.keys()]
      : fee.itemIds.filter((id) => qty.has(id));
    if (scope.length === 0) continue;

    const scopeTotal = scope.reduce((s, id) => s + lineValue.get(id), 0);

    let allocated = 0;
    scope.forEach((id, i) => {
      const isLast = i === scope.length - 1;
      let share;
      if (isLast) {
        // dòng cuối nhận phần dư → tổng phân bổ luôn khớp đúng số tiền phí
        share = amount - allocated;
      } else if (scopeTotal > 0) {
        share = (amount * lineValue.get(id)) / scopeTotal;
      } else {
        share = amount / scope.length;
      }
      allocated += share;
      feeShare.set(id, feeShare.get(id) + share);
      const b = breakdown.get(id);
      b[fee.label] = (b[fee.label] || 0) + share;
    });
  }

  const out = new Map();
  for (const id of qty.keys()) {
    const q = qty.get(id);
    const fs = feeShare.get(id);
    const feePerUnit = q > 0 ? fs / q : 0;
    // ← BƯỚC CUỐI: làm tròn tới hàng đơn vị đồng
    const unitCost = roundToDong(price.get(id) + feePerUnit);
    out.set(id, {
      id,
      quantity: q,
      unitPrice: price.get(id),
      lineValue: lineValue.get(id),
      feeShare: fs,
      unitCost,
      lineCost: unitCost * q,
      feeBreakdown: breakdown.get(id),
    });
  }
  return out;
}

/** Hiển thị tiền, giữ tối đa `d` số thập phân (bỏ số 0 thừa). */
export function fmtMoney(v, d = MONEY_DECIMALS) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  }).format(n);
}

/** Hiển thị giá vốn (luôn là số nguyên đồng). */
export const fmtDong = (v) => fmtMoney(v, 0);
