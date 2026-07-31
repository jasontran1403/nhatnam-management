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

  /**
   * Đánh dấu tài xế "KHÔNG XỬ LÝ" (systemDriver).
   * true = lựa chọn giao hàng ảo (Grab, Giao tại kho, Khách tự lấy…): vẫn gán được
   * cho đơn, nhưng KHÔNG hiện ở màn điểm danh ODO và báo cáo ODO, và không bị đòi
   * tài khoản đăng nhập.
   */
  setSystem:      (driverId, systemDriver) =>
    api.patch(`/api/admin/drivers/${driverId}/system`, { systemDriver }).then(r),

  /**
   * Tạo tài xế từ màn quản trị — set được systemDriver ngay lúc tạo.
   * @param {{name:string, vehicleType?:'TRUCK'|'MOTORBIKE'|'BOTH', systemDriver?:boolean}} payload
   */
  create:         (payload)         => api.post('/api/admin/drivers', payload).then(r),

  /** Sửa tài xế. Chỉ gửi trường cần đổi; trường không gửi giữ nguyên. */
  update:         (driverId, patch) =>
    api.patch(`/api/admin/drivers/${driverId}`, patch).then(r),
};

export default driverApi;