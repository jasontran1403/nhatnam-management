/**
 * chartPalette.js — màu cho biểu đồ và sơ đồ Gantt.
 *
 * Vì sao tách riêng: bản đồ trạng thái → màu từng bị chép ra 3 file
 * (AdminDashboard, OwnerPlanDetailPage, OwnerProductionDashboard) và ĐÃ LỆCH
 * NHAU — cùng trạng thái SCHEDULED, một nơi vẽ xanh dương, nơi kia vẽ tím. Người
 * xem hai màn hình cạnh nhau không thể đối chiếu được.
 *
 * Màu ở đây trỏ về token nên tự đổi theo light/dark. Riêng dải màu chuỗi dữ liệu
 * (SERIES) dùng màu bão hoà cố định — chúng phải phân biệt được với nhau, và các
 * màu này đã đủ tương phản trên cả nền sáng lẫn nền tối.
 */

/** Trạng thái đơn hàng — dùng ở biểu đồ tròn trên dashboard. */
export const ORDER_STATUS_COLOR = {
  PENDING: 'var(--c-warning)',
  CONFIRMED: 'var(--c-info)',
  PREPARING: '#6366F1',
  READY: 'var(--c-steel)',
  DELIVERING: '#0EA5E9',
  PENDING_PAYMENT: 'var(--c-warning)',
  COMPLETED: 'var(--c-success)',
  CANCELLED: 'var(--c-danger)',
  FAILED: '#F43F5E',
};

/** Trạng thái lệnh sản xuất — dùng ở Gantt và trang chi tiết kế hoạch. */
export const WO_STATUS_COLOR = {
  SCHEDULED: 'var(--c-info)',
  PENDING_PLAN: 'var(--c-warning)',
  PLANNED: '#6366F1',
  IN_PROGRESS: 'var(--c-warning)',
  COMPLETED: 'var(--c-success)',
  CANCELLED: 'var(--c-muted)',
};

/** Màu mặc định khi gặp trạng thái lạ — luôn dùng thay vì để trống. */
export const FALLBACK_COLOR = 'var(--c-faint)';

/** Dải màu cho chuỗi dữ liệu nhiều thành phần (khách hàng, sản phẩm, chi phí). */
export const SERIES = [
  'var(--c-gold)',
  '#6366F1',
  'var(--c-success)',
  '#EC4899',
  'var(--c-info)',
  '#84CC16',
  'var(--c-warning)',
  '#8B5CF6',
];

/** Lấy màu chuỗi thứ i, tự lặp lại khi hết dải. */
export const seriesColor = (i) => SERIES[i % SERIES.length];

/** Màu cho lưới, trục, tooltip — phải theo theme, nếu không sẽ mất hút ở dark. */
export const CHART_GRID = 'var(--c-line)';
export const CHART_AXIS = 'var(--c-muted)';
export const CHART_TOOLTIP_BG = 'var(--c-surface)';
export const CHART_TOOLTIP_BORDER = 'var(--c-line)';

/**
 * Pha loãng một màu bất kỳ.
 *
 * Code cũ tạo màu mờ bằng cách nối chuỗi hex: `color + '20'`. Cách đó chỉ chạy
 * khi color là hex 6 ký tự — với token dạng var() nó tạo ra CSS vô nghĩa và
 * phần tử mất màu. `color-mix` nhận mọi loại giá trị màu, kể cả var().
 *
 * @param {string} color  hex, rgb(), hoặc var(--c-*)
 * @param {number} pct    độ đậm còn lại, 0–100
 */
export const withAlpha = (color, pct) =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;
