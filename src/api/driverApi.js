// src/api/driverApi.js
import api from './axios';

const r = (res) => res.data?.data ?? res.data;

// ── Cổng tài xế (role DRIVER) ─────────────────────────────────────────────────
export const driverApi = {
  /** Thông tin tài xế gắn với tài khoản đang đăng nhập */
  me:          ()                 => api.get('/api/driver/me').then(r),
  /** Danh sách đơn đang giao của tôi */
  myOrders:    ()                 => api.get('/api/driver/orders').then(r),
  /** Chi tiết 1 đơn — thông tin cần giao */
  orderDetail: (id)               => api.get(`/api/driver/orders/${id}`).then(r),
  /** Xác nhận ĐÃ GIAO XONG */
  complete:    (id, payload = {}) => api.post(`/api/driver/orders/${id}/complete`, payload).then(r),
};

// ── Quản trị tài xế (OWNER/ADMIN/kho) ─────────────────────────────────────────
export const driverAdminApi = {
  list:           ()                => api.get('/api/admin/drivers').then(r),
  availableUsers: ()                => api.get('/api/admin/drivers/available-users').then(r),
  /** Gắn tài khoản với tài xế. userId = null để bỏ gắn. */
  link:           (driverId, userId) =>
    api.patch(`/api/admin/drivers/${driverId}/link`, { userId }).then(r),
};

export default driverApi;
