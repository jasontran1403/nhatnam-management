// src/utils/formatPrice.js
// Dùng chung cho toàn bộ app — không làm tròn, hiển thị tối đa 2 chữ số thập phân

/**
 * Format số tiền VNĐ.
 * - Không làm tròn (420000.55 → "420.000,55 đ")
 * - Bỏ .00 thừa (420000.00 → "420.000 đ")
 * - Tối đa 2 chữ số thập phân
 *
 * @param {number|string|null|undefined} price
 * @returns {string}
 */
export function formatPrice(price) {
  const num = Number(price);
  if (isNaN(num)) return '0 đ';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num) + ' đ';
}

/**
 * Format số tiền không có đơn vị (dùng trong input display).
 * @param {number|string|null|undefined} price
 * @returns {string}
 */
export function formatPriceRaw(price) {
  const num = Number(price);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}