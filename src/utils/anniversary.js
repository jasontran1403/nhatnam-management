// src/utils/anniversary.js
/**
 * HIỂN THỊ NGÀY KỶ NIỆM (sinh nhật nhân viên / khách lẻ, khai trương cửa hàng khách công ty).
 *
 * <p>Backend đã tính sẵn `daysUntilBirthday` / `daysUntilAnniversary` và cờ
 * `birthdayThisMonth` / `anniversaryUpcoming` theo giờ Việt Nam. File này CHỈ lo phần
 * hiển thị — cố ý không tính lại logic ngày ở client, vì trình duyệt của người dùng có
 * thể ở múi giờ khác và sẽ tô màu lệch một ngày so với danh sách server trả về.
 *
 * <p>Các hàm `*Fallback` chỉ dùng khi API cũ chưa trả cờ (VD dữ liệu cache lại từ màn
 * hình khác) — luôn ưu tiên cờ từ server nếu có.
 */

/** Định dạng epoch millis → "dd/MM/yyyy". Trả '—' khi chưa khai báo. */
export function formatDate(millis) {
  if (!millis) return '—';
  const d = new Date(millis);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Chỉ ngày/tháng — dùng cho cột sinh nhật khi năm sinh không quan trọng. */
export function formatDayMonth(millis) {
  if (!millis) return '—';
  const d = new Date(millis);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
}

/** "dd/MM lúc HH:mm" — dùng cho nhãn "đã liên hệ lúc…". */
export function formatDateTime(millis) {
  if (!millis) return '—';
  const d = new Date(millis);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} lúc ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Tuổi tính theo năm — hiển thị kèm ngày sinh nhân viên. */
export function ageFrom(millis) {
  if (!millis) return null;
  const b = new Date(millis);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * NHÃN ĐẾM NGƯỢC. `days` là số ngày server trả về (0 = hôm nay).
 * Trả null khi chưa khai báo ngày → phía gọi tự quyết định hiển thị gì.
 */
export function countdownLabel(days) {
  if (days == null) return null;
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  if (days <= 30) return `Còn ${days} ngày`;
  return null;                                    // quá xa thì không cần nhắc
}

/**
 * CLASS TAILWIND CHO HÀNG SẮP TỚI DỊP.
 *
 * <p>Ba mức: hôm nay (đậm nhất) → trong 7 ngày → trong tháng. Đã qua ngày thì trả chuỗi
 * rỗng để hàng về màu bình thường, đúng yêu cầu "đã qua sinh nhật thì về màu bình thường".
 *
 * @param upcoming cờ `birthdayThisMonth` / `anniversaryUpcoming` từ server
 * @param days     `daysUntilBirthday` / `daysUntilAnniversary` từ server
 * @param tone     'rose' cho sinh nhật, 'emerald' cho khai trương cửa hàng
 */
export function anniversaryRowClass(upcoming, days, tone = 'rose') {
  if (!upcoming) return '';
  const palette = {
    rose: {
      today: 'bg-rose-100 dark:bg-rose-500/20 ring-1 ring-inset ring-rose-300 dark:ring-rose-500/40',
      soon:  'bg-rose-50 dark:bg-rose-500/12',
      month: 'bg-rose-50/60 dark:bg-rose-500/8',
    },
    emerald: {
      today: 'bg-emerald-100 dark:bg-emerald-500/20 ring-1 ring-inset ring-emerald-300 dark:ring-emerald-500/40',
      soon:  'bg-emerald-50 dark:bg-emerald-500/12',
      month: 'bg-emerald-50/60 dark:bg-emerald-500/8',
    },
  }[tone] || {};

  if (days === 0) return palette.today || '';
  if (days != null && days <= 7) return palette.soon || '';
  return palette.month || '';
}

/** Class cho badge nhỏ đi kèm ngày kỷ niệm. */
export function anniversaryBadgeClass(days, tone = 'rose') {
  const base = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap';
  if (tone === 'emerald') {
    return days === 0
      ? `${base} bg-emerald-500 text-white`
      : `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300`;
  }
  return days === 0
    ? `${base} bg-rose-500 text-white`
    : `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300`;
}

/**
 * Cờ "sắp tới dịp" tính Ở CLIENT — CHỈ dùng khi server chưa trả cờ.
 * Xem javadoc đầu file về lý do không nên dùng làm mặc định.
 */
export function isUpcomingThisMonthFallback(millis) {
  if (!millis) return false;
  const d = new Date(millis);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getDate() >= now.getDate();
}
