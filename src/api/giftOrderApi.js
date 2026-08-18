// src/api/giftOrderApi.js
import api from './axios';

const unwrap = (res) => {
  const body = res?.data;
  if (body && typeof body === 'object' && 'success' in body) {
    if (!body.success) throw new Error(body.message || 'Request failed');
    return body.data;
  }
  return body;
};

/**
 * PHIẾU TẶNG QUÀ BẰNG SẢN PHẨM.
 *
 * <p>Quà tặng dạng VOUCHER đi qua `voucherApi` chứ không phải đây — voucher không đụng
 * tồn kho và không cần kho xử lý giao, nên hai loại quà tách thành hai luồng riêng.
 */
export const giftOrderApi = {
  /** @param params { q, status, warehouseId, page, size } */
  list: (params) => api.get('/api/gift-orders', { params }).then(unwrap),

  getById: (id) => api.get(`/api/gift-orders/${id}`).then(unwrap),

  /**
   * Kho chọn được ở form tạo phiếu (đã lọc kho hoạt động, loại kho trung chuyển).
   *
   * <p>Cố ý KHÔNG gọi `/api/warehouse` — đường dẫn đó chỉ mở cho role WAREHOUSE,
   * seller gọi vào sẽ nhận lỗi 901.
   */
  warehouses: () => api.get('/api/gift-orders/warehouses').then(unwrap),

  /**
   * Sản phẩm có thể tặng từ một kho, kèm `availableQty` tham khảo.
   * Số này CHỈ để tham khảo lúc chọn hàng — tồn có thể đổi trước khi phiếu được duyệt.
   */
  products: (warehouseId, q) =>
    api.get('/api/gift-orders/products', { params: { warehouseId, q: q || undefined } }).then(unwrap),

  create: (data) => api.post('/api/gift-orders', data).then(unwrap),

  /** Kiểm tồn trước khi duyệt — không thay đổi dữ liệu. */
  stockCheck: (id) => api.get(`/api/gift-orders/${id}/stock-check`).then(unwrap),

  /** Duyệt: trừ kho + sinh phiếu xuất kho. Ném lỗi kèm danh sách thiếu nếu không đủ tồn. */
  approve: (id) => api.post(`/api/gift-orders/${id}/approve`).then(unwrap),
  reject: (id, reason) => api.post(`/api/gift-orders/${id}/reject`, { reason }).then(unwrap),
  cancel: (id) => api.post(`/api/gift-orders/${id}/cancel`).then(unwrap),

  // ── Kho ───────────────────────────────────────────────────────────────────
  warehouseQueue: () => api.get('/api/gift-orders/warehouse-queue').then(unwrap),
  startDelivery: (id) => api.post(`/api/gift-orders/${id}/start-delivery`).then(unwrap),
  complete: (id) => api.post(`/api/gift-orders/${id}/complete`).then(unwrap),
};

export const GIFT_STATUS = {
  PENDING:    { label: 'Chờ duyệt',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  APPROVED:   { label: 'Đã duyệt',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  DELIVERING: { label: 'Đang giao',   cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
  COMPLETED:  { label: 'Hoàn thành',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  REJECTED:   { label: 'Từ chối',     cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
  CANCELLED:  { label: 'Đã huỷ',      cls: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300' },
};

export const GIFT_OCCASION = {
  BIRTHDAY:      'Sinh nhật',
  STORE_OPENING: 'Khai trương',
  OTHER:         'Khác',
};
