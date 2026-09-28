// src/api/officeSupplyApi.js
// API cho module "Đăng ký / Đặt hàng Văn phòng phẩm (VPP)".
import api from './axios';

const r = (res) => res.data?.data ?? res.data;

export const officeSupplyApi = {
  // ── Danh mục vật dụng ────────────────────────────────────────────────────
  /** Danh sách vật dụng kèm thống kê số lần mua, ngày mua gần nhất. */
  items: (warehouseId) =>
    api.get('/api/office-supply/items', {
      params: warehouseId ? { warehouseId } : {},
    }).then(r),

  // ── Phiếu đăng ký của nhân viên ──────────────────────────────────────────
  /** Phiếu đăng ký hiện tại của user đang đăng nhập (tất cả văn phòng). */
  myRequests: () => api.get('/api/office-supply/my-request').then(r),

  /**
   * Lưu / cập nhật phiếu đăng ký cho 1 văn phòng.
   * body: { warehouseId, items: [{ supplyItemId, quantity, note }] }
   */
  saveRequest: (body) => api.put('/api/office-supply/my-request', body).then(r),

  /** Xóa phiếu đăng ký cho 1 văn phòng. */
  deleteRequest: (warehouseId) =>
    api.delete('/api/office-supply/my-request', { params: { warehouseId } }).then(r),

  // ── OWNER: tổng hợp + đặt hàng ───────────────────────────────────────────
  /** Preview tổng hợp (sheet 1 + sheet 2) trước khi bấm đặt. */
  summary: (warehouseId) =>
    api.get('/api/office-supply/admin/summary', { params: { warehouseId } }).then(r),

  /** OWNER bấm "Đặt hàng" — tạo đơn + clear toàn bộ request của văn phòng đó. */
  placeOrder: (warehouseId) =>
    api.post('/api/office-supply/admin/place-order', null, { params: { warehouseId } }).then(r),

  // ── Lịch sử đặt hàng ─────────────────────────────────────────────────────
  /** Lịch sử đặt hàng của 1 văn phòng — mới nhất trước. */
  orderHistory: (warehouseId) =>
    api.get('/api/office-supply/admin/orders', { params: { warehouseId } }).then(r),

  /** Chi tiết 1 lần đặt hàng (danh sách nhân viên + từng vật dụng). */
  orderDetail: (orderId) =>
    api.get(`/api/office-supply/admin/orders/${orderId}`).then(r),

  /**
   * Xuất phiếu đặt hàng ra PDF (bytes). Trả về response gốc để caller lấy
   * blob và trigger download bằng downloadBlob().
   */
  exportOrderVoucherPdf: (warehouseId) =>
    api.get('/api/office-supply/admin/order-voucher/pdf', {
      params: { warehouseId },
      responseType: 'blob',
    }),

  // ── Báo cáo vật dụng ─────────────────────────────────────────────────────
  /**
   * Báo cáo: số lần mua + ngày gần nhất + khoảng cách TB giữa 2 lần đặt +
   * số lượng TB / lần đặt.
   */
  itemReport: (warehouseId) =>
    api.get('/api/office-supply/admin/item-report', { params: { warehouseId } }).then(r),

  // ── Admin: DANH MỤC VẬT DỤNG (add / edit) ────────────────────────────────
  /** Danh sách vật dụng đầy đủ cho trang "Danh sách văn phòng phẩm" (Owner). */
  adminItems: () => api.get('/api/office-supply/admin/catalog').then(r),

  /** Tạo mới vật dụng. body: { name, unit, specification? } */
  adminCreateItem: (body) => api.post('/api/office-supply/admin/catalog', body).then(r),

  /** Sửa vật dụng. body: { name, unit, specification? } */
  adminUpdateItem: (id, body) =>
    api.put(`/api/office-supply/admin/catalog/${id}`, body).then(r),
};

/**
 * Phân giải id "Kho Trung tâm" — kho VPP DUY NHẤT sau khi refactor UX.
 *
 * <p>BE vẫn giữ cột warehouseId trên request/order (không phải migrate schema),
 * nên FE cần biết id để gọi các endpoint cũ. Cache lại trong session để đỡ hit
 * server; nếu chưa có kho nào (deployment mới) sẽ fallback lấy warehouse đầu tiên.
 */
let _centralWarehouseIdCache = null;
export const resolveCentralWarehouseId = async () => {
  if (_centralWarehouseIdCache) return _centralWarehouseIdCache;
  const res = await api.get('/api/owner/supply-warehouses');
  const list = res.data?.data ?? res.data ?? [];
  const central = list.find(w =>
    (w.name || '').trim().toLowerCase() === 'kho trung tâm'.toLowerCase())
    ?? list[0];
  _centralWarehouseIdCache = central?.id ?? null;
  return _centralWarehouseIdCache;
};

/**
 * Cùng logic nhưng cho staff (không có quyền /api/owner/*).
 * Endpoint /api/supply-warehouses trả về kho mà user được gán.
 */
export const resolveMyWarehouseId = async () => {
  if (_centralWarehouseIdCache) return _centralWarehouseIdCache;
  const res = await api.get('/api/supply-warehouses');
  const list = res.data?.data ?? res.data ?? [];
  const central = list.find(w =>
    (w.name || '').trim().toLowerCase() === 'kho trung tâm'.toLowerCase())
    ?? list[0];
  _centralWarehouseIdCache = central?.id ?? null;
  return _centralWarehouseIdCache;
};

// ── Helper format ────────────────────────────────────────────────────────────
/** Format số lượng (bỏ đuôi .000 nhưng giữ .500 → 0,5). */
export const fmtQtyOff = (v) =>
  v == null ? '—'
    : Number(v) % 1 === 0
      ? String(Number(v))
      : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 });

/** ms → "dd/MM/yyyy HH:mm" */
export const fmtDtOff = (ms) =>
  ms ? new Date(ms).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';

/** ms → "dd/MM/yyyy" */
export const fmtDateOff = (ms) =>
  ms ? new Date(ms).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }) : '—';

/** Số ngày từ ms đến hiện tại. */
export const daysSince = (ms) =>
  ms ? Math.floor((Date.now() - ms) / 86400000) : null;