/**
 * format.js — Nguồn sự thật duy nhất cho việc định dạng số, tiền, ngày giờ.
 *
 * Trước đây mỗi trang tự khai báo lại formatVND / fmtDate / fmtQty — khoảng 120
 * chỗ, với ít nhất 4 cách hiển thị giá trị rỗng khác nhau ('0 đ', '—', '', '0').
 * Kết quả: cùng một bảng, cột này hiện '—' còn cột kia hiện '0 đ'.
 *
 * Quy ước thống nhất từ đây:
 *   - Giá trị trống  → EMPTY ('—'), trừ hàm có hậu tố `Zero` thì trả '0'.
 *   - Tiền tệ        → dấu chấm ngăn nghìn kiểu vi-VN, hậu tố ' đ'.
 *   - Ngày           → dd/mm/yyyy. Giờ → HH:mm.
 */

export const EMPTY = '—';

const nf = new Intl.NumberFormat('vi-VN');
const nfQty = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });

/* ── Số ─────────────────────────────────────────────────────────────────────── */

/** 1234567 → "1.234.567" */
export const formatNumber = (v) => nf.format(Math.round(Number(v) || 0));

/** Số lượng, giữ tối đa 3 chữ số thập phân: 12.5 → "12,5" */
export const formatQty = (v) => nfQty.format(Number(v) || 0);

/** Phần trăm: 12.345 → "12,3%" */
export const formatPercent = (v, digits = 1) =>
  `${(Number(v) || 0).toFixed(digits).replace('.', ',')}%`;

/* ── Tiền ───────────────────────────────────────────────────────────────────── */

/** 1234567 → "1.234.567 đ". Trống → "0 đ" (dùng trong bảng tổng tiền). */
export const formatVND = (v) => `${nf.format(Math.round(Number(v) || 0))} đ`;

/** Như formatVND nhưng trống → "—" (dùng khi "chưa có" khác với "bằng 0"). */
export const formatVNDOrEmpty = (v) =>
  (v === null || v === undefined || v === '') ? EMPTY : formatVND(v);

/** Ký hiệu ₫ liền, dùng trong không gian hẹp: "1.234.567₫" */
export const formatDong = (v) => `${nf.format(Math.round(Number(v) || 0))}₫`;

/** Rút gọn cho biểu đồ và thẻ số liệu: 1250000 → "1,25 tr", 8500000000 → "8,5 tỷ" */
export function formatMoneyShort(v) {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2).replace('.', ',')} tỷ`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2).replace('.', ',')} tr`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}k`;
  return `${sign}${abs}`;
}

/* ── Ngày giờ ───────────────────────────────────────────────────────────────── */

/**
 * Chấp nhận: timestamp (số hoặc chuỗi số), chuỗi ISO, đối tượng Date.
 * Trả về null nếu không hợp lệ — mọi hàm dưới đây đều đi qua đây, nên một
 * chuỗi rác từ backend sẽ ra '—' chứ không phải "Invalid Date".
 */
export function toDate(input) {
  if (input === null || input === undefined || input === '') return null;
  const d = input instanceof Date ? input : new Date(/^\d+$/.test(String(input)) ? Number(input) : input);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n) => String(n).padStart(2, '0');

/** 12/03/2025 */
export function formatDate(input) {
  const d = toDate(input);
  if (!d) return EMPTY;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** 12/03 — dùng cho trục biểu đồ và bảng hẹp */
export function formatDateShort(input) {
  const d = toDate(input);
  if (!d) return EMPTY;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** 09:45 */
export function formatTime(input) {
  const d = toDate(input);
  if (!d) return EMPTY;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 09:45 12/03/2025 — giờ đứng trước vì trong nhật ký thao tác, giờ mới là thứ được quét mắt */
export function formatDateTime(input) {
  const d = toDate(input);
  if (!d) return EMPTY;
  return `${formatTime(d)} ${formatDate(d)}`;
}

/** 03/2025 */
export function formatMonth(input) {
  const d = toDate(input);
  if (!d) return EMPTY;
  return `${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "2 giờ trước", "3 ngày trước" — cho thông báo và nhật ký */
export function formatRelative(input) {
  const d = toDate(input);
  if (!d) return EMPTY;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 2592000) return `${Math.floor(s / 86400)} ngày trước`;
  return formatDate(d);
}

/** Khoảng thời lượng tính bằng phút → "2h 15p" */
export function formatDuration(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m <= 0) return EMPTY;
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}p` : `${m}p`;
}

/** yyyy-mm-dd — định dạng backend và <input type="date"> cùng hiểu */
export function toISODate(input) {
  const d = toDate(input);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ── Bí danh tương thích ngược ──────────────────────────────────────────────── */
/* Code cũ gọi bằng nhiều tên khác nhau. Giữ bí danh để chuyển dần, không phải
   sửa hết trong một lần. Khi không còn chỗ nào dùng thì xoá cả khối này. */

export const fmtVND = formatVND;
export const fmtMoney = formatVND;
export const fmtVnd = formatVND;
export const formatVnInt = formatNumber;
export const fmtNum = formatNumber;
export const fmtQty = formatQty;
export const fmtDate = formatDate;
export const fmtDateTime = formatDateTime;
export const fmtTime = formatTime;
export const fmtDuration = formatDuration;
