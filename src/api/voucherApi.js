// src/api/voucherApi.js
import api from './axios';

/**
 * Bóc lớp bọc ApiResponse { success, message, data }.
 * Ném Error với message của server để các màn hình hiển thị đúng lý do thất bại
 * (VD "Voucher sinh nhật chỉ áp dụng cho khách lẻ") thay vì một câu lỗi chung chung.
 */
const unwrap = (res) => {
  const body = res?.data;
  if (body && typeof body === 'object' && 'success' in body) {
    if (!body.success) throw new Error(body.message || 'Request failed');
    return body.data;
  }
  return body;
};

// ─── Voucher ─────────────────────────────────────────────────────────────────
export const voucherApi = {
  /**
   * @param params { q, customerId, reason, status, effectiveStatus, page, size }
   *   - status: trạng thái LƯU Ở DB (ACTIVE | CANCELLED)
   *   - effectiveStatus: trạng thái HIỆU LỰC tính theo thời điểm hiện tại
   *     (ACTIVE | USED | EXPIRED | CANCELLED) — dùng cái này để lọc "còn hạn"/"hết hạn"
   */
  list: (params) => api.get('/api/vouchers', { params }).then(unwrap),
  getById: (id) => api.get(`/api/vouchers/${id}`).then(unwrap),
  byCustomer: (customerId) => api.get(`/api/vouchers/by-customer/${customerId}`).then(unwrap),
  create: (data) => api.post('/api/vouchers', data).then(unwrap),
  update: (id, data) => api.put(`/api/vouchers/${id}`, data).then(unwrap),
  cancel: (id) => api.post(`/api/vouchers/${id}/cancel`).then(unwrap),
  remove: (id) => api.delete(`/api/vouchers/${id}`).then(unwrap),

  /** Lịch sử tiêu của voucher: đã dùng cho đơn nào, mỗi lần bao nhiêu. */
  usages: (id) => api.get(`/api/vouchers/${id}/usages`).then(unwrap),

  /** Tải phiếu PDF của 1 voucher (blob). */
  pdf: (id) => api.get(`/api/vouchers/${id}/pdf`, { responseType: 'blob' }),

  /** In nhiều voucher — mỗi phiếu 1 trang. `ids` là mảng số. */
  pdfBatch: (ids) =>
    api.get('/api/vouchers/pdf', { params: { ids: ids.join(',') }, responseType: 'blob' }),
};

// ─── Dự báo đặt hàng ─────────────────────────────────────────────────────────
export const orderForecastApi = {
  /**
   * @param q       tìm theo tên khách / tên công ty / SĐT
   * @param onlyDue true (mặc định) = chỉ khách tới hạn cần gọi
   */
  forecast: (q, onlyDue = true) =>
    api.get('/api/seller/order-forecast', { params: { q: q || undefined, onlyDue } }).then(unwrap),

  /** Đánh dấu đã gọi HÔM NAY. Khách vẫn ở lại danh sách, chỉ đổi style. */
  markContacted: (customerId, note) =>
    api.post(`/api/seller/order-forecast/${customerId}/contacted`, { note }).then(unwrap),

  /** Bỏ đánh dấu (bấm nhầm). */
  unmarkContacted: (customerId) =>
    api.delete(`/api/seller/order-forecast/${customerId}/contacted`).then(unwrap),
};

// ─── Thanh toán bằng voucher ─────────────────────────────────────────────────
export const voucherPaymentApi = {
  /**
   * Kiểm tra voucher cho một đơn — KHÔNG thay đổi gì.
   *
   * <p>Trả về `{ applicable, reason, applicableAmount, voucherRemaining, orderRemaining,
   * eligibleSubtotal, ... }`. `applicable = false` là tình huống bình thường (mã sai,
   * hết hạn, sai khách) chứ không phải lỗi hệ thống — đọc `reason` để hiển thị.
   */
  preview: (orderId, code) =>
    api.get(`/api/orders/${orderId}/voucher-payment/preview`, { params: { code } }).then(unwrap),

  /**
   * Áp dụng voucher vào đơn. Ghi nhận một khoản thu `paymentMethod = VOUCHER`;
   * phần còn lại của đơn vẫn thu bằng hình thức khác được.
   *
   * @param amount số tiền muốn dùng; bỏ trống = dùng tối đa có thể
   */
  /** Voucher đã trừ vào một đơn — dùng ở màn hình chi tiết đơn hàng. */
  usagesOfOrder: (orderId) =>
    api.get(`/api/orders/${orderId}/voucher-payment/usages`).then(unwrap),

  redeem: (orderId, code, amount) =>
    api.post(`/api/orders/${orderId}/voucher-payment`, { code, amount }).then(unwrap),
};

/** Tải blob về máy dưới dạng file — dùng chung cho các nút "In phiếu". */
export function downloadBlob(res, fallbackName) {
  const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cd = res.headers?.['content-disposition'] || '';
  const match = cd.match(/filename="?([^"]+)"?/);
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
