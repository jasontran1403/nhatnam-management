/**
 * brand.js — Nguồn sự thật duy nhất cho tên thương hiệu và mọi text liên quan.
 *
 * Vì sao tách file: tên công ty có thể đổi. Trước đây nó nằm rải rác dạng chuỗi
 * cứng trong 6 file layout khác nhau, đổi tên là phải đi sửa từng chỗ và chắc
 * chắn sót. Giờ chỉ sửa ở đây.
 *
 * Ba nhóm dữ liệu, đừng lẫn lộn:
 *   1. BRAND      — tên để HIỂN THỊ (chính tả chuẩn, có dấu).
 *   2. BRAND_ALIASES — các biến thể để TÌM KIẾM/ĐỐI SÁNH (không dấu, viết liền,
 *      viết hoa lung tung...). Dùng khi lọc dữ liệu từ backend hoặc khi người
 *      dùng gõ vào ô tìm kiếm.
 *   3. Helper matchesBrand() / normalize() — logic đối sánh chịu được sai lệch.
 */

/* ── 1. Tên hiển thị ────────────────────────────────────────────────────────── */

export const BRAND = {
  /** Tên đầy đủ, dùng ở footer, tiêu đề trang, email. */
  fullName: 'Nhất Nam Fine Foods',

  /** Phần tên riêng — dòng trên của logo. */
  name: 'Nhất Nam',

  /** Phần mô tả loại hình — dòng dưới của logo, thường in hoa cách chữ. */
  suffix: 'Fine Foods',

  /** Tên pháp nhân đầy đủ (hoá đơn, hợp đồng, phiếu in). */
  legalName: 'Công ty TNHH Nhất Nam Fine Foods',

  /** Tên ASCII không dấu — dùng cho tên file export, slug, mã chứng từ. */
  asciiName: 'Nhat Nam Fine Foods',

  /** Slug — id CSS, key localStorage, tên file tải về. */
  slug: 'nhatnam',

  /** Tiêu đề tab trình duyệt. */
  documentTitle: 'Nhất Nam Fine Foods',

  /** Dòng bản quyền ở footer. Năm tự cập nhật, không phải sửa tay mỗi tháng 1. */
  get copyright() {
    return `© ${new Date().getFullYear()} ${this.fullName}. All rights reserved.`;
  },

  /** Thông tin liên hệ — điền khi cần, để trống thì UI tự ẩn. */
  contact: {
    phone: '',
    email: '',
    address: '',
    website: '',
  },

  /** Ví dụ minh hoạ trong placeholder form (trước đây nằm trong lang-*.json). */
  examples: {
    sauce: { vi: 'Ví dụ: Sốt dừa Nhất Nam', en: 'E.g. Nhat Nam coconut sauce' },
    sausage: { vi: 'Ví dụ: Xúc xích truyền thống Nhất Nam', en: 'E.g. Nhat Nam traditional sausage' },
  },
};

/* ── 2. Biến thể dùng để tìm kiếm / đối sánh ────────────────────────────────── */

/**
 * Mọi cách viết tên thương hiệu từng gặp trong dữ liệu thật.
 * Backend, file Excel nhập tay, đơn hàng cũ... mỗi nơi viết một kiểu.
 * Thêm biến thể mới vào đây là toàn bộ chỗ tìm kiếm nhận ra ngay.
 */
export const BRAND_ALIASES = [
  'Nhatnam Finefoods',
  'Nhất Nam Finefoods',
  'Nhat Nam Finefoods',
  'Nhat nam Finefoods',
  'Nhat nam Fine foods',
  'Nhất Nam Fine Foods',
  'Nhat Nam Fine Foods',
  'NhatNam FineFoods',
  'Nhất Nam',
  'Nhat Nam',
  'NhatNam',
  'Nhatnam',
];

/* ── 3. Helper đối sánh ─────────────────────────────────────────────────────── */

/**
 * Chuẩn hoá chuỗi về dạng so sánh được: bỏ dấu tiếng Việt, về chữ thường,
 * bỏ mọi khoảng trắng và dấu câu.
 *
 * "Nhất Nam Fine Foods" → "nhatnamfinefoods"
 * "NHAT-NAM_FINEFOODS"  → "nhatnamfinefoods"
 *
 * Nhờ vậy 5 biến thể trong BRAND_ALIASES thực chất gộp về cùng một khoá, và
 * người dùng gõ thiếu dấu hay thừa khoảng trắng vẫn tìm ra.
 */
export function normalizeBrandText(input) {
  return String(input ?? '')
    .normalize('NFD')
    // Bỏ dấu thanh và dấu mũ (U+0300–U+036F)
    .replace(/[\u0300-\u036f]/g, '')
    // đ/Đ không nằm trong dải trên nên phải xử lý riêng
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Tập khoá đã chuẩn hoá — tính sẵn 1 lần, tra cứu O(1). */
const ALIAS_KEYS = new Set(BRAND_ALIASES.map(normalizeBrandText));

/**
 * Chuỗi này có phải là tên thương hiệu không? (khớp chính xác sau chuẩn hoá)
 * Dùng khi phân loại: đơn hàng này của nội bộ hay của khách ngoài.
 */
export function isBrand(text) {
  return ALIAS_KEYS.has(normalizeBrandText(text));
}

/**
 * Chuỗi này có CHỨA tên thương hiệu không?
 * Dùng khi lọc danh sách: "CTY TNHH NHAT NAM FINEFOODS - CN HCM" → true.
 */
export function containsBrand(text) {
  const key = normalizeBrandText(text);
  if (!key) return false;
  for (const alias of ALIAS_KEYS) {
    if (alias.length >= 6 && key.includes(alias)) return true;
  }
  return false;
}

/**
 * Từ khoá người dùng gõ có đang tìm thương hiệu không?
 * Khác containsBrand ở chỗ chấp nhận gõ dở: "nhat n", "finefo".
 * Dùng cho ô search có gợi ý tức thì.
 */
export function matchesBrandQuery(query) {
  const key = normalizeBrandText(query);
  if (key.length < 3) return false;
  for (const alias of ALIAS_KEYS) {
    if (alias.startsWith(key) || alias.includes(key)) return true;
  }
  return false;
}

/**
 * Thay mọi biến thể tên thương hiệu trong chuỗi bằng chính tả chuẩn.
 * Dùng khi làm sạch dữ liệu nhập từ Excel trước khi lưu.
 */
export function canonicalizeBrand(text) {
  if (!text) return text;
  // Sắp xếp alias dài trước để không thay nhầm phần con ("Nhất Nam" trong
  // "Nhất Nam Fine Foods") rồi để lại đuôi mồ côi.
  const sorted = [...BRAND_ALIASES].sort((a, b) => b.length - a.length);
  let out = String(text);
  for (const alias of sorted) {
    // \s* giữa các từ để bắt cả "Nhat  Nam" lẫn "NhatNam"
    const pattern = alias.split(/\s+/).map(escapeRegExp).join('\\s*');
    out = out.replace(new RegExp(pattern, 'gi'), BRAND.fullName);
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default BRAND;
