// src/utils/vnNumber.js
// Định dạng số theo chuẩn Việt Nam: ngăn cách nghìn bằng ".", thập phân bằng ",".

/** Chuỗi VN ("1.234,56") -> số JS. */
export function parseVN(str) {
  if (str == null || str === '') return 0;
  const s = String(str).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format chuỗi người dùng đang gõ -> hiển thị VN, giữ được trạng thái đang nhập
 * phần thập phân (VD: "30," hay "1.234,5").
 */
export function formatVNInput(raw, maxDecimals = 0) {
  if (raw == null) return '';
  let s = String(raw).replace(/[^\d,]/g, ''); // giữ chữ số + dấu phẩy (bỏ dấu chấm nghìn)
  if (maxDecimals <= 0) {
    s = s.replace(/,/g, '');
    if (!s) return '';
    return Number(s.replace(/^0+(?=\d)/, '')).toLocaleString('vi-VN');
  }
  const firstComma = s.indexOf(',');
  let intPart, decPart = null;
  if (firstComma >= 0) {
    intPart = s.slice(0, firstComma).replace(/,/g, '');
    decPart = s.slice(firstComma + 1).replace(/,/g, '').slice(0, maxDecimals);
  } else {
    intPart = s;
  }
  intPart = intPart.replace(/^0+(?=\d)/, '');
  const intFmt = intPart ? Number(intPart).toLocaleString('vi-VN') : (decPart !== null ? '0' : '');
  return decPart !== null ? `${intFmt || '0'},${decPart}` : intFmt;
}

/** Số JS -> hiển thị VN với số chữ số thập phân min/max. */
export function formatVN(n, maxDecimals = 0, minDecimals = 0) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  return Number(n).toLocaleString('vi-VN', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: Math.max(maxDecimals, minDecimals),
  });
}

/** Làm tròn HALF_UP tới đồng: 0.5 -> 1, 0.49 -> 0. */
export const roundHalfUp = (x) => Math.floor((Number(x) || 0) + 0.5);